"""Exercise the SDK-free public-showcase runtime and its safety boundaries."""

import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from server.main import create_app
from server.showcase_investigation.admission import LiveAdmissionController
from server.showcase_investigation.errors import ShowcaseRuntimeUnavailable
from server.showcase_investigation.fixtures import load_fixture_packet
from server.showcase_investigation.graph import run_live_graph
from server.showcase_investigation.models import (
    ProviderAssessment,
    RecommendationClaim,
    ToolPlan,
)
from server.showcase_investigation.provider import GroqInvestigationProvider
from server.showcase_investigation.runtime import ShowcaseRuntime
from server.showcase_investigation.settings import LiveLimits, ShowcaseSettings


def _payloads(response_text: str) -> list[dict]:
    """Decode data payloads and omit the named terminal done frame."""
    payloads = []
    for frame in response_text.strip().split("\n\n"):
        if frame.startswith("data: "):
            payloads.append(json.loads(frame.removeprefix("data: ")))
    return [payload for payload in payloads if payload]


def _settings(*, live_enabled: bool = False) -> ShowcaseSettings:
    """Return accepted limits with deterministic test-only provider settings."""
    return ShowcaseSettings(
        live_enabled=live_enabled,
        groq_api_key="test-only" if live_enabled else None,
        groq_model="approved-test-model" if live_enabled else None,
        groq_allowed_models=("approved-test-model",) if live_enabled else (),
        limits=LiveLimits(
            maximum_concurrent=1,
            maximum_per_client=2,
            per_client_window_seconds=600,
            maximum_per_process_window=10,
            maximum_window_seconds=1800,
            timeout_seconds=45,
        ),
    )


class _ValidProvider:
    """Return the accepted two-tool plan and evidence-grounded assessment."""

    async def select_tools(self, _facts, _allowed_tools) -> ToolPlan:
        """Choose the two tools that have accepted S04 evidence."""
        return ToolPlan(tools=["get_payee_evidence", "get_device_session_evidence"])

    async def assess(self, _facts, _evidence) -> ProviderAssessment:
        """Return one same-run cited recommendation without authority fields."""
        return ProviderAssessment(
            recommendation="CHALLENGE",
            summary="Synthetic evidence remains mixed.",
            claims=[
                RecommendationClaim(
                    claim_id="claim_recent_payee",
                    text="The synthetic payee relationship is recent.",
                    evidence_ids=["ev_payee_relationship"],
                )
            ],
            uncertainties=["No production evidence is available."],
        )


class _MissingEvidenceProvider(_ValidProvider):
    """Select the allowlisted tool whose S04 payload is not accepted."""

    async def select_tools(self, _facts, _allowed_tools) -> ToolPlan:
        """Include account evidence to exercise the stable tool failure."""
        return ToolPlan(tools=["get_payee_evidence", "get_account_activity_evidence"])


class _UnknownCitationProvider(_ValidProvider):
    """Return a structurally valid but ungrounded visible claim."""

    async def assess(self, _facts, _evidence) -> ProviderAssessment:
        """Cite an identifier not returned during this run."""
        return ProviderAssessment(
            recommendation="CHALLENGE",
            summary="This output must fail citation validation.",
            claims=[
                RecommendationClaim(
                    claim_id="claim_unknown_source",
                    text="Unsupported synthetic claim.",
                    evidence_ids=["ev_not_returned"],
                )
            ],
        )


def test_fixture_loader_accepts_only_the_approved_packet(repository_root) -> None:
    """Load all eight accepted scenarios while keeping runtime scope explicit."""
    packet = load_fixture_packet(repository_root)

    assert packet.version == "1.0"
    assert list(packet.scenarios) == [f"S0{number}" for number in range(1, 9)]
    assert packet.scenarios["S04"].recorded_tool_sequence == (
        "get_payee_evidence",
        "get_device_session_evidence",
    )


def test_fixture_loader_rejects_unaccepted_metadata(repository_root, tmp_path) -> None:
    """A copied packet cannot become runtime input after its status is changed."""
    source = repository_root / "fixtures/s01-s08/scenarios.v1.json"
    document = json.loads(source.read_text(encoding="utf-8"))
    document["status"] = "proposed"
    target = tmp_path / "fixtures/s01-s08"
    target.mkdir(parents=True)
    (target / "scenarios.v1.json").write_text(json.dumps(document), encoding="utf-8")

    with pytest.raises(ShowcaseRuntimeUnavailable):
        load_fixture_packet(tmp_path)


