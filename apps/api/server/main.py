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
import re
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
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
    SandboxSimulationRun,
    ScenarioNotFoundError,
    ScenarioSummary,
)
from server.records import read_record
from server.sandbox_data.service import (
    SandboxDataUnavailable,
    ScenarioDatasetNotFound,
    ScenarioSimulationNotFound,
    SimulationBusy,
    SimulationRateLimited,
    cancel_sandbox_simulation,
    load_sandbox_analytics,
    load_sandbox_simulation_run,
    start_sandbox_simulation,
)
from server.sandbox_data.worker import run_simulation_worker
from server.showcase_cases.capture import EventValidator
from server.showcase_cases.models import CaseDetailResponse, CaseListResponse
from server.showcase_cases.repository import (
    PAGE_SIZE,
    CaseNotFound,
    CasesUnavailable,
    InvalidCursor,
    PsycopgCaseRepository,
)
from server.showcase_cases.settings import load_case_settings, valid_browser_id
from server.showcase_cases.stream import CaseRecorder, record_case_stream
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


_CASE_BROWSER_HEADER = "X-Showcase-Browser-Id"
def _simulation_browser_id(request: Request) -> str:
    """Return the caller's showcase browser ID, or raise a non echoing 400.

    The live feed (spec 0003) scopes every run to this anonymous key, as saved
    cases do (spec 0002); it is scoping, not authentication.
    """
    browser_id = valid_browser_id(request.headers.get(_CASE_BROWSER_HEADER))
    if browser_id is None:
        raise HTTPException(status_code=400, detail="invalid_browser_id")
    return browser_id


# A simulation progress stream stays open for one feed run plus a margin.
_SIMULATION_STREAM_SECONDS = 660


