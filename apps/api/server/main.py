"""
Fraud Compliance Agent Console API.

Streams examples/agents/fraud_compliance_agent_v2's LangGraph pipeline live,
one Server-Sent Event per completed node, for the agent-console frontend.
Entirely separate from arbiris-sdk's own api/ package (which requires
DB-backed API-key auth for its multi-tenant records service) — this is an
unauthenticated, single-operator demo tool, not that product.

Run locally:
    uv run uvicorn server.main:app --reload --port 8010

The live demo pipeline needs vendor/arbiris-sdk (a private git submodule) and
`uv sync --extra sdk`. Without it the API still starts: /health and
/demo/model-summary work, and /scenarios and the run routes return 503
"demo_pipeline_unavailable".
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

try:
    from examples.agents.fraud_compliance_agent_v2.pipeline import SCENARIOS, pipeline
    from examples.agents.fraud_compliance_agent_v2.state import FraudPipelineState
except ImportError:
    # The private SDK submodule is not initialised (for example a fresh public
    # clone). The API still starts; only the routes that need the demo pipeline
    # are unavailable, and they say so instead of failing at import time.
    SCENARIOS: list[dict] = []
    pipeline = None
    FraudPipelineState = dict
from fastapi import FastAPI, HTTPException, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from server.models import (
    DemoError,
    DemoModelMetrics,
    DemoModelSummary,
    DemoSliceMetric,
    DemoThresholdPoint,
    HealthResponse,
    PresetRunRequest,
    RunRequest,
    SandboxScenarioAnalytics,
    ScenarioNotFoundError,
    ScenarioSummary,
)
from server.records import read_record
from server.sandbox_data.service import (
    SandboxDataUnavailable,
    ScenarioDatasetNotFound,
    load_sandbox_analytics,
)
from server.showcase_investigation.errors import ShowcaseRuntimeUnavailable
from server.showcase_investigation.models import (
    ShowcaseError,
    ShowcaseErrorDetail,
    ShowcaseInvestigationRequest,
)
from server.showcase_investigation.runtime import ShowcaseRuntime


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


def _require_demo_pipeline() -> None:
    """Fail a request with 503 when the optional SDK-backed pipeline is not installed.

    Raises:
        HTTPException: 503 with the stable detail `demo_pipeline_unavailable`.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="demo_pipeline_unavailable")


_REPOSITORY_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_MODEL_REPORT_RELATIVE_PATH = (
    Path("docs") / "proposals" / "fast-path-model-release.candidate.json"
)
_MODEL_CONTRACT_RELATIVE_PATH = (
    Path("docs") / "contracts" / "model-training-contract.v1.json"
)


def _evidence_root() -> Path:
    """Return the directory holding the sanitised benchmark evidence pair.

    Returns:
        The repository root by default, which is what a local run uses. A
        packaged image has no repository, so a deployment sets
        `FCA_EVIDENCE_ROOT` to the directory the two evidence files were copied
        into. A blank value falls back to the repository rather than resolving
        to an unintended directory.

    Side effects:
        Reads one process environment variable.
    """
    override = os.getenv("FCA_EVIDENCE_ROOT", "").strip()
    return Path(override) if override else _REPOSITORY_ROOT


# Only an approved-mode notebook run may back the Sparkov label below; a
# synthetic or gated run writes a different status and must never be served.
_ACCEPTED_REPORT_STATUS = "candidate_evaluation_pending_review"


