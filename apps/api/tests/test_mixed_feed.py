"""The Mixed feed (spec 0008): S01 to S05 payments in one run.

These tests need no database. Run start, reveal and the overlay ownership
check run against scripted cursors, as in ``test_feed_decisions``.
"""

from collections import Counter
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server import main
from server.main import create_app
from server.sandbox_data import service
from server.sandbox_data.decisions import feed_decision
from server.sandbox_data.service import (
    MIXED_FEED_ID,
    MIXED_FEED_SOURCES,
    PsycopgScenarioRepository,
    ScenarioDatasetNotFound,
    ScenarioSimulationNotFound,
)
from server.sandbox_data.simulation import (
    FEED_EVENT_COUNT,
    build_mixed_schedule,
    build_scenario_schedule,
)
from server.showcase_cases.capture import EventValidator
from server.showcase_cases.repository import PsycopgCaseRepository

RUN_ID = "3f2a9c1e-7b4d-4e8b-9f3a-2c5d8e1f4a6b"
BROWSER = "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b"
OWNER = {"X-Showcase-Browser-Id": BROWSER}
LATEST = {
    source: date(2026, 9, 18 + index) for index, source in enumerate(MIXED_FEED_SOURCES)
}
VERSIONS = {source: f"{source.lower()}-fixture-v1" for source in MIXED_FEED_SOURCES}


class RecordingCursor:
    """Answer each fetchone from a queue, and record every statement."""

    def __init__(self, answers: list) -> None:
        self.answers = list(answers)
        self.statements: list[tuple[str, tuple]] = []
        self.batches: list[tuple[str, list]] = []

    def execute(self, query, parameters=()) -> None:
        self.statements.append((" ".join(str(query).split()), parameters))

    def executemany(self, query, rows) -> None:
        self.batches.append((" ".join(str(query).split()), list(rows)))

    def fetchone(self):
        return self.answers.pop(0)

    def __enter__(self):
        return self

    def __exit__(self, *exc) -> None:
        return None


class RecordingConnection:
    def __init__(self, cursor: RecordingCursor) -> None:
        self._cursor = cursor

    def cursor(self) -> RecordingCursor:
        return self._cursor

    def __enter__(self):
        return self

    def __exit__(self, *exc) -> None:
        return None


# ---- The schedule (AC 2) ----------------------------------------------------


def test_every_block_of_five_holds_one_payment_from_each_source() -> None:
    schedule = build_mixed_schedule(LATEST, RUN_ID)

    assert len(schedule) == FEED_EVENT_COUNT
    assert Counter(item.source_scenario_id for item in schedule) == dict.fromkeys(
        MIXED_FEED_SOURCES, FEED_EVENT_COUNT // 5
    )
    for start in range(0, FEED_EVENT_COUNT, 5):
        block = {item.source_scenario_id for item in schedule[start : start + 5]}
        assert block == set(MIXED_FEED_SOURCES)
    assert [item.sequence for item in schedule] == list(range(1, FEED_EVENT_COUNT + 1))


def test_the_mix_repeats_for_the_same_seed_and_changes_with_another() -> None:
    order = [item.source_scenario_id for item in build_mixed_schedule(LATEST, RUN_ID)]

    assert order == [
        item.source_scenario_id for item in build_mixed_schedule(LATEST, "other-run")
    ]
    assert order != [
        item.source_scenario_id
        for item in build_mixed_schedule(LATEST, RUN_ID, seed="another-seed")
    ]


def test_each_payment_is_its_source_scenarios_own_payment_at_that_position() -> None:
    """No new shape or amount: position n is what that scenario's feed gives at n."""
    for item in build_mixed_schedule(LATEST, RUN_ID)[:20]:
        source = item.source_scenario_id
        expected = build_scenario_schedule(source, LATEST[source], RUN_ID)[
            item.sequence - 1
        ]
        assert item.event == expected.event
        assert item.delay_seconds == expected.delay_seconds
        assert item.event.event_date == LATEST[source]


# ---- Run start (AC 2, AC 3, AC 4) ---------------------------------------------


def _mixed_run_row() -> dict:
    return {
        "run_id": RUN_ID,
        "scenario_id": MIXED_FEED_ID,
        "fixture_version": None,
        "seed": "sandbox-simulation-v1",
        "state": "pending",
        "scheduled_event_count": 10,
        "appended_event_count": 0,
    }