def _case_error(status_code: int, code: str, message: str) -> HTTPException:
    """Build a case route error in the showcase ``{code, message}`` shape."""
    return HTTPException(
        status_code=status_code, detail={"code": code, "message": message}
    )


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

    # Durable showcase cases (spec 0002) are off unless explicitly enabled with
    # a database, so the database free public deployment never stores cases.
    case_settings = load_case_settings()
    case_repository: PsycopgCaseRepository | None = None
    case_recorder: CaseRecorder | None = None
    if case_settings.ready and case_settings.database_url:
        try:
            case_repository = PsycopgCaseRepository(case_settings.database_url)
            case_recorder = CaseRecorder(
                case_repository, EventValidator(case_settings.event_schema_path)
            )
        except (CasesUnavailable, OSError, ValueError):
            # A bad URL or an unreadable event schema leaves storage off; runs
            # still stream normally and the case routes answer 503.
            case_repository = None
            case_recorder = None

    # The local live feed's worker (spec 0003) runs inside the API only when
    # explicitly enabled with a database; it is off for the public showcase.
    run_worker = _boolean_env("SIMULATION_WORKER_ENABLED", False) and bool(
        os.getenv("DATABASE_URL", "").strip()
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if not run_worker:
            yield
            return
        stop = asyncio.Event()
        worker = asyncio.create_task(run_simulation_worker(stop))
        try:
            yield
        finally:
            stop.set()
            await worker

    app = FastAPI(
        lifespan=lifespan,
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
        if request.url.path == "/cases" or request.url.path.startswith("/cases/"):
            # Case routes validate their own inputs; this is a safety net so a
            # framework validation error can never echo request input back.
            return JSONResponse(
                status_code=422,
                content={
                    "detail": {
                        "code": "invalid_parameters",
                        "message": "Check the case filters and page size.",
                    }
                },
            )
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
    def sandbox_scenario_analytics(
        scenario_id: str, request: Request, simulation_run_id: str | None = None
    ) -> SandboxScenarioAnalytics:
        """Return read only, prepared aggregate data for one Sandbox scenario.

        The route reads only a versioned sanitised dataset from the optional
        Neon store. It cannot contact Plaid, return raw transactions, score a
        payment, or mutate a scenario. With ``simulation_run_id``, that run's
        shown feed payments are added to the imported base, for its own
        browser only.
        """
        browser_id = (
            _simulation_browser_id(request) if simulation_run_id is not None else None
        )
        try:
            return SandboxScenarioAnalytics.model_validate(
                load_sandbox_analytics(scenario_id, simulation_run_id, browser_id)
            )
        except ScenarioSimulationNotFound as error:
            raise HTTPException(
                status_code=404, detail="sandbox_simulation_not_found"
            ) from error
        except ScenarioDatasetNotFound as error:
            raise HTTPException(
                status_code=404, detail="sandbox_scenario_not_found"
            ) from error
        except SandboxDataUnavailable as error:
            raise HTTPException(
                status_code=503, detail="sandbox_scenario_data_unavailable"
            ) from error

    @app.get(
        "/cases",
        include_in_schema=False,
        response_model=CaseListResponse,
        responses={
            400: {"model": DemoError},
            422: {"model": DemoError},
            503: {"model": DemoError},
        },
    )
    def list_showcase_cases(
        request: Request,
        limit: str | None = None,
        cursor: str | None = None,
        scenario_id: str | None = None,
        recommendation: str | None = None,
    ) -> CaseListResponse:
        """Return one page of the calling browser's durable cases (spec 0002).

        Parameters arrive as plain strings and are validated here, so the
        fixed error order holds: storage off (503), then the browser key (400),
        then a bad cursor (400) or other bad parameters (422). No error body
        echoes request input.
        """
        if case_repository is None:
            raise _case_error(
                503, "cases_unavailable", "Case history is off in this environment."
            )
        browser_id = valid_browser_id(request.headers.get(_CASE_BROWSER_HEADER))
        if browser_id is None:
            raise _case_error(
                400, "invalid_browser_id", "A valid browser key is required."
            )
        invalid = _case_error(
            422, "invalid_parameters", "Check the case filters and page size."
        )
        if limit is not None and not re.fullmatch(r"[1-9][0-9]?", limit):
            raise invalid
        page_size = int(limit) if limit is not None else PAGE_SIZE
        if page_size > PAGE_SIZE:
            raise invalid
        if scenario_id is not None and not re.fullmatch(r"S0[1-8]", scenario_id):
            raise invalid
        if recommendation is not None and recommendation not in {
            "PASS",
            "CHALLENGE",
            "HOLD",
        }:
            raise invalid
        try:
            page = case_repository.list_cases(
                browser_id,
                limit=page_size,
                cursor=cursor,
                scenario_id=scenario_id,
                recommendation=recommendation,
            )
        except InvalidCursor as error:
            raise _case_error(
                400, "invalid_cursor", "The page cursor is not valid."
            ) from error
        except CasesUnavailable as error:
            raise _case_error(
                503, "cases_unavailable", "Case history is unavailable."
            ) from error
        return CaseListResponse.model_validate(
            {
                "contract_version": "1.0",
                "items": page.items,
                "next_cursor": page.next_cursor,
                "totals": page.totals,
            }
        )

    @app.get(
        "/cases/{case_id}",
        include_in_schema=False,
        response_model=CaseDetailResponse,
        responses={
            400: {"model": DemoError},
            404: {"model": DemoError},
            503: {"model": DemoError},
        },
    )
    def read_showcase_case(case_id: str, request: Request) -> CaseDetailResponse:
        """Return one durable showcase case for the calling browser (spec 0002).

        Checks run in a fixed order, first failure wins: storage off or
        unreachable (503), then a missing or malformed browser key (400). A
        case that does not exist, has expired, belongs to another browser, or
        has a malformed ID is the same 404, so IDs reveal nothing.
        """
        if case_repository is None:
            raise _case_error(
                503, "cases_unavailable", "Case history is off in this environment."
            )
        browser_id = valid_browser_id(request.headers.get(_CASE_BROWSER_HEADER))
        if browser_id is None:
            raise _case_error(
                400, "invalid_browser_id", "A valid browser key is required."
            )
        not_found = _case_error(404, "case_not_found", "Case not found.")
        if not re.fullmatch(r"run_[a-z0-9_]{3,64}", case_id):
            raise not_found
        try:
            return CaseDetailResponse.model_validate(
                case_repository.get_case(browser_id, case_id)
            )
        except CaseNotFound as error:
            raise not_found from error
        except CasesUnavailable as error:
            raise _case_error(
                503, "cases_unavailable", "Case history is unavailable."
            ) from error

    @app.post(
        "/sandbox/scenarios/{scenario_id}/simulation-runs",
        include_in_schema=False,
        response_model=SandboxSimulationRun,
        responses={
            400: {"model": DemoError},
            404: {"model": DemoError},
            429: {"model": DemoError},
            503: {"model": DemoError},
        },
    )
    def start_sandbox_scenario_simulation(
        scenario_id: str, request: Request
    ) -> SandboxSimulationRun:
        """Start one browser's deterministic feed without accepting event data.

        Refused with 429 when the site is at its live run cap or this browser
        started too many runs this minute (spec 0003).
        """
        browser_id = _simulation_browser_id(request)
        try:
            return SandboxSimulationRun.model_validate(
                start_sandbox_simulation(scenario_id, browser_id)
            )
        except SimulationBusy as error:
            raise HTTPException(status_code=429, detail="simulation_busy") from error
        except SimulationRateLimited as error:
            raise HTTPException(
                status_code=429, detail="simulation_rate_limited"
            ) from error
        except ScenarioDatasetNotFound as error:
            raise HTTPException(
                status_code=404, detail="sandbox_scenario_not_found"
            ) from error
        except SandboxDataUnavailable as error:
            raise HTTPException(
                status_code=503, detail="sandbox_scenario_data_unavailable"
            ) from error

    @app.post(
        "/sandbox/simulation-runs/{run_id}/cancel",
        include_in_schema=False,
        response_model=SandboxSimulationRun,
        responses={
            400: {"model": DemoError},
            404: {"model": DemoError},
            503: {"model": DemoError},
        },
    )
    def cancel_sandbox_scenario_simulation(
        run_id: str, request: Request
    ) -> SandboxSimulationRun:
        """Stop one of this browser's runs; payments already shown stay shown."""
        browser_id = _simulation_browser_id(request)
        try:
            return SandboxSimulationRun.model_validate(
                cancel_sandbox_simulation(run_id, browser_id)
            )
        except ScenarioSimulationNotFound as error:
            raise HTTPException(
                status_code=404, detail="sandbox_simulation_not_found"
            ) from error
        except SandboxDataUnavailable as error:
            raise HTTPException(
                status_code=503, detail="sandbox_scenario_data_unavailable"
            ) from error

    @app.get(
        "/sandbox/simulation-runs/{run_id}",
        include_in_schema=False,
        response_model=SandboxSimulationRun,
        responses={
            400: {"model": DemoError},
            404: {"model": DemoError},
            503: {"model": DemoError},
        },
    )
    def sandbox_simulation_run(run_id: str, request: Request) -> SandboxSimulationRun:
        """Return one of this browser's runs' safe progress information."""
        browser_id = _simulation_browser_id(request)
        try:
            return SandboxSimulationRun.model_validate(
                load_sandbox_simulation_run(run_id, browser_id)
            )
        except ScenarioSimulationNotFound as error:
            raise HTTPException(
                status_code=404, detail="sandbox_simulation_not_found"
            ) from error
        except SandboxDataUnavailable as error:
            raise HTTPException(
                status_code=503, detail="sandbox_scenario_data_unavailable"
            ) from error

    @app.get(
        "/sandbox/simulation-runs/{run_id}/events",
        include_in_schema=False,
        response_class=StreamingResponse,
        responses={
            400: {"model": DemoError},
            404: {"model": DemoError},
            503: {"model": DemoError},
        },
    )
    async def sandbox_simulation_events(
        run_id: str, request: Request
    ) -> StreamingResponse:
        """Stream one of this browser's runs' safe state while it is connected.

        Read with ``fetch`` (spec 0003), so the browser ID arrives as a header.
        Ownership is checked before streaming, so another browser's run is a
        plain 404 rather than an empty stream.
        """
        browser_id = _simulation_browser_id(request)
        try:
            # psycopg is synchronous; each read runs off the event loop.
            first = await asyncio.to_thread(load_sandbox_simulation_run, run_id, browser_id)
        except ScenarioSimulationNotFound as error:
            raise HTTPException(
                status_code=404, detail="sandbox_simulation_not_found"
            ) from error
        except SandboxDataUnavailable as error:
            raise HTTPException(
                status_code=503, detail="sandbox_scenario_data_unavailable"
            ) from error

        async def event_stream() -> AsyncIterator[str]:
            previous: str | None = None
            state = first
            # Long enough to follow a whole feed run, then the client reconnects.
            for _ in range(_SIMULATION_STREAM_SECONDS):
                payload = json.dumps(state, sort_keys=True)
                if payload != previous:
                    yield f"event: simulation_state\ndata: {payload}\n\n"
                    previous = payload
                if state["state"] in {"completed", "failed", "cancelled"}:
                    return
                await asyncio.sleep(1)
                if await request.is_disconnected():
                    return
                try:
                    state = await asyncio.to_thread(
                        load_sandbox_simulation_run, run_id, browser_id
                    )
                except (SandboxDataUnavailable, ScenarioSimulationNotFound):
                    return

        return StreamingResponse(event_stream(), media_type="text/event-stream")

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
        # The browser key only scopes where a completed case is saved (spec
        # 0002). It never feeds admission or rate limiting, and the stream is
        # passed through unchanged whether or not the case is saved.
        browser_id = valid_browser_id(request.headers.get(_CASE_BROWSER_HEADER))
        return StreamingResponse(
            record_case_stream(
                showcase_runtime.stream(body, client_key),
                browser_id=browser_id,
                recorder=case_recorder,
            ),
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
