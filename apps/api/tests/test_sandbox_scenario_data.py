"""Tests for the deterministic, sanitised Sandbox scenario data slice."""

import json
import re
from datetime import date

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from scripts.import_plaid_sandbox_history import sanitise_history
from server import main
from server.main import create_app
from server.sandbox_data import service
from server.sandbox_data.service import (
    PsycopgScenarioRepository,
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


def test_replacing_a_dataset_deletes_children_before_the_parent(monkeypatch) -> None:
    """Re-importing a fixture version must not trip the dataset foreign keys."""
    queries: list[str] = []

    class RecordingCursor:
        def __enter__(self):
            return self

        def __exit__(self, *exc_info) -> None:
            return None

        def execute(self, query: str, params: object = None) -> None:
            queries.append(" ".join(query.split()))

    class RecordingConnection(RecordingCursor):
        def cursor(self) -> RecordingCursor:
            return RecordingCursor()

    monkeypatch.setattr(
        service.psycopg, "connect", lambda database_url: RecordingConnection()
    )
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
            )
        ],
    )

    PsycopgScenarioRepository("postgresql://example.invalid/db").replace_dataset(
        dataset
    )

    deleted = [q.split()[2] for q in queries if q.startswith("DELETE FROM")]
    assert deleted == [
        "sandbox_simulated_event_appends",
        "sandbox_daily_aggregates",
        "sandbox_transactions",
        "sandbox_datasets",
    ]
    first_insert = next(i for i, q in enumerate(queries) if q.startswith("INSERT"))
    assert first_insert == len(deleted)


def test_pruning_superseded_datasets_keeps_current_and_run_referenced_versions(
    monkeypatch,
) -> None:
    """Delete only superseded unreferenced versions, children before parents."""
    queries: list[tuple[str, object]] = []

    class RecordingCursor:
        def __enter__(self):
            return self

        def __exit__(self, *exc_info) -> None:
            return None

        def execute(self, query: str, params: object = None) -> None:
            queries.append((" ".join(query.split()), params))

        def fetchall(self) -> list[tuple[str]] | list[tuple[str, str]]:
            query = queries[-1][0]
            if "ranked_datasets" in query:
                # Only S04:v1 is eligible; S04:v3 is newest and S04:v2 has a run.
                return [("S04", "s04-v1")]
            if "FROM sandbox_baselines" in query:
                return [("baseline-v1",)]
            raise AssertionError(f"unexpected fetch: {query}")

    class RecordingConnection(RecordingCursor):
        def cursor(self) -> RecordingCursor:
            return RecordingCursor()

    monkeypatch.setattr(
        service.psycopg, "connect", lambda database_url: RecordingConnection()
    )

    result = PsycopgScenarioRepository(
        "postgresql://example.invalid/db"
    ).prune_superseded_datasets(apply=True)

    assert result.datasets == 1
    assert result.baselines == 1
    deleted = [query.split()[2] for query, _ in queries if query.startswith("DELETE")]
    assert deleted == [
        "sandbox_simulated_event_appends",
        "sandbox_daily_aggregates",
        "sandbox_transactions",
        "sandbox_datasets",
        "sandbox_baseline_transactions",
        "sandbox_baselines",
    ]
    # Both kinds of run reference protect a dataset: a single scenario run's
    # fixture version, and a Mixed run's per payment source (migration 0007).
    selection = next(query for query, _ in queries if "ranked_datasets" in query)
    assert "FROM sandbox_simulation_runs" in selection
    assert "event.source_fixture_version = dataset.fixture_version" in selection


