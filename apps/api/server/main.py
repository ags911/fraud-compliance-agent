"""
Fraud Compliance Agent Console API.

Streams examples/agents/fraud_compliance_agent_v2's LangGraph pipeline live,
one Server-Sent Event per completed node, for the agent-console frontend.
Entirely separate from arbiris-sdk's own api/ package (which requires
DB-backed API-key auth for its multi-tenant records service) — this is an
unauthenticated, single-operator demo tool, not that product.

Run locally:
    uv run uvicorn server.main:app --reload --port 8010

Requires vendor/arbiris-sdk (a git submodule) to be initialised:
    git submodule update --init --recursive
"""

import asyncio
import json
import math
import os
import sys
from collections.abc import AsyncIterator
from dataclasses import asdict, is_dataclass
from pathlib import Path

# vendor/arbiris-sdk is a git submodule — its own package (`arbiris`) is an
# editable path dependency (see pyproject.toml's [tool.uv.sources]), but
# `examples/` isn't part of that packaged distribution (deliberately — see
# arbiris-sdk's examples/agents/README.md), so it's only importable by putting
# the submodule root itself on sys.path.
_VENDOR_ROOT = Path(__file__).resolve().parent.parent / "vendor" / "arbiris-sdk"
if str(_VENDOR_ROOT) not in sys.path:
    sys.path.insert(0, str(_VENDOR_ROOT))

from examples.agents.fraud_compliance_agent_v2.pipeline import SCENARIOS, pipeline
from examples.agents.fraud_compliance_agent_v2.state import FraudPipelineState
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from server.models import (
    DemoModelMetrics,
    DemoModelSummary,
    DemoSliceMetric,
    DemoThresholdPoint,
    PresetRunRequest,
    RunRequest,
)
from server.records import read_record


def _allowed_origins() -> list[str]:
    """Return explicit browser origins permitted to call the demo API."""
    raw = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _positive_int_env(name: str, default: int) -> int:
    """Read a positive integer safeguard from the environment.

    Args:
        name: Environment-variable name used for the deployment setting.
        default: Safe local default used when the variable is absent.

    Returns:
        The configured positive integer.

    Raises:
        RuntimeError: If the value is not a positive integer.

    Side effects:
        Reads one process environment variable.
    """
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as error:
        raise RuntimeError(f"{name} must be a positive integer") from error
    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer")
    return value


def _positive_float_env(name: str, default: float) -> float:
    """Read a positive finite timeout from the environment.

    Args:
        name: Environment-variable name used for the deployment setting.
        default: Safe local default in seconds when the variable is absent.

    Returns:
        The configured positive, finite floating-point value.

    Raises:
        RuntimeError: If the value is not positive and finite.

    Side effects:
        Reads one process environment variable.
    """
    raw = os.getenv(name, str(default))
    try:
        value = float(raw)
    except ValueError as error:
        raise RuntimeError(f"{name} must be a positive finite number") from error
    if value <= 0 or not math.isfinite(value):
        raise RuntimeError(f"{name} must be a positive finite number")
    return value


def _boolean_env(name: str, default: bool) -> bool:
    """Read an explicit boolean deployment safeguard.

    Args:
        name: Environment-variable name used for the deployment setting.
        default: Safe value used when the variable is absent.

    Returns:
        Parsed boolean for ``true``/``false`` style values.

    Raises:
        RuntimeError: If the configured value is not an explicit boolean.

    Side effects:
        Reads one process environment variable.
    """
    raw = os.getenv(name, str(default)).strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be true or false")


def _scenario_id(scenario: dict) -> str:
    """'Scenario A — High-risk HOLD (score 100)' -> 'A'."""
    return scenario["label"].split()[1]


def _find_scenario(scenario_id: str) -> dict | None:
    for scenario in SCENARIOS:
        if _scenario_id(scenario) == scenario_id.upper():
            return scenario
    return None


def _demo_model_summary() -> DemoModelSummary:
    """Read only sanitised benchmark evidence; never load a model or source rows."""
    repository_root = Path(__file__).resolve().parent.parent.parent.parent
    report_path = repository_root / "docs" / "proposals" / "fast-path-model-release.candidate.json"
    contract_path = repository_root / "docs" / "contracts" / "model-training-contract.v1.json"
    if not report_path.is_file() or not contract_path.is_file():
        raise HTTPException(status_code=503, detail="demo_model_summary_unavailable")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        input_manifest = report["input_manifest"]
        model_labels = {
            "logistic_regression_baseline": "Logistic Regression baseline",
            "xgboost_candidate": "XGBoost candidate",
        }
        model_results = [
            DemoModelMetrics(
                model_id=model_id,
                label=model_labels.get(model_id, model_id.replace("_", " ")),
                **metrics["metrics"],
                threshold_sweep=[DemoThresholdPoint(**point) for point in metrics["threshold_sweep"]],
                slice_metrics=[DemoSliceMetric(**point) for point in metrics["slice_metrics"]],
            )
            for model_id, metrics in report["models"].items()
        ]
        return DemoModelSummary(
            artifact="synthetic_benchmark_model_summary",
            status="mechanics_evaluation_complete_not_deployable",
            data_source="Sparkov simulated credit-card transactions",
            training_scope=str(contract["training_scope"]),
            dataset_sha256=str(input_manifest["dataset_sha256"]),
            feature_columns=[str(column) for column in input_manifest["feature_columns"]],
            partition_counts={name: int(count) for name, count in report["partition_counts"].items()},
            test_prevalence=float(report["prevalence"]["test"]),
            model_results=model_results,
            release_boundary=[str(boundary) for boundary in contract["release_boundary"]],
            report_sha256=str(report["report_sha256"]),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=503, detail="demo_model_summary_unavailable") from error