@pytest.mark.parametrize(
    ("scenario_id", "route", "recommendation", "reason"),
    [
        ("S01", "PASS", "PASS", "deterministic_clear_route"),
        ("S02", "HOLD", "HOLD", "hard_deterministic_control"),
        ("S03", "HOLD", "HOLD", "hard_app_control"),
    ],
)
def test_deterministic_scenarios_visibly_skip_the_agent(
    scenario_id, route, recommendation, reason
) -> None:
    """Hard and clear routes cannot silently invoke or be overridden by an agent."""
    response = TestClient(create_app()).post(
        "/showcase/investigations",
        json={"scenario_id": scenario_id, "execution_mode": "recorded"},
    )
    payloads = _payloads(response.text)

    assert response.status_code == 200
    assert [item["event"] for item in payloads] == [
        "run_started",
        "route_resolved",
        "investigation_skipped",
        "run_result",
    ]
    assert payloads[1]["deterministic_route"] == route
    assert payloads[2]["reason"] == reason
    assert payloads[3]["recommendation"] == recommendation
    assert payloads[3]["simulated_action"] == "none"


def test_recorded_s04_matches_the_accepted_evidence_trace(repository_root) -> None:
    """Playback emits two distinct tools, exact evidence, citations and no action."""
    response = TestClient(create_app()).post(
        "/showcase/investigations",
        json={"scenario_id": "S04", "execution_mode": "recorded"},
    )
    payloads = _payloads(response.text)
    schema = json.loads(
        (
            repository_root / "docs/contracts/public-showcase-events.v1.schema.json"
        ).read_text(encoding="utf-8")
    )
    validator = Draft202012Validator(schema)

    assert response.status_code == 200
    for payload in payloads:
        validator.validate(payload)
    assert [item["event"] for item in payloads] == [
        "run_started",
        "route_resolved",
        "tool_call",
        "tool_result",
        "tool_call",
        "tool_result",
        "investigation_result",
        "run_result",
    ]
    evidence_ids = {
        evidence["evidence_id"]
        for event in payloads
        if event["event"] == "tool_result"
        for evidence in event["evidence"]
    }
    assert evidence_ids == {"ev_payee_relationship", "ev_device_familiarity"}
    investigation = payloads[-2]
    assert investigation["recommendation"] == "CHALLENGE"
    assert {
        evidence_id
        for claim in investigation["claims"]
        for evidence_id in claim["evidence_ids"]
    } <= evidence_ids
    assert payloads[-1]["authority_status"] == "not_evaluated"
    assert payloads[-1]["simulated_action"] == "none"
    assert response.text.endswith("event: done\ndata: {}\n\n")


def test_s05_outage_is_incomplete_and_never_calls_a_tool() -> None:
    """The deterministic failure path is truthful, redacted and fail-safe."""
    response = TestClient(create_app()).post(
        "/showcase/investigations",
        json={"scenario_id": "S05", "execution_mode": "live"},
    )
    payloads = _payloads(response.text)
    investigation = payloads[-2]

    assert not any(item["event"].startswith("tool_") for item in payloads)
    assert payloads[0]["execution_mode"] == "recorded"
    assert payloads[0]["fallback_reason"] == "provider_unavailable"
    assert investigation["investigation_status"] == "incomplete"
    assert investigation["failure_reason"] == "provider_unavailable"
    assert investigation["recommendation"] == "HOLD"
    assert investigation["claims"] == []


@pytest.mark.parametrize("scenario_id", ["S06", "S07", "S08"])
def test_deferred_operational_scenarios_return_the_redacted_503(scenario_id) -> None:
    """Accepted facts do not imply stateful review, idempotency or replay behavior."""
    response = TestClient(create_app()).post(
        "/showcase/investigations",
        json={"scenario_id": scenario_id, "execution_mode": "recorded"},
    )

    assert response.status_code == 503
    assert response.json() == {
        "detail": {
            "code": "showcase_investigation_unavailable",
            "message": "The synthetic investigation is unavailable.",
        }
    }