def test_a_mixed_run_has_no_fixture_version_and_each_payment_names_its_source(
    monkeypatch,
) -> None:
    cursor = RecordingCursor(
        [
            *({"fixture_version": VERSIONS[source]} for source in MIXED_FEED_SOURCES),
            {"starts": 0},
            {"live": 0},
            _mixed_run_row(),
            {"next_due_at": None},
        ]
    )
    monkeypatch.setattr(
        service.psycopg, "connect", lambda *args, **kwargs: RecordingConnection(cursor)
    )
    schedule = build_mixed_schedule(LATEST, RUN_ID, event_count=10)

    run = PsycopgScenarioRepository("postgresql://example/db").create_simulation_run(
        MIXED_FEED_ID, RUN_ID, "sandbox-simulation-v1", schedule, BROWSER
    )

    [insert_run] = [
        item
        for item in cursor.statements
        if item[0].startswith("INSERT INTO sandbox_simulation_runs")
    ]
    assert insert_run[1][1:3] == (MIXED_FEED_ID, None)
    [(query, rows)] = cursor.batches
    assert "source_scenario_id, source_fixture_version, deterministic_route" in query
    for item, row in zip(schedule, rows, strict=True):
        decision = feed_decision(item.source_scenario_id)
        # The last five columns: source, its fixture version, then its decision.
        assert row[-5:] == (
            item.source_scenario_id,
            VERSIONS[item.source_scenario_id],
            decision.deterministic_route,
            decision.recommendation,
            decision.recommendation_basis,
        )
    assert {row[-3] for row in rows} >= {"PASS", "HOLD", "INVESTIGATE"}
    assert run["scenario_id"] == MIXED_FEED_ID
    assert run["fixture_version"] is None


def test_a_single_scenario_run_records_no_source(monkeypatch) -> None:
    """A single scenario run is unchanged: its events belong to its own dataset."""
    cursor = RecordingCursor(
        [
            {"fixture_version": "fixture-test"},
            {"starts": 0},
            {"live": 0},
            {
                **_mixed_run_row(),
                "scenario_id": "S02",
                "fixture_version": "fixture-test",
            },
            {"next_due_at": None},
        ]
    )
    monkeypatch.setattr(
        service.psycopg, "connect", lambda *args, **kwargs: RecordingConnection(cursor)
    )

    PsycopgScenarioRepository("postgresql://example/db").create_simulation_run(
        "S02",
        RUN_ID,
        "sandbox-simulation-v1",
        build_scenario_schedule("S02", date(2026, 9, 23), RUN_ID, event_count=3),
        BROWSER,
    )

    [(_, rows)] = cursor.batches
    assert {row[-5:-3] for row in rows} == {(None, None)}
    assert {row[-2] for row in rows} == {"HOLD"}


def test_a_mixed_run_needs_every_source_dataset(monkeypatch) -> None:
    cursor = RecordingCursor(
        [
            {"fixture_version": VERSIONS["S01"]},
            {"fixture_version": VERSIONS["S02"]},
            None,
        ]
    )
    monkeypatch.setattr(
        service.psycopg, "connect", lambda *args, **kwargs: RecordingConnection(cursor)
    )

    with pytest.raises(ScenarioDatasetNotFound):
        PsycopgScenarioRepository("postgresql://example/db").create_simulation_run(
            MIXED_FEED_ID, RUN_ID, "sandbox-simulation-v1", (), BROWSER
        )
    assert cursor.batches == []