def _demo_model_summary() -> DemoModelSummary:
    """Read only sanitised benchmark evidence; never load a model or source rows.

    Raises:
        HTTPException: 503 when the report or contract is missing or malformed,
            or when the report is not an approved-mode run of the accepted
            contract (wrong status, feature list, or dataset checksum).
    """
    evidence_root = _evidence_root()
    report_path = evidence_root / _MODEL_REPORT_RELATIVE_PATH
    contract_path = evidence_root / _MODEL_CONTRACT_RELATIVE_PATH
    if not report_path.is_file() or not contract_path.is_file():
        raise HTTPException(status_code=503, detail="demo_model_summary_unavailable")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        input_manifest = report["input_manifest"]
        if (
            report.get("status") != _ACCEPTED_REPORT_STATUS
            or input_manifest["feature_columns"] != contract["feature_columns"]
            or input_manifest["dataset_sha256"] != contract["dataset_sha256"]
        ):
            raise HTTPException(
                status_code=503, detail="demo_model_summary_unavailable"
            )
        model_labels = {
            "logistic_regression_baseline": "Logistic Regression baseline",
            "xgboost_candidate": "XGBoost candidate",
        }
        model_results = [
            DemoModelMetrics(
                model_id=model_id,
                label=model_labels.get(model_id, model_id.replace("_", " ")),
                **metrics["metrics"],
                threshold_sweep=[
                    DemoThresholdPoint(**point) for point in metrics["threshold_sweep"]
                ],
                slice_metrics=[
                    DemoSliceMetric(**point) for point in metrics["slice_metrics"]
                ],
            )
            for model_id, metrics in report["models"].items()
        ]
        return DemoModelSummary(
            artifact="synthetic_benchmark_model_summary",
            status="mechanics_evaluation_complete_not_deployable",
            data_source="Sparkov simulated credit-card transactions",
            training_scope=str(contract["training_scope"]),
            dataset_sha256=str(input_manifest["dataset_sha256"]),
            feature_columns=[
                str(column) for column in input_manifest["feature_columns"]
            ],
            partition_counts={
                name: int(count) for name, count in report["partition_counts"].items()
            },
            test_prevalence=float(report["prevalence"]["test"]),
            model_results=model_results,
            release_boundary=[
                str(boundary) for boundary in contract["release_boundary"]
            ],
            report_sha256=str(report["report_sha256"]),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=503, detail="demo_model_summary_unavailable"
        ) from error


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
                async for update in pipeline.astream(
                    initial_state, stream_mode="updates"
                ):
                    for node_name, node_result in update.items():
                        payload: dict = {
                            "node": node_name,
                            "result": {},
                            "record": None,
                        }
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
    try:
        showcase_runtime = ShowcaseRuntime.from_environment()
    except ShowcaseRuntimeUnavailable:
        # Health and legacy demo routes remain available if packaged showcase
        # inputs are absent. The new endpoint returns its accepted redacted 503.
        showcase_runtime = None

    app = FastAPI(
        title="Fraud Compliance Agent Console API",
        description=(
            "Synthetic-only recruiter-showcase API. It streams the current "
            "legacy demo pipeline and serves sanitised benchmark evidence; "
            "it is not the target operational API and cannot execute a payment."
        ),
        version="0.1.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def redacted_showcase_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        """Redact only the public-showcase route's request-validation details."""
        if request.url.path == "/showcase/investigations":
            detail = ShowcaseErrorDetail(
                code="invalid_request",
                message="Choose an available synthetic scenario and execution mode.",
            )
            return JSONResponse(
                status_code=422,
                content=ShowcaseError(detail=detail).model_dump(),
            )
        return await request_validation_exception_handler(request, error)

    @app.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        """Return a minimal unauthenticated liveness response for the local demo."""
        return HealthResponse(status="ok")

    @app.get(
        "/scenarios",
        response_model=list[ScenarioSummary],
        responses={503: {"model": DemoError}},
    )
    async def list_scenarios() -> list[ScenarioSummary]:
        """List deterministic demo scenario labels without exposing their full fixtures."""
        _require_demo_pipeline()
        return [
            ScenarioSummary(id=_scenario_id(scenario), label=scenario["label"])
            for scenario in SCENARIOS
        ]

    @app.get(
        "/demo/model-summary",
        response_model=DemoModelSummary,
        responses={503: {"model": DemoError}},
    )
    async def demo_model_summary() -> DemoModelSummary:
        """Return only the audit-safe synthetic benchmark summary for the portfolio UI."""
        return _demo_model_summary()

    @app.get(
        "/sandbox/scenarios/{scenario_id}/analytics",
        include_in_schema=False,
        response_model=SandboxScenarioAnalytics,
        responses={404: {"model": DemoError}, 503: {"model": DemoError}},
    )
    def sandbox_scenario_analytics(scenario_id: str) -> SandboxScenarioAnalytics:
        """Return read only, prepared aggregate data for one Sandbox scenario.

        The route reads only a versioned sanitised dataset from the optional
        Neon store. It cannot contact Plaid, return raw transactions, score a
        payment, or mutate a scenario.
        """
        try:
            return SandboxScenarioAnalytics.model_validate(
                load_sandbox_analytics(scenario_id)
            )
        except ScenarioDatasetNotFound as error:
            raise HTTPException(status_code=404, detail="sandbox_scenario_not_found") from error
        except SandboxDataUnavailable as error:
            raise HTTPException(
                status_code=503, detail="sandbox_scenario_data_unavailable"
            ) from error

    @app.post(
        "/showcase/investigations",
        include_in_schema=False,
        response_class=StreamingResponse,
        responses={
            200: {
                "description": (
                    "Transient SSE stream governed by the accepted public-showcase "
                    "event schema."
                ),
                "content": {
                    "text/event-stream": {
                        "schema": {"type": "string"},
                        "x-event-schema": "public-showcase-events.v1.schema.json",
                    }
                },
            },
            422: {"model": ShowcaseError},
            503: {"model": ShowcaseError},
        },
    )
    async def stream_showcase_investigation(
        body: ShowcaseInvestigationRequest, request: Request
    ) -> StreamingResponse:
        """Stream one bounded synthetic S01–S05 showcase investigation."""
        if showcase_runtime is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "showcase_investigation_unavailable",
                    "message": "The synthetic investigation is unavailable.",
                },
            )
        try:
            # Resolve deferred S06-S08 before response streaming begins so the
            # client receives the accepted HTTP error rather than a broken SSE.
            showcase_runtime.require_public_scenario(body.scenario_id)
        except ShowcaseRuntimeUnavailable as error:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "showcase_investigation_unavailable",
                    "message": "The synthetic investigation is unavailable.",
                },
            ) from error

        # The socket peer is server-observed metadata. Arbitrary forwarding or
        # caller-supplied identity headers are deliberately ignored.
        client_key = request.client.host if request.client else "unknown"
        return StreamingResponse(
            showcase_runtime.stream(body, client_key),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    @app.post(
        "/run",
        response_class=StreamingResponse,
        responses={
            200: {
                "description": "A bounded stream of versioned synthetic run events.",
                "content": {
                    "text/event-stream": {
                        "schema": {"type": "string"},
                        "x-event-schema": "demo-run-events.v1.schema.json",
                    }
                },
            },
            503: {"model": DemoError},
        },
    )
    async def run(request: RunRequest) -> StreamingResponse:
        """Stream a simulated custom transaction run; no payment action is executed."""
        _require_demo_pipeline()
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

    @app.post(
        "/run/preset/{scenario_id}",
        response_class=StreamingResponse,
        responses={
            200: {
                "description": "A bounded stream of versioned synthetic run events.",
                "content": {
                    "text/event-stream": {
                        "schema": {"type": "string"},
                        "x-event-schema": "demo-run-events.v1.schema.json",
                    }
                },
            },
            404: {"model": ScenarioNotFoundError},
            503: {"model": DemoError},
        },
    )
    async def run_preset(
        scenario_id: str, overrides: PresetRunRequest | None = None
    ) -> StreamingResponse:
        """Stream a named deterministic demo scenario with optional safe overrides."""
        _require_demo_pipeline()
        scenario = _find_scenario(scenario_id)
        if scenario is None:
            raise HTTPException(
                status_code=404, detail=f"Unknown scenario_id: {scenario_id}"
            )
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

    # These extensions make the generated document self-identifying as the
    # narrow showcase contract. They do not approve future operational routes.
    schema = app.openapi()
    schema["info"].update(
        {
            "x-contract-version": "1.0",
            "x-approval-status": "accepted",
            "x-scope": (
                "Current synthetic recruiter-showcase routes and their HTTP "
                "envelopes only; not the target operational API."
            ),
            "x-prohibitions": [
                "No route executes, releases, or approves a payment.",
                "No response represents durable transaction history.",
                "No benchmark response is a runtime fraud score or model release.",
            ],
            "x-sse-event-schema": "demo-run-events.v1.schema.json",
        }
    )
    app.openapi_schema = schema

    return app


app = create_app()
