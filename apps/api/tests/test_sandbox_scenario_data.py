"""Tests for the deterministic, sanitised Sandbox scenario data slice."""

import json
from datetime import date

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from scripts.import_plaid_sandbox_history import sanitise_history
from server import main
from server.main import create_app
from server.sandbox_data.service import (
    SanitisedEvent,
    _overlay_shown_events,
    build_dataset,
    build_scenario_datasets,
)
from server.sandbox_data.simulation import (
    FEED_EVENT_COUNT,
    FEED_INTERVAL_SECONDS,
    build_scenario_schedule,
)


def test_dataset_builder_preserves_date_precision_and_derived_history() -> None:
    """Build only permitted features and never invent an intraday timestamp."""
    dataset = build_dataset(
        scenario_id="S04",
        fixture_version="s04-test-v1",
        creation_revision="test",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 2),
        events=[
            SanitisedEvent(
                date(2026, 9, 1),
                date(2026, 9, 1),
                1000,
                "GBP",
                "outbound",
                "grocery",
                "payee_a",
                "card",
            ),
            SanitisedEvent(
                date(2026, 9, 2),
                date(2026, 9, 2),
                3000,
                "GBP",
                "outbound",
                "grocery",
                "payee_a",
                "card",
            ),
        ],
    )

    second_features = dataset.transactions[1].feature_snapshot
    assert second_features["event_hour_utc"] is None
    assert second_features["event_hour_utc_availability"] == "unavailable"
    assert second_features["prior_transaction_count"] == 1
    assert second_features["prior_mean_amount_minor"] == 1000
    assert second_features["payee_prior_count"] == 1
    assert dataset.daily_aggregates[1].outbound_amount_minor == 3000


def test_dataset_builder_persists_zero_activity_calendar_days() -> None:
    """Include zero activity days so charts never infer missing dates as absent data."""
    dataset = build_dataset(
        scenario_id="S04",
        fixture_version="s04-test-v1",
        creation_revision="test",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
        events=[
            SanitisedEvent(
                date(2026, 9, 1),
                date(2026, 9, 1),
                1000,
                "GBP",
                "outbound",
                "grocery",
                "payee_a",
                "card",
            ),
        ],
    )

    assert [aggregate.to_wire() for aggregate in dataset.daily_aggregates] == [
        {
            "date": "2026-09-01",
            "transaction_count": 1,
            "outbound_amount_minor": 1000,
            "category_counts": {"grocery": 1},
        },
        {
            "date": "2026-09-02",
            "transaction_count": 0,
            "outbound_amount_minor": 0,
            "category_counts": {},
        },
        {
            "date": "2026-09-03",
            "transaction_count": 0,
            "outbound_amount_minor": 0,
            "category_counts": {},
        },
    ]


def test_scenario_overlays_create_isolated_s01_to_s08_datasets(repository_root) -> None:
    """Derive eight fixture scoped timelines from one common sanitised baseline."""
    packet = json.loads(
        (repository_root / "fixtures/s01-s08/scenarios.v1.json").read_text(
            encoding="utf-8"
        )
    )
    datasets = build_scenario_datasets(
        baseline_version="plaid-sandbox-test",
        creation_revision="test",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 2),
        baseline_events=[
            SanitisedEvent(
                date(2026, 9, 1),
                date(2026, 9, 1),
                1000,
                "GBP",
                "outbound",
                "grocery",
                "payee_a",
                "card",
            )
        ],
        scenario_packet=packet,
    )

    assert [dataset.scenario_id for dataset in datasets] == [
        f"S0{index}" for index in range(1, 9)
    ]
    assert all(len(dataset.daily_aggregates) == 2 for dataset in datasets)
    assert len(datasets[0].transactions) == 2
    assert len(datasets[5].transactions) == 1
    assert datasets[0].baseline_version == "plaid-sandbox-test"


def test_plaid_history_sanitisation_never_retains_raw_provider_identity() -> None:
    """Reduce Plaid transaction fields to an opaque event and payee reference."""
    events = sanitise_history(
        [
            {
                "transaction_id": "provider-transaction-id",
                "date": "2026-09-01",
                "authorized_date": "2026-09-01",
                "amount": 12.34,
                "iso_currency_code": "GBP",
                "merchant_name": "Raw Merchant Name",
                "name": "Raw statement description",
                "payment_channel": "online",
                "personal_finance_category": {"primary": "FOOD_AND_DRINK"},
            }
        ],
        "test-pseudonymisation-key",
    )

    assert len(events) == 1
    assert events[0].event_id is not None
    assert events[0].payee_reference.startswith("payee_")
    assert "Raw Merchant Name" not in repr(events[0])
    assert "provider-transaction-id" not in repr(events[0])


