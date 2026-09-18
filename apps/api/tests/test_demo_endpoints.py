"""Contract tests for the demo API's simple endpoints and its CORS policy."""

import pytest
from fastapi.testclient import TestClient

from server import main
from server.main import create_app


def test_health_reports_ok() -> None:
    """Liveness is a minimal unauthenticated response with no internal detail."""
    response = TestClient(create_app()).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_scenarios_are_listed_with_unique_ids() -> None:
    """The scenario list exposes only ids and labels, never the full fixtures."""
    response = TestClient(create_app()).get("/scenarios")
    scenarios = response.json()

    assert response.status_code == 200
    assert scenarios
    assert all(set(scenario) == {"id", "label"} for scenario in scenarios)
    ids = [scenario["id"] for scenario in scenarios]
    assert len(ids) == len(set(ids))


def test_scenario_lookup_is_case_insensitive_and_bounded() -> None:
    """A known id resolves in either case; an unknown id resolves to nothing."""
    first = main.SCENARIOS[0]
    scenario_id = main._scenario_id(first)

    assert main._find_scenario(scenario_id.lower()) is first
    assert main._find_scenario(scenario_id) is first
    assert main._find_scenario("no-such-scenario") is None


def test_default_cors_origins_are_explicit_local_origins(monkeypatch) -> None:
    """The default policy never allows every origin, in line with the safety rules."""
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    origins = main._allowed_origins()

    assert origins
    assert "*" not in origins
    assert all(origin.startswith(("http://localhost", "http://127.0.0.1")) for origin in origins)


def test_configured_origins_are_trimmed_and_empty_entries_dropped(monkeypatch) -> None:
    """Deployment settings are parsed strictly: whitespace trimmed, blanks ignored."""
    monkeypatch.setenv("ALLOWED_ORIGINS", " https://a.example , ,https://b.example ,")

    assert main._allowed_origins() == ["https://a.example", "https://b.example"]


@pytest.mark.parametrize("origin", ["https://evil.example", "null"])
def test_a_foreign_origin_receives_no_cors_grant(origin, monkeypatch) -> None:
    """A browser origin outside the allowlist is not granted cross-origin access."""
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    response = TestClient(create_app()).get("/health", headers={"Origin": origin})

    assert "access-control-allow-origin" not in response.headers