def test_start_builds_the_mixed_schedule_from_each_sources_latest_day(
    monkeypatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")
    created: list = []

    def read_analytics(self, scenario_id, *args):
        return {"time_boundary": {"end_date": LATEST[scenario_id].isoformat()}}

    def create(self, scenario_id, run_id, seed, schedule, browser_id):
        created.append((scenario_id, schedule, browser_id))
        return _mixed_run_row()

    monkeypatch.setattr(PsycopgScenarioRepository, "read_analytics", read_analytics)
    monkeypatch.setattr(PsycopgScenarioRepository, "create_simulation_run", create)

    service.start_sandbox_simulation(MIXED_FEED_ID, BROWSER)

    [(scenario_id, schedule, browser_id)] = created
    assert (scenario_id, browser_id) == (MIXED_FEED_ID, BROWSER)
    assert len(schedule) == FEED_EVENT_COUNT
    assert {item.event.event_date for item in schedule} == set(LATEST.values())


def test_start_endpoint_accepts_mix_and_reports_no_fixture_version(monkeypatch) -> None:
    calls = []

    def fake(scenario_id, browser_id):
        calls.append(scenario_id)
        return {**_mixed_run_row(), "scheduled_event_count": 200, "next_due_at": None}

    monkeypatch.setattr(main, "start_sandbox_simulation", fake)

    response = TestClient(create_app()).post(
        "/sandbox/scenarios/MIX/simulation-runs", headers=OWNER
    )

    assert calls == [MIXED_FEED_ID]
    assert response.status_code == 200
    assert response.json()["scenario_id"] == MIXED_FEED_ID
    assert response.json()["fixture_version"] is None


# ---- Reveal and overlays (AC 3, AC 5) -----------------------------------------


class ScriptedCursor:
    """Answer the reveal's one SELECT, and record every statement after it."""

    def __init__(self, event: dict | None) -> None:
        self.event = event
        self.statements: list[tuple[str, tuple]] = []

    def execute(self, query, parameters=()) -> None:
        self.statements.append((" ".join(str(query).split()), parameters))

    def fetchone(self):
        return self.event


def test_a_mixed_payment_saves_its_case_under_its_source_scenario(
    monkeypatch, repository_root: Path
) -> None:
    saved: list = []
    monkeypatch.setattr(
        PsycopgCaseRepository,
        "insert_case",
        staticmethod(lambda cursor, record, browser_id: saved.append(record) or True),
    )
    decision = feed_decision("S04")
    # The reveal's SELECT resolves the scenario as COALESCE(source, run).
    cursor = ScriptedCursor(
        {
            "due_at": datetime(2026, 9, 23, 12, 0, 7, tzinfo=UTC),
            "deterministic_route": decision.deterministic_route,
            "recommendation": decision.recommendation,
            "recommendation_basis": decision.recommendation_basis,
            "model_score": None,
            "model_version": None,
            "case_id": None,
            "scenario_id": "S04",
            "browser_id": BROWSER,
        }
    )
    validator = EventValidator(
        repository_root / "docs/contracts/public-showcase-events.v1.schema.json"
    )

    assert PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 4, validator) == 1

    assert (
        "COALESCE(event.source_scenario_id, run.scenario_id) AS scenario_id"
        in cursor.statements[0][0]
    )
    [record] = saved
    assert record.scenario_id == "S04"


@pytest.mark.parametrize("scenario_id", MIXED_FEED_SOURCES)
def test_a_mixed_run_overlays_each_source_dataset(scenario_id) -> None:
    cursor = ScriptedCursor({"scenario_id": MIXED_FEED_ID, "fixture_version": None})

    PsycopgScenarioRepository._require_owned_run(
        cursor,
        RUN_ID,
        BROWSER,
        {"scenario_id": scenario_id, "fixture_version": VERSIONS[scenario_id]},
    )


@pytest.mark.parametrize("scenario_id", ["S06", "S07", "S08"])
def test_a_mixed_run_is_missing_for_a_workflow_scenario(scenario_id) -> None:
    cursor = ScriptedCursor({"scenario_id": MIXED_FEED_ID, "fixture_version": None})

    with pytest.raises(ScenarioSimulationNotFound):
        PsycopgScenarioRepository._require_owned_run(
            cursor,
            RUN_ID,
            BROWSER,
            {"scenario_id": scenario_id, "fixture_version": "v1"},
        )


def test_another_browsers_mixed_run_is_missing() -> None:
    with pytest.raises(ScenarioSimulationNotFound):
        PsycopgScenarioRepository._require_owned_run(
            ScriptedCursor(None),
            RUN_ID,
            BROWSER,
            {"scenario_id": "S01", "fixture_version": "v1"},
        )


def test_the_migration_is_rerunnable(repository_root: Path) -> None:
    sql = (repository_root / "apps/api/migrations/0007_mixed_feed.sql").read_text(
        encoding="utf-8"
    )

    assert "ADD COLUMN IF NOT EXISTS source_scenario_id" in sql
    assert "ADD COLUMN IF NOT EXISTS source_fixture_version" in sql
    for constraint in (
        "sandbox_simulation_runs_mixed_fixture",
        "sandbox_simulation_events_source_pair",
        "sandbox_simulation_events_source_dataset",
    ):
        assert f"DROP CONSTRAINT IF EXISTS {constraint}" in sql
        assert f"ADD CONSTRAINT {constraint}" in sql