def test_transaction_schedules_are_deterministic_and_skip_workflow_scenarios() -> None:
    """Keep payment schedules scoped to transaction-shaped accepted scenarios."""
    schedule = build_scenario_schedule("S02", date(2026, 9, 24), "run-test")

    assert len(schedule) == FEED_EVENT_COUNT == 200
    assert [item.sequence for item in schedule[:3]] == [1, 2, 3]
    assert [item.delay_seconds for item in schedule[:3]] == [0, 3, 6]
    assert schedule[-1].delay_seconds == (FEED_EVENT_COUNT - 1) * FEED_INTERVAL_SECONDS
    assert all(item.event.event_id.startswith("simulation_run-test_") for item in schedule)
    assert all(item.event.event_date == date(2026, 9, 24) for item in schedule)
    assert build_scenario_schedule("S06", date(2026, 9, 24), "run-test") == ()


def test_feed_amounts_vary_but_repeat_for_the_same_position() -> None:
    """A run position always yields the same payment, within 30% of typical."""
    first = build_scenario_schedule("S04", date(2026, 9, 23), "run-a")
    second = build_scenario_schedule("S04", date(2026, 9, 23), "run-b")

    amounts = [item.event.amount_minor for item in first]
    assert amounts == [item.event.amount_minor for item in second]
    assert len(set(amounts)) > 1
    assert all(0.7 * 26500 <= amount <= 1.3 * 26500 for amount in amounts)
    assert all(item.event.amount_minor >= 0 for item in first)


def test_shown_feed_events_are_added_to_the_base_aggregates_only() -> None:
    """Overlay counts, outbound amounts and categories without changing the base."""
    base = [
        {"aggregate_date": date(2026, 9, 22), "transaction_count": 2, "outbound_amount_minor": 500, "category_counts": {"grocery": 2}},
        {"aggregate_date": date(2026, 9, 23), "transaction_count": 1, "outbound_amount_minor": 100, "category_counts": {"grocery": 1}},
    ]
    shown = [
        {"event_date": date(2026, 9, 23), "amount_minor": 140000, "direction": "outbound", "category_bucket": "high_velocity"},
        {"event_date": date(2026, 9, 23), "amount_minor": 140000, "direction": "outbound", "category_bucket": "high_velocity"},
        # Outside the dataset boundary: never invented into a new day.
        {"event_date": date(2026, 9, 30), "amount_minor": 1, "direction": "outbound", "category_bucket": "grocery"},
    ]

    overlaid = _overlay_shown_events(base, shown)

    assert overlaid[0] == base[0]
    assert overlaid[1]["transaction_count"] == 3
    assert overlaid[1]["outbound_amount_minor"] == 280100
    assert overlaid[1]["category_counts"] == {"grocery": 1, "high_velocity": 2}
    # The stored base rows are not mutated.
    assert base[1]["transaction_count"] == 1
    assert base[1]["category_counts"] == {"grocery": 1}


BROWSER = "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b"
OWNER = {"X-Showcase-Browser-Id": BROWSER}


def _run(run_id: str = "run-test", state: str = "pending", appended: int = 0) -> dict:
    return {
        "run_id": run_id,
        "scenario_id": "S02",
        "fixture_version": "fixture-test",
        "seed": "sandbox-simulation-v1",
        "state": state,
        "scheduled_event_count": 200,
        "appended_event_count": appended,
        "next_due_at": "2026-09-24T00:00:00+00:00",
    }


def test_analytics_endpoint_passes_the_run_and_its_owner(monkeypatch) -> None:
    """Read the base plus one run for its own browser, and 404 any other run."""
    calls = []

    def fake(scenario_id, simulation_run_id=None, browser_id=None):
        calls.append((scenario_id, simulation_run_id, browser_id))
        raise main.ScenarioSimulationNotFound(simulation_run_id)

    monkeypatch.setattr(main, "load_sandbox_analytics", fake)

    response = TestClient(create_app()).get(
        "/sandbox/scenarios/S02/analytics?simulation_run_id=run-other", headers=OWNER
    )

    assert calls == [("S02", "run-other", BROWSER)]
    assert response.status_code == 404
    assert response.json() == {"detail": "sandbox_simulation_not_found"}


def test_run_analytics_need_a_browser_id_but_the_base_does_not(monkeypatch) -> None:
    """Keep the plain base readable while a run overlay is scoped to its owner."""
    monkeypatch.setattr(
        main,
        "load_sandbox_analytics",
        lambda scenario_id, simulation_run_id=None, browser_id=None: (_ for _ in ()).throw(
            main.SandboxDataUnavailable()
        ),
    )
    client = TestClient(create_app())

    assert client.get("/sandbox/scenarios/S02/analytics").status_code == 503
    missing = client.get("/sandbox/scenarios/S02/analytics?simulation_run_id=run-test")
    assert missing.status_code == 400
    assert missing.json() == {"detail": "invalid_browser_id"}


