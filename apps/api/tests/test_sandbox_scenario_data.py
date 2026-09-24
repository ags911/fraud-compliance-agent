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
    build_dataset,
    build_scenario_datasets,
)
from server.sandbox_data.simulation import build_scenario_schedule


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

    assert [item.sequence for item in schedule] == [1, 2, 3]
    assert [item.delay_seconds for item in schedule] == [0, 3, 6]
    assert all(item.event.event_id.startswith("simulation_run-test_") for item in schedule)
    assert all(item.event.event_date == date(2026, 9, 24) for item in schedule)
    assert build_scenario_schedule("S06", date(2026, 9, 24), "run-test") == ()


def test_start_simulation_endpoint_returns_safe_run_state(monkeypatch) -> None:
    """Start a server-owned schedule without accepting a browser event body."""
    monkeypatch.setattr(
        main,
        "start_sandbox_simulation",
        lambda scenario_id: {
            "run_id": "run-test",
            "scenario_id": scenario_id,
            "fixture_version": "fixture-test",
            "seed": "sandbox-simulation-v1",
            "state": "pending",
            "scheduled_event_count": 3,
            "appended_event_count": 0,
            "next_due_at": "2026-09-24T00:00:00+00:00",
        },
    )

    response = TestClient(create_app()).post("/sandbox/scenarios/S02/simulation-runs")

    assert response.status_code == 200
    assert response.json()["scenario_id"] == "S02"
    assert response.json()["scheduled_event_count"] == 3


def test_simulation_event_stream_sends_real_sse_frames(monkeypatch) -> None:
    """Frame each state change with real line breaks so EventSource can parse it."""
    monkeypatch.setattr(
        main,
        "load_sandbox_simulation_run",
        lambda run_id: {
            "run_id": run_id,
            "scenario_id": "S02",
            "fixture_version": "fixture-test",
            "seed": "sandbox-simulation-v1",
            "state": "completed",
            "scheduled_event_count": 3,
            "appended_event_count": 3,
            "next_due_at": None,
        },
    )

    response = TestClient(create_app()).get("/sandbox/simulation-runs/run-test/events")

    assert response.status_code == 200
    assert "\\n" not in response.text
    frame = response.text.split("\n\n")[0].split("\n")
    assert frame[0] == "event: simulation_state"
    assert json.loads(frame[1].removeprefix("data: "))["appended_event_count"] == 3


def test_simulation_status_endpoint_redacts_store_unavailability(monkeypatch) -> None:
    """Keep simulation database failures free of connection details."""
    monkeypatch.setattr(
        main,
        "load_sandbox_simulation_run",
        lambda run_id: (_ for _ in ()).throw(main.SandboxDataUnavailable()),
    )

    response = TestClient(create_app()).get("/sandbox/simulation-runs/run-test")

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
        lambda scenario_id: dataset.to_analytics_response(),
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
        lambda scenario_id: (_ for _ in ()).throw(main.SandboxDataUnavailable()),
    )

    response = TestClient(create_app()).get("/sandbox/scenarios/S04/analytics")

    assert response.status_code == 503
    assert response.json() == {"detail": "sandbox_scenario_data_unavailable"}