def test_pruning_superseded_datasets_is_dry_run_by_default(monkeypatch) -> None:
    """Plan retention cleanup without deleting a dataset or baseline by default."""
    queries: list[str] = []

    class RecordingCursor:
        def __enter__(self):
            return self

        def __exit__(self, *exc_info) -> None:
            return None

        def execute(self, query: str, params: object = None) -> None:
            queries.append(" ".join(query.split()))

        def fetchall(self) -> list[tuple[str]] | list[tuple[str, str]]:
            if "ranked_datasets" in queries[-1]:
                return [("S04", "s04-v1")]
            return [("baseline-v1",)]

    class RecordingConnection(RecordingCursor):
        def cursor(self) -> RecordingCursor:
            return RecordingCursor()

    monkeypatch.setattr(
        service.psycopg, "connect", lambda database_url: RecordingConnection()
    )

    result = PsycopgScenarioRepository(
        "postgresql://example.invalid/db"
    ).prune_superseded_datasets()

    assert result.datasets == 1
    assert result.baselines == 1
    assert not any(query.startswith("DELETE") for query in queries)


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
    assert all(
        item.event.event_id.startswith("simulation_run-test_") for item in schedule
    )
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
        {
            "aggregate_date": date(2026, 9, 22),
            "transaction_count": 2,
            "outbound_amount_minor": 500,
            "category_counts": {"grocery": 2},
        },
        {
            "aggregate_date": date(2026, 9, 23),
            "transaction_count": 1,
            "outbound_amount_minor": 100,
            "category_counts": {"grocery": 1},
        },
    ]
    shown = [
        {
            "event_date": date(2026, 9, 23),
            "amount_minor": 140000,
            "direction": "outbound",
            "category_bucket": "high_velocity",
        },
        {
            "event_date": date(2026, 9, 23),
            "amount_minor": 140000,
            "direction": "outbound",
            "category_bucket": "high_velocity",
        },
        # Outside the dataset boundary: never invented into a new day.
        {
            "event_date": date(2026, 9, 30),
            "amount_minor": 1,
            "direction": "outbound",
            "category_bucket": "grocery",
        },
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
        lambda scenario_id, simulation_run_id=None, browser_id=None: (
            _ for _ in ()
        ).throw(main.SandboxDataUnavailable()),
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


def test_client_feed_limit_cannot_be_bypassed_by_minting_browser_ids(
    monkeypatch,
) -> None:
    """A server-derived client hits its own feed limit across fresh browser keys."""
    monkeypatch.setenv("PUBLIC_DATABASE_GUARDS_ENABLED", "true")
    monkeypatch.setenv("SHOWCASE_CLIENT_FEED_STARTS_PER_MINUTE", "2")
    monkeypatch.setattr(service, "_client_start_limiter", None)
    monkeypatch.setattr(service, "_client_start_limit", None)
    calls: list[str] = []

    def fake(scenario_id: str, browser_id: str) -> dict:
        calls.append(browser_id)
        return _run(f"run-{len(calls)}")

    monkeypatch.setattr(main, "start_sandbox_simulation", fake)
    client = TestClient(create_app())
    browser_ids = [
        "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b",
        "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "e7d9c35a-1a77-4c1e-8f57-7771e1bf9c2a",
    ]

    responses = [
        client.post(
            "/sandbox/scenarios/S02/simulation-runs",
            headers={"X-Showcase-Browser-Id": browser_id},
        )
        for browser_id in browser_ids
    ]

    assert [response.status_code for response in responses] == [200, 200, 429]
    assert responses[-1].json() == {"detail": "simulation_rate_limited"}
    assert calls == browser_ids[:2]


def test_start_simulation_maps_a_storage_ceiling_to_the_existing_503(
    monkeypatch,
) -> None:
    """A row ceiling refuses a feed start without widening the simulation contract."""
    monkeypatch.setattr(
        main,
        "admit_client_simulation_start",
        lambda client_identity: None,
    )
    monkeypatch.setattr(
        main,
        "start_sandbox_simulation",
        lambda scenario_id, browser_id: (_ for _ in ()).throw(
            main.SimulationStorageCeiling()
        ),
    )

    response = TestClient(create_app()).post(
        "/sandbox/scenarios/S02/simulation-runs", headers=OWNER
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "sandbox_scenario_data_unavailable"}


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
        lambda run_id, browser_id: (_ for _ in ()).throw(
            main.ScenarioSimulationNotFound(run_id)
        ),
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

    response = TestClient(create_app()).get(
        "/sandbox/simulation-runs/run-test", headers=OWNER
    )

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
        lambda scenario_id, simulation_run_id=None, browser_id=None: (
            dataset.to_analytics_response()
        ),
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
        lambda scenario_id, simulation_run_id=None, browser_id=None: (
            _ for _ in ()
        ).throw(main.SandboxDataUnavailable()),
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
    monkeypatch.setattr(
        worker, "sweep_sandbox_simulation_runs", lambda: swept.append(1) or 0
    )

    async def scenario() -> None:
        stop = asyncio.Event()
        task = asyncio.create_task(
            worker.run_simulation_worker(stop, poll_seconds=0.01)
        )
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


def test_feed_limits_allow_browsing_scenarios_with_the_feed_on() -> None:
    """Spec 0005 AC-8: 10 starts a minute per browser; the site cap stays 20."""
    from server.sandbox_data import service

    assert service.MAX_SIMULATION_STARTS_PER_MINUTE == 10
    assert service.MAX_LIVE_SIMULATION_RUNS == 20


# ---- Live decision routing snapshot (spec 0006) ------------------------------


class _QueuedCursor:
    """Answer each query from a queue, standing in for the database cursor."""

    def __init__(self, run: dict, events: list[dict]) -> None:
        self._one = [run, {"next_due_at": None}]
        self._events = events
        self.queries: list[str] = []

    def execute(self, query: str, params: tuple) -> None:
        self.queries.append(query)

    def fetchone(self) -> dict:
        return self._one.pop(0)

    def fetchall(self) -> list[dict]:
        return self._events


def _routing(pass_count: int = 0, challenge: int = 0, hold: int = 0) -> dict:
    def lane(outcome: str, count: int) -> dict:
        return {
            "count": count,
            "recent": [
                {
                    "event_id": f"evt-{outcome}-{index}",
                    "sequence": 100 - index,
                    "recommendation": outcome,
                    "routed_by": "rule",
                    "model_score": None,
                }
                for index in range(min(count, 18))
            ],
        }

    return {
        "by_recommendation": {
            "PASS": lane("PASS", pass_count),
            "CHALLENGE": lane("CHALLENGE", challenge),
            "HOLD": lane("HOLD", hold),
        },
        "raised_by_model": 0,
        "routing_policy": None,
    }


def test_routing_snapshot_counts_every_payment_but_lists_only_the_newest_18() -> None:
    """covers: AC 3, AC 5. Counts are never truncated; each lane lists its newest 18."""
    revealed = [
        (sequence, "HOLD" if sequence % 5 else "PASS") for sequence in range(30, 0, -1)
    ]
    events = [
        {
            "event_id": f"evt-{sequence}",
            "sequence": sequence,
            "recommendation": outcome,
            "routed_by": "rule",
            "model_score": None,
        }
        for sequence, outcome in revealed
    ]
    run = {
        **_run("run-test", "running", len(events)),
        "created_at": None,
        "started_at": None,
        "completed_at": None,
        "failure_reason": None,
    }
    cursor = _QueuedCursor(run, events)

    snapshot = PsycopgScenarioRepository.read_simulation_run_cursor(
        cursor, "run-test", BROWSER
    )["routing_snapshot"]["by_recommendation"]

    assert {outcome: lane["count"] for outcome, lane in snapshot.items()} == {
        "PASS": 6,
        "CHALLENGE": 0,
        "HOLD": 24,
    }
    assert len(snapshot["HOLD"]["recent"]) == 18
    assert [item["sequence"] for item in snapshot["HOLD"]["recent"]][:3] == [29, 28, 27]
    assert all(item["recommendation"] == "HOLD" for item in snapshot["HOLD"]["recent"])
    assert snapshot["CHALLENGE"] == {"count": 0, "recent": []}
    # Opaque items only: no amount, payee or basis leaves the store. Spec
    # 0010 adds who routed the payment and its score.
    assert set(snapshot["PASS"]["recent"][0]) == {
        "event_id",
        "sequence",
        "recommendation",
        "routed_by",
        "model_score",
    }
    # The read is one ordered query over this run's revealed payments.
    assert any(
        "appended_at IS NOT NULL" in query and "ORDER BY sequence DESC" in query
        for query in cursor.queries
    )


def test_routing_snapshot_is_empty_before_any_payment_without_a_query(
    monkeypatch,
) -> None:
    """covers: AC 5. Every outcome is present at zero before the first payment."""
    monkeypatch.setattr(service, "score_routing_policy", lambda: None)
    run = {
        **_run("run-test", "pending", 0),
        "created_at": None,
        "started_at": None,
        "completed_at": None,
        "failure_reason": None,
    }
    cursor = _QueuedCursor(run, [])

    snapshot = PsycopgScenarioRepository.read_simulation_run_cursor(
        cursor, "run-test", BROWSER
    )["routing_snapshot"]

    assert snapshot == {
        "by_recommendation": {
            outcome: {"count": 0, "recent": []}
            for outcome in ("PASS", "CHALLENGE", "HOLD")
        },
        "raised_by_model": 0,
        "routing_policy": None,
    }
    assert len(cursor.queries) == 2


def test_simulation_event_stream_carries_the_routing_snapshot(monkeypatch) -> None:
    """covers: AC 5. Each simulation_state frame includes the run's snapshot."""
    monkeypatch.setattr(
        main,
        "load_sandbox_simulation_run",
        lambda run_id, browser_id: {
            **_run(run_id, "completed", 3),
            "routing_snapshot": _routing(1, 0, 2),
        },
    )

    response = TestClient(create_app()).get(
        "/sandbox/simulation-runs/run-test/events", headers=OWNER
    )

    frame = json.loads(
        response.text.split("\n\n")[0].split("\n")[1].removeprefix("data: ")
    )
    assert frame["routing_snapshot"] == _routing(1, 0, 2)


def test_cancelling_a_run_keeps_its_routing_snapshot(monkeypatch) -> None:
    """covers: AC 7. A stopped run keeps its last snapshot, so its board does not reset to zero."""
    monkeypatch.setattr(
        main,
        "cancel_sandbox_simulation",
        lambda run_id, browser_id: {
            **_run(run_id, "cancelled", 9),
            "routing_snapshot": _routing(3, 2, 4),
        },
    )

    response = TestClient(create_app()).post(
        "/sandbox/simulation-runs/run-test/cancel", headers=OWNER
    )

    assert response.status_code == 200
    assert response.json().get("routing_snapshot") == _routing(3, 2, 4)


def _simulation_logs(caplog, name: str) -> list[str]:
    return [r.getMessage() for r in caplog.records if r.name == name]


def test_starting_a_run_logs_its_scenario_but_no_identifiers(
    monkeypatch, caplog
) -> None:
    """Spec 0003 follow-up: a started run is logged without browser or run ID."""
    caplog.set_level("INFO")
    monkeypatch.setattr(main, "start_sandbox_simulation", lambda s, b: _run())

    TestClient(create_app()).post(
        "/sandbox/scenarios/S02/simulation-runs", headers=OWNER
    )

    assert _simulation_logs(caplog, "server.main") == [
        "simulation_run_started scenario_id=S02"
    ]
    assert BROWSER not in caplog.text
    assert "run-test" not in caplog.text


def test_a_refused_start_logs_which_limit_was_hit(monkeypatch, caplog) -> None:
    """Both 429s are logged as warnings with their stable code only."""
    caplog.set_level("INFO")
    client = TestClient(create_app())
    for error in (main.SimulationBusy(), main.SimulationRateLimited(BROWSER)):
        monkeypatch.setattr(
            main,
            "start_sandbox_simulation",
            lambda s, b, error=error: (_ for _ in ()).throw(error),
        )
        client.post("/sandbox/scenarios/S02/simulation-runs", headers=OWNER)

    refused = [r for r in caplog.records if r.name == "server.main"]
    assert [r.getMessage() for r in refused] == [
        "simulation_start_refused reason=simulation_busy",
        "simulation_start_refused reason=simulation_rate_limited",
    ]
    assert all(r.levelname == "WARNING" for r in refused)
    assert BROWSER not in caplog.text


def test_the_worker_logs_sweeps_and_store_outages_once(monkeypatch, caplog) -> None:
    """A sweep logs its count; an outage warns once and its recovery is logged."""
    import asyncio

    from server.sandbox_data import worker

    caplog.set_level("INFO")
    outcomes = iter([False, False, True])

    def advance() -> int:
        if not next(outcomes, True):
            raise worker.SandboxDataUnavailable()
        return 0

    monkeypatch.setattr(worker, "advance_sandbox_simulation_events", advance)
    monkeypatch.setattr(worker, "sweep_sandbox_simulation_runs", lambda: 4)
    monkeypatch.setattr(worker, "sweep_expired_showcase_cases", lambda: 3)

    async def scenario() -> None:
        stop = asyncio.Event()
        task = asyncio.create_task(
            worker.run_simulation_worker(stop, poll_seconds=0.01)
        )
        await asyncio.sleep(0.08)
        stop.set()
        await asyncio.wait_for(task, timeout=1)

    asyncio.run(scenario())
    assert _simulation_logs(caplog, "server.sandbox_data.worker") == [
        "simulation_worker_store_unavailable",
        "simulation_worker_store_recovered",
        "simulation_runs_swept count=4",
        "showcase_cases_swept count=3",
    ]


SIMULATION_CONTRACT = "docs/contracts/sandbox-simulation.v1.1.openapi.json"


def _simulation_contract(repository_root) -> dict:
    return json.loads(
        (repository_root / SIMULATION_CONTRACT).read_text(encoding="utf-8")
    )


def test_run_responses_match_the_simulation_contract(
    monkeypatch, repository_root
) -> None:
    """Start, status and cancel bodies, with and without a snapshot, fit the contract."""
    contract = _simulation_contract(repository_root)
    validator = Draft202012Validator(
        {
            "$ref": "#/components/schemas/SimulationRun",
            "components": contract["components"],
        }
    )
    mixed = {**_run(), "scenario_id": "MIX", "fixture_version": None}
    monkeypatch.setattr(main, "start_sandbox_simulation", lambda s, b: mixed)
    monkeypatch.setattr(
        main,
        "cancel_sandbox_simulation",
        lambda r, b: {**_run(r, "cancelled", 9), "routing_snapshot": _routing(3, 2, 4)},
    )
    client = TestClient(create_app())

    bodies = [
        client.post("/sandbox/scenarios/MIX/simulation-runs", headers=OWNER).json(),
        client.post("/sandbox/simulation-runs/run-test/cancel", headers=OWNER).json(),
    ]

    for body in bodies:
        assert list(validator.iter_errors(body)) == []


def test_every_simulation_error_code_is_in_the_contract(
    repository_root,
) -> None:
    """A route may only answer with a code the contract lists."""
    listed = set(
        _simulation_contract(repository_root)["components"]["schemas"]["Error"][
            "properties"
        ]["detail"]["enum"]
    )
    source = (repository_root / "apps/api/server/main.py").read_text(encoding="utf-8")
    # Every simulation and Sandbox code the routes raise, plus the header check.
    used = {
        code
        for code in re.findall(r'detail="([a-z_]+)"', source)
        if code.startswith(("sandbox_", "simulation_")) or code == "invalid_browser_id"
    }

    assert used == listed
