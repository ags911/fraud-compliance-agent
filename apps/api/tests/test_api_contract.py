"""The frozen showcase API contract, and the app's agreement with it.

`docs/contracts/demo-api.v1.openapi.json` is the accepted description of the
current demo routes, and `docs/contracts/demo-run-events.v1.schema.json`
describes the streamed events, which OpenAPI cannot express. A route that drifts
from either one is a contract change: regenerate with `make api-contract`, and
change the version and the consumers deliberately.
"""

import json

import pytest
from fastapi.testclient import TestClient

from server import main
from server.main import create_app

OPENAPI_CONTRACT = "docs/contracts/demo-api.v1.openapi.json"
EVENTS_CONTRACT = "docs/contracts/demo-run-events.v1.schema.json"

requires_sdk = pytest.mark.skipif(
    not main.SCENARIOS, reason="the private SDK submodule is not initialised"
)


@pytest.fixture(scope="module")
def frozen_openapi(repository_root) -> dict:
    """Return the committed OpenAPI contract."""
    return json.loads((repository_root / OPENAPI_CONTRACT).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def event_schema(repository_root) -> dict:
    """Return the committed streamed-event schema."""
    return json.loads((repository_root / EVENTS_CONTRACT).read_text(encoding="utf-8"))


def test_the_application_matches_the_frozen_contract(frozen_openapi) -> None:
    """The running app describes exactly what the accepted contract describes."""
    generated = create_app().openapi()

    assert generated == frozen_openapi, (
        "The API no longer matches docs/contracts/demo-api.v1.openapi.json. "
        "Run `make api-contract` and review the change as a contract change."
    )


def test_the_contract_declares_its_version_and_scope(frozen_openapi) -> None:
    """A reader can tell what is accepted, and what the routes may not do."""
    info = frozen_openapi["info"]

    assert info["version"]
    assert info["x-contract-version"] == "1.0"
    assert info["x-approval-status"] == "accepted"
    assert "synthetic" in info["x-scope"].lower()
    assert any("payment" in rule.lower() for rule in info["x-prohibitions"])


def test_every_route_is_described(frozen_openapi) -> None:
    """A new route is a contract change, not an accident."""
    assert set(frozen_openapi["paths"]) == {
        "/health",
        "/scenarios",
        "/demo/model-summary",
        "/run",
        "/run/preset/{scenario_id}",
    }


def test_the_streaming_routes_declare_their_media_type_and_errors(
    frozen_openapi,
) -> None:
    """The console needs to know it is an event stream, and what can fail."""
    for path in ("/run", "/run/preset/{scenario_id}"):
        responses = frozen_openapi["paths"][path]["post"]["responses"]
        assert "text/event-stream" in responses["200"]["content"]
        assert "503" in responses


def test_the_error_envelope_is_described(frozen_openapi) -> None:
    """Every failure the console can receive has one documented shape."""
    error = frozen_openapi["components"]["schemas"]["DemoError"]

    assert error["properties"]["detail"]["enum"] == [
        "demo_pipeline_unavailable",
        "demo_model_summary_unavailable",
    ]

    preset_errors = frozen_openapi["paths"]["/run/preset/{scenario_id}"]["post"][
        "responses"
    ]
    assert "404" in preset_errors
    assert "422" in preset_errors


def test_the_event_schema_covers_the_three_event_kinds(event_schema) -> None:
    """Node progress, a redacted error, and exactly one terminal event."""
    assert set(event_schema["$defs"]) >= {"nodeEvent", "errorEvent", "doneEvent"}
    categories = event_schema["$defs"]["errorEvent"]["properties"]["error"]["enum"]
    assert categories == ["processing_timeout", "processing_failed"]
    assert "exactly one" in event_schema["description"].lower()
    assert event_schema["x-approval-status"] == "accepted"
    assert event_schema["x-contract-version"] == "1.0"


def test_health_matches_its_documented_shape(frozen_openapi) -> None:
    """The liveness response is typed, not an untyped dictionary."""
    schema = frozen_openapi["components"]["schemas"]["HealthResponse"]
    response = TestClient(create_app()).get("/health")

    assert response.status_code == 200
    assert set(response.json()) == set(schema["properties"])
    assert response.json()["status"] == schema["properties"]["status"]["const"]


@requires_sdk
def test_scenarios_match_their_documented_shape(frozen_openapi) -> None:
    """Each listed scenario carries exactly the documented fields."""
    schema = frozen_openapi["components"]["schemas"]["ScenarioSummary"]
    scenarios = TestClient(create_app()).get("/scenarios").json()

    assert scenarios
    for scenario in scenarios:
        assert set(scenario) == set(schema["properties"])


def test_the_error_envelope_is_what_a_failing_route_returns(monkeypatch) -> None:
    """The documented enum is the value the console actually receives."""
    monkeypatch.setattr(main, "pipeline", None)

    response = TestClient(create_app()).get("/scenarios")

    assert response.status_code == 503
    assert response.json() == {"detail": "demo_pipeline_unavailable"}