def test_every_simulation_route_rejects_a_missing_or_malformed_browser_id() -> None:
    """Refuse before touching the store, and never echo the bad value."""
    client = TestClient(create_app())
    calls = [
        ("post", "/sandbox/scenarios/S02/simulation-runs"),
        ("get", "/sandbox/simulation-runs/run-test"),
        ("post", "/sandbox/simulation-runs/run-test/cancel"),
        ("get", "/sandbox/simulation-runs/run-test/events"),
    ]
    for method, path in calls:
        for headers in ({}, {"X-Showcase-Browser-Id": "NOT-A-UUID"}):
            response = getattr(client, method)(path, headers=headers)
            assert response.status_code == 400, (method, path, headers)
            assert response.json() == {"detail": "invalid_browser_id"}
            assert "NOT-A-UUID" not in response.text


def test_cancel_simulation_endpoint_stops_the_callers_run(monkeypatch) -> None:
    """Stop a run for its owner through the internal route without a body."""
    calls = []

    def fake(run_id, browser_id):
        calls.append((run_id, browser_id))
        return _run(run_id, "cancelled", 12)

    monkeypatch.setattr(main, "cancel_sandbox_simulation", fake)

    response = TestClient(create_app()).post(
        "/sandbox/simulation-runs/run-test/cancel", headers=OWNER
    )

    assert calls == [("run-test", BROWSER)]
    assert response.status_code == 200
    assert response.json()["state"] == "cancelled"
    assert response.json()["appended_event_count"] == 12


def test_start_simulation_endpoint_returns_safe_run_state(monkeypatch) -> None:
    """Start a run owned by the caller and expose only safe run state."""
    calls = []

    def fake(scenario_id, browser_id):
        calls.append((scenario_id, browser_id))
        return _run()

    monkeypatch.setattr(main, "start_sandbox_simulation", fake)

    response = TestClient(create_app()).post(
        "/sandbox/scenarios/S02/simulation-runs", headers=OWNER
    )

    assert calls == [("S02", BROWSER)]
    assert response.status_code == 200
    assert response.json()["scenario_id"] == "S02"
    assert response.json()["scheduled_event_count"] == 200
    assert BROWSER not in response.text


def test_start_simulation_endpoint_maps_both_limits_to_429(monkeypatch) -> None:
    """Say which limit was hit with a stable code, and create nothing."""
    client = TestClient(create_app())
    for error, code in (
        (main.SimulationBusy(), "simulation_busy"),
        (main.SimulationRateLimited(BROWSER), "simulation_rate_limited"),
    ):
        monkeypatch.setattr(
            main,
            "start_sandbox_simulation",
            lambda scenario_id, browser_id, error=error: (_ for _ in ()).throw(error),
        )
        response = client.post("/sandbox/scenarios/S02/simulation-runs", headers=OWNER)
        assert response.status_code == 429
        assert response.json() == {"detail": code}
        assert BROWSER not in response.text


def test_simulation_event_stream_sends_real_sse_frames(monkeypatch) -> None:
    """Frame each state change with real line breaks, for a fetch based reader."""
    calls = []

    def fake(run_id, browser_id):
        calls.append((run_id, browser_id))
        return _run(run_id, "completed", 200)

    monkeypatch.setattr(main, "load_sandbox_simulation_run", fake)

    response = TestClient(create_app()).get(
        "/sandbox/simulation-runs/run-test/events", headers=OWNER
    )

    assert response.status_code == 200
    assert calls == [("run-test", BROWSER)]
    assert "\\n" not in response.text
    frame = response.text.split("\n\n")[0].split("\n")
    assert frame[0] == "event: simulation_state"
    assert json.loads(frame[1].removeprefix("data: "))["appended_event_count"] == 200


def test_simulation_event_stream_is_404_for_another_browsers_run(monkeypatch) -> None:
    """Check ownership before streaming, so no empty 200 stream is returned."""
    monkeypatch.setattr(
        main,
        "load_sandbox_simulation_run",
        lambda run_id, browser_id: (_ for _ in ()).throw(main.ScenarioSimulationNotFound(run_id)),
    )

    response = TestClient(create_app()).get(
        "/sandbox/simulation-runs/run-test/events", headers=OWNER
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "sandbox_simulation_not_found"}