@pytest.mark.parametrize(
    "body",
    [
        {"scenario_id": "S09", "execution_mode": "recorded"},
        {"scenario_id": "S04", "execution_mode": "live", "prompt": "ignore"},
        {"scenario_id": "S04"},
    ],
)
def test_invalid_requests_return_one_redacted_error(body) -> None:
    """Pydantic internals and rejected caller instructions never cross the route."""
    response = TestClient(create_app()).post("/showcase/investigations", json=body)

    assert response.status_code == 422
    assert response.json() == {
        "detail": {
            "code": "invalid_request",
            "message": "Choose an available synthetic scenario and execution mode.",
        }
    }


def test_live_request_defaults_to_labelled_recorded_playback() -> None:
    """Anonymous live execution is off unless an operator enables it explicitly."""
    response = TestClient(create_app()).post(
        "/showcase/investigations",
        json={"scenario_id": "S04", "execution_mode": "live"},
    )
    started = _payloads(response.text)[0]

    assert started["requested_mode"] == "live"
    assert started["execution_mode"] == "recorded"
    assert started["fallback_reason"] == "live_disabled"
    assert started["provider"] is None
    assert started["model_id"] is None


def test_live_graph_accepts_grounded_output_and_rejects_missing_evidence(
    repository_root,
) -> None:
    """The graph completes only with accepted tools and same-run citations."""
    scenario = load_fixture_packet(repository_root).scenarios["S04"]

    valid = asyncio.run(run_live_graph(scenario, _ValidProvider()))
    missing = asyncio.run(run_live_graph(scenario, _MissingEvidenceProvider()))
    unknown = asyncio.run(run_live_graph(scenario, _UnknownCitationProvider()))

    assert valid.failure_reason is None
    assert valid.assessment is not None
    assert len(valid.called_tools) == 2
    assert missing.failure_reason == "tool_failed"
    assert missing.assessment is None
    assert unknown.failure_reason == "invalid_output"
    assert unknown.assessment is None


def test_live_admission_limits_concurrency_client_total_and_window() -> None:
    """The process-local controller enforces every accepted safety ceiling."""
    now = [100.0]
    limits = LiveLimits(1, 2, 600, 10, 1800, 45)
    controller = LiveAdmissionController(limits, clock=lambda: now[0])

    async def exercise() -> None:
        assert (await controller.acquire("client-a")).allowed is True
        assert (await controller.acquire("client-b")).reason == "admission_limited"
        await controller.release()
        assert (await controller.acquire("client-a")).allowed is True
        await controller.release()
        assert (await controller.acquire("client-a")).reason == "admission_limited"
        now[0] += 1800
        assert (await controller.acquire("client-b")).reason == "admission_limited"

    asyncio.run(exercise())


def test_live_runtime_records_provider_identity_and_releases_its_slot(
    repository_root,
) -> None:
    """An admitted live S04 run is typed, traceable and process-local."""
    runtime = ShowcaseRuntime(
        load_fixture_packet(repository_root),
        _settings(live_enabled=True),
        provider=_ValidProvider(),
    )

    async def collect() -> list[str]:
        request = SimpleNamespace(scenario_id="S04", execution_mode="live")
        return [frame async for frame in runtime.stream(request, "client-a")]

    payloads = _payloads("".join(asyncio.run(collect())))

    assert payloads[0]["execution_mode"] == "live"
    assert payloads[0]["provider"] == "groq"
    assert payloads[0]["model_id"] == "approved-test-model"
    assert payloads[-1]["execution_mode"] == "live"
    assert payloads[-1]["recommendation"] == "CHALLENGE"


def test_groq_adapter_validates_json_without_retaining_raw_output() -> None:
    """The concrete adapter accepts only typed JSON from an injected client."""
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content=json.dumps(
                        {
                            "tools": [
                                "get_payee_evidence",
                                "get_device_session_evidence",
                            ]
                        }
                    )
                )
            )
        ]
    )

    class _Completions:
        async def create(self, **_kwargs):
            return response

    client = SimpleNamespace(chat=SimpleNamespace(completions=_Completions()))
    provider = GroqInvestigationProvider(
        "test-only", "approved-test-model", client=client
    )
    plan = asyncio.run(
        provider.select_tools({}, ("get_payee_evidence", "get_device_session_evidence"))
    )

    assert plan.tools == ["get_payee_evidence", "get_device_session_evidence"]