def _build_initial_state(
    customer_id: str,
    raw_transaction: dict,
    raw_history: list,
    simulate_llm_outage: bool,
) -> FraudPipelineState:
    return {
        "customer_id": customer_id,
        "raw_transaction": raw_transaction,
        "raw_history": raw_history,
        "simulate_llm_outage": simulate_llm_outage,
        "transaction": None,
        "sim_a": None,
        "sim_b": None,
        "human_review": None,
        "counterfactual": None,
        "evidence_pack_path": None,
    }


async def _stream_bounded_run(
    initial_state: FraudPipelineState,
    run_slots: asyncio.Semaphore,
    timeout_seconds: float,
) -> AsyncIterator[str]:
    """Stream one bounded synthetic run with stable terminal semantics.

    Args:
        initial_state: Validated, in-memory legacy pipeline input.
        run_slots: Process-local concurrency guard shared by demo routes.
        timeout_seconds: Maximum wall-clock duration, including slot waiting.

    Yields:
        Sanitised SSE node events followed by exactly one ``done`` event.

    Side effects:
        Executes the demo pipeline, which may call the optional investigation
        provider and write ephemeral records through the pinned SDK.
    """
    try:
        # Bound both queueing and execution so public demo traffic cannot hold
        # requests or provider work indefinitely.
        async with asyncio.timeout(timeout_seconds):
            async with run_slots:
                async for update in pipeline.astream(initial_state, stream_mode="updates"):
                    for node_name, node_result in update.items():
                        payload: dict = {"node": node_name, "result": {}, "record": None}
                        for key, value in node_result.items():
                            if is_dataclass(value):
                                payload["result"][key] = asdict(value)
                                record_id = getattr(value, "record_id", None)
                                if record_id:
                                    payload["record"] = read_record(record_id)
                            else:
                                payload["result"][key] = value
                        yield f"data: {json.dumps(payload, default=str)}\n\n"
    except TimeoutError:
        yield f"data: {json.dumps({'node': 'error', 'error': 'processing_timeout'})}\n\n"
    # The SSE boundary must close gracefully for any provider/pipeline failure.
    # It emits only the stable redacted category below, never the exception.
    except Exception:  # noqa: BLE001
        # Provider and pipeline exceptions can contain sensitive implementation
        # details. The current demo exposes a stable category only; structured
        # server-side logging is a separate Phase 0 contract decision.
        yield f"data: {json.dumps({'node': 'error', 'error': 'processing_failed'})}\n\n"
    finally:
        yield "event: done\ndata: {}\n\n"


def create_app() -> FastAPI:
    """Create the demo-only API with redacted streaming routes.

    Returns:
        The configured FastAPI application for the local operator-console demo.

    Side effects:
        Registers CORS middleware and route handlers. It does not contact a
        provider, load a model, or authorise a payment action during creation.
    """
    # These process-local guards are suitable for the single-container public
    # showcase. They are not a substitute for production admission control.
    run_slots = asyncio.Semaphore(_positive_int_env("DEMO_MAX_CONCURRENT_RUNS", 2))
    run_timeout_seconds = _positive_float_env("DEMO_RUN_TIMEOUT_SECONDS", 60.0)
    # Public/local defaults remain deterministic and make no paid external
    # investigation request. A developer must opt in explicitly for Groq.
    allow_external_investigation = _boolean_env(
        "DEMO_ALLOW_EXTERNAL_INVESTIGATION", False
    )

    app = FastAPI(
        title="Fraud Compliance Agent Console API",
        description=(
            "Streams fraud_compliance_agent_v2's LangGraph pipeline live "
            "for the agent-console demo frontend."
        ),
        version="0.1.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        """Return a minimal unauthenticated liveness response for the local demo."""
        return {"status": "ok"}

    @app.get("/scenarios")
    async def list_scenarios():
        """List deterministic demo scenario labels without exposing their full fixtures."""
        return [
            {"id": _scenario_id(scenario), "label": scenario["label"]}
            for scenario in SCENARIOS
        ]

    @app.get("/demo/model-summary", response_model=DemoModelSummary)
    async def demo_model_summary() -> DemoModelSummary:
        """Return only the audit-safe synthetic benchmark summary for the portfolio UI."""
        return _demo_model_summary()

    @app.post("/run")
    async def run(request: RunRequest):
        """Stream a simulated custom transaction run; no payment action is executed."""
        initial_state = _build_initial_state(
            request.customer_id,
            request.to_raw_transaction(),
            request.to_raw_history(),
            request.simulate_llm_outage or not allow_external_investigation,
        )
        return StreamingResponse(
            _stream_bounded_run(initial_state, run_slots, run_timeout_seconds),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    @app.post("/run/preset/{scenario_id}")
    async def run_preset(
        scenario_id: str, overrides: PresetRunRequest | None = None
    ):
        """Stream a named deterministic demo scenario with optional safe overrides."""
        scenario = _find_scenario(scenario_id)
        if scenario is None:
            raise HTTPException(status_code=404, detail=f"Unknown scenario_id: {scenario_id}")
        overrides = overrides or PresetRunRequest()
        initial_state = _build_initial_state(
            scenario["customer_id"],
            scenario["transaction"],
            scenario.get("history", []),
            overrides.simulate_llm_outage or not allow_external_investigation,
        )
        return StreamingResponse(
            _stream_bounded_run(initial_state, run_slots, run_timeout_seconds),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    return app


app = create_app()