def test_simulation_status_endpoint_redacts_store_unavailability(monkeypatch) -> None:
    """Keep simulation database failures free of connection details."""
    monkeypatch.setattr(
        main,
        "load_sandbox_simulation_run",
        lambda run_id, browser_id: (_ for _ in ()).throw(main.SandboxDataUnavailable()),
    )

    response = TestClient(create_app()).get("/sandbox/simulation-runs/run-test", headers=OWNER)

    assert response.status_code == 503
    assert response.json() == {"detail": "sandbox_scenario_data_unavailable"}


def test_s04_fixture_is_validated_by_the_sanitised_dataset_contract(
    repository_root,
) -> None:
    """Keep committed inputs restricted to the approved sanitised field set."""
    schema = json.loads(
        (
            repository_root / "docs/contracts/sandbox-scenario-dataset.v1.schema.json"
        ).read_text(encoding="utf-8")
    )
    fixture = json.loads(
        (repository_root / "fixtures/sandbox/s04.dataset.v1.json").read_text(
            encoding="utf-8"
        )
    )

    Draft202012Validator(schema).validate(fixture)


def test_analytics_endpoint_returns_only_sanitised_aggregates(
    monkeypatch, repository_root
) -> None:
    """Expose scenario scoped dashboard data without provider or raw transaction facts."""
    dataset = build_dataset(
        scenario_id="S04",
        fixture_version="s04-test-v1",
        creation_revision="test",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 1),
        events=[
            SanitisedEvent(
                date(2026, 9, 1),
                date(2026, 9, 1),
                1000,
                "GBP",
                "outbound",
                "grocery",
                "payee_a",
                "card",
            ),
        ],
    )
    monkeypatch.setattr(
        main,
        "load_sandbox_analytics",
        lambda scenario_id, simulation_run_id=None, browser_id=None: dataset.to_analytics_response(),
    )

    response = TestClient(create_app()).get("/sandbox/scenarios/S04/analytics")

    assert response.status_code == 200
    assert response.json()["scenario_id"] == "S04"
    assert response.json()["daily_aggregates"] == [
        {
            "date": "2026-09-01",
            "transaction_count": 1,
            "outbound_amount_minor": 1000,
            "category_counts": {"grocery": 1},
        }
    ]
    assert response.json()["baseline_version"] == "fixture-only"
    assert response.json()["overlay_version"] == "fixture-only"
    assert "payee_reference" not in response.text
    schema = json.loads(
        (
            repository_root / "docs/contracts/sandbox-scenario-analytics.v1.schema.json"
        ).read_text(encoding="utf-8")
    )
    Draft202012Validator(schema).validate(response.json())


def test_analytics_endpoint_redacts_database_unavailability(monkeypatch) -> None:
    """Never disclose a connection string or driver error to the browser."""
    monkeypatch.setattr(
        main,
        "load_sandbox_analytics",
        lambda scenario_id, simulation_run_id=None, browser_id=None: (_ for _ in ()).throw(
            main.SandboxDataUnavailable()
        ),
    )

    response = TestClient(create_app()).get("/sandbox/scenarios/S04/analytics")

    assert response.status_code == 503
    assert response.json() == {"detail": "sandbox_scenario_data_unavailable"}


def test_in_process_worker_advances_until_stopped(monkeypatch) -> None:
    """Poll the schedule, survive an unavailable store, and stop on shutdown."""
    import asyncio

    from server.sandbox_data import worker

    calls = []

    def advance() -> int:
        calls.append(1)
        if len(calls) == 1:
            raise worker.SandboxDataUnavailable()
        return 1

    swept = []
    monkeypatch.setattr(worker, "advance_sandbox_simulation_events", advance)
    monkeypatch.setattr(worker, "sweep_sandbox_simulation_runs", lambda: swept.append(1) or 0)

    async def scenario() -> None:
        stop = asyncio.Event()
        task = asyncio.create_task(worker.run_simulation_worker(stop, poll_seconds=0.01))
        await asyncio.sleep(0.08)
        stop.set()
        await asyncio.wait_for(task, timeout=1)

    asyncio.run(scenario())
    assert len(calls) >= 2
    # The sweep runs once on start (after the first successful poll), then hourly.
    assert swept == [1]


def test_api_starts_no_worker_unless_enabled(monkeypatch) -> None:
    """Keep the public, database free API free of any background worker."""
    started = []

    async def fake_worker(stop) -> None:
        started.append(1)
        await stop.wait()

    monkeypatch.setattr(main, "run_simulation_worker", fake_worker)
    monkeypatch.delenv("SIMULATION_WORKER_ENABLED", raising=False)
    with TestClient(create_app()):
        pass
    assert started == []

    monkeypatch.setenv("SIMULATION_WORKER_ENABLED", "true")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example.invalid/db")
    with TestClient(create_app()):
        pass
    assert started == [1]
