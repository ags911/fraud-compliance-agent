"""Decided live feed payments and feed cases (spec 0004, slices 1 and 2).

These tests need no database. The reveal step runs against a scripted cursor,
so what it writes for each kind of payment is checked statement by statement.
"""

import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from server import main
from server.main import create_app
from server.sandbox_data.decisions import feed_decision
from server.sandbox_data.feed_cases import build_feed_case, feed_case_id
from server.sandbox_data.service import (
    PsycopgScenarioRepository,
    _decision_days,
)
from server.showcase_cases.capture import (
    MAX_CASES_BY_ORIGIN,
    RETENTION,
    CaseCaptureError,
    EventValidator,
)
from server.showcase_cases.repository import PsycopgCaseRepository, _summary

EVENTS_SCHEMA = "docs/contracts/public-showcase-events.v1.schema.json"
PROPOSED_SCHEMA = "docs/proposals/schemas/showcase-cases.v0.proposed.schema.json"
RUN_ID = "3f2a9c1e-7b4d-4e8b-9f3a-2c5d8e1f4a6b"
BROWSER = "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b"
OWNER = {"X-Showcase-Browser-Id": BROWSER}
DUE = datetime(2026, 9, 23, 12, 0, 7, tzinfo=UTC)


@pytest.fixture(scope="module")
def validator(repository_root: Path) -> EventValidator:
    return EventValidator(repository_root / EVENTS_SCHEMA)


# ---- The scenario decision rule (AC-1, AC-3) --------------------------------


@pytest.mark.parametrize(
    ("scenario_id", "route", "reason", "recommendation", "basis", "saves_case"),
    [
        ("S01", "PASS", "deterministic_clear_route", "PASS", "deterministic", False),
        ("S02", "HOLD", "hard_deterministic_control", "HOLD", "deterministic", True),
        ("S03", "HOLD", "hard_app_control", "HOLD", "deterministic", True),
        (
            "S04",
            "INVESTIGATE",
            "existing_recorded_recommendation",
            "CHALLENGE",
            "evidence_grounded",
            True,
        ),
        (
            "S05",
            "INVESTIGATE",
            "existing_recorded_recommendation",
            "HOLD",
            "fail_safe",
            True,
        ),
    ],
)
def test_each_scenario_has_exactly_the_spec_rule(
    scenario_id, route, reason, recommendation, basis, saves_case
) -> None:
    """AC-1: the rule table is the only source of route and recommendation."""
    decision = feed_decision(scenario_id)

    assert decision is not None
    assert decision.deterministic_route == route
    assert decision.skip_reason == reason
    assert decision.recommendation == recommendation
    assert decision.recommendation_basis == basis
    assert decision.saves_case is saves_case


@pytest.mark.parametrize("scenario_id", ["S06", "S07", "S08", "S99"])
def test_workflow_scenarios_have_no_rule(scenario_id) -> None:
    """AC-1: S06 to S08 have no rule (and no schedule)."""
    assert feed_decision(scenario_id) is None


# ---- Decided counts per day (AC-7) ------------------------------------------


def test_imported_payments_take_the_rule_and_the_run_adds_its_own() -> None:
    """Imported outbound payments get the rule; revealed ones add by their own decision."""
    imported = [
        {"event_date": date(2026, 9, 21), "payments": 2},
        {"event_date": date(2026, 9, 23), "payments": 1},
    ]
    revealed = [
        {"event_date": date(2026, 9, 23), "recommendation": "HOLD", "payments": 4},
        # Outside the dataset: never invented into a new day.
        {"event_date": date(2026, 9, 30), "recommendation": "HOLD", "payments": 9},
    ]

    result = _decision_days(
        date(2026, 9, 21), date(2026, 9, 23), "HOLD", imported, revealed
    )

    assert result["days"] == [
        {"date": "2026-09-21", "PASS": 0, "CHALLENGE": 0, "HOLD": 2},
        {"date": "2026-09-22", "PASS": 0, "CHALLENGE": 0, "HOLD": 0},
        {"date": "2026-09-23", "PASS": 0, "CHALLENGE": 0, "HOLD": 5},
    ]
    assert result["totals"] == {"PASS": 0, "CHALLENGE": 0, "HOLD": 7}


def _decisions(scenario_id: str = "S02") -> dict:
    return {
        "contract_version": "0",
        "scenario_id": scenario_id,
        "fixture_version": "fixture-test",
        "days": [{"date": "2026-09-23", "PASS": 0, "CHALLENGE": 0, "HOLD": 3}],
        "totals": {"PASS": 0, "CHALLENGE": 0, "HOLD": 3},
    }


def test_decisions_endpoint_returns_counts_and_passes_the_owner(monkeypatch) -> None:
    """AC-7: the base is public; a run overlay is read for its own browser."""
    calls = []

    def fake(scenario_id, simulation_run_id=None, browser_id=None):
        calls.append((scenario_id, simulation_run_id, browser_id))
        return _decisions(scenario_id)

    monkeypatch.setattr(main, "load_sandbox_decisions", fake)
    client = TestClient(create_app())

    base = client.get("/sandbox/scenarios/S02/decisions")
    run = client.get(
        "/sandbox/scenarios/S02/decisions?simulation_run_id=run-test", headers=OWNER
    )

    assert base.status_code == 200
    assert base.json()["totals"] == {"PASS": 0, "CHALLENGE": 0, "HOLD": 3}
    assert run.status_code == 200
    assert calls == [("S02", None, None), ("S02", "run-test", BROWSER)]


def test_decisions_endpoint_error_codes(monkeypatch) -> None:
    """AC-7: 404 for S06 to S08 and another browser's run, 400 without a key."""
    errors = {
        "S06": main.ScenarioNotDecided("S06"),
        "S02": main.ScenarioSimulationNotFound("run-other"),
        "S09": main.ScenarioDatasetNotFound("S09"),
        "S03": main.SandboxDataUnavailable(),
    }

    def fake(scenario_id, simulation_run_id=None, browser_id=None):
        raise errors[scenario_id]

    monkeypatch.setattr(main, "load_sandbox_decisions", fake)
    client = TestClient(create_app())

    assert client.get("/sandbox/scenarios/S06/decisions").json() == {
        "detail": "sandbox_scenario_not_decided"
    }
    other = client.get(
        "/sandbox/scenarios/S02/decisions?simulation_run_id=run-other", headers=OWNER
    )
    assert other.status_code == 404
    assert other.json() == {"detail": "sandbox_simulation_not_found"}
    assert client.get("/sandbox/scenarios/S09/decisions").json() == {
        "detail": "sandbox_scenario_not_found"
    }
    assert client.get("/sandbox/scenarios/S03/decisions").status_code == 503
    missing = client.get("/sandbox/scenarios/S02/decisions?simulation_run_id=run-x")
    assert missing.status_code == 400
    assert missing.json() == {"detail": "invalid_browser_id"}


def test_a_workflow_scenario_is_refused_before_any_database_read() -> None:
    """S06 to S08 answer not decided without opening a connection."""
    repository = PsycopgScenarioRepository("postgresql://example.invalid/db")

    with pytest.raises(main.ScenarioNotDecided):
        repository.read_decisions("S07")


# ---- The feed case shape (AC-4) ---------------------------------------------


def test_feed_case_ids_follow_the_spec_format() -> None:
    assert feed_case_id(RUN_ID, 7) == "run_feed_3f2a9c1e7b4d_007"


@pytest.mark.parametrize("scenario_id", ["S02", "S03", "S04", "S05"])
def test_a_feed_case_is_four_accepted_events_at_the_due_time(
    scenario_id, validator: EventValidator
) -> None:
    """AC-4: built through build_case, validated against the frozen v1 schema."""
    decision = feed_decision(scenario_id)
    record = build_feed_case(
        simulation_run_id=RUN_ID,
        sequence=7,
        scenario_id=scenario_id,
        decision=decision,
        due_at=DUE,
        validator=validator,
    )

    assert record.case_id == "run_feed_3f2a9c1e7b4d_007"
    assert record.origin == "feed"
    assert record.model_score is None and record.model_version is None
    assert [event.payload["event"] for event in record.events] == [
        "run_started",
        "route_resolved",
        "investigation_skipped",
        "run_result",
    ]
    assert [event.payload["event_id"] for event in record.events] == [
        f"evt_feed_3f2a9c1e7b4d_007_{number}" for number in range(1, 5)
    ]
    assert record.deterministic_route == decision.deterministic_route
    assert record.recommendation == decision.recommendation
    assert record.recommendation_basis == decision.recommendation_basis
    assert record.investigation_status == "skipped"
    assert record.execution_mode == record.requested_mode == "recorded"
    assert record.events[2].payload["reason"] == decision.skip_reason
    assert record.started_at == record.completed_at == DUE
    assert record.expires_at == DUE + RETENTION == DUE + timedelta(days=30)


class RejectingValidator:
    def validate(self, payload: dict) -> None:
        raise CaseCaptureError("forced")


def test_an_invalid_feed_case_raises_and_stores_nothing() -> None:
    with pytest.raises(CaseCaptureError):
        build_feed_case(
            simulation_run_id=RUN_ID,
            sequence=1,
            scenario_id="S02",
            decision=feed_decision("S02"),
            due_at=DUE,
            validator=RejectingValidator(),
        )


def test_feed_and_showcase_caps_are_separate() -> None:
    """AC-5: 20 feed and 50 showcase cases per browser, each its own cap."""
    assert MAX_CASES_BY_ORIGIN == {"showcase": 50, "feed": 20}


def test_a_feed_case_summary_matches_the_proposed_contract(
    repository_root: Path, validator: EventValidator
) -> None:
    """Summaries gain origin and the (null) score, and still match the draft."""
    schema = json.loads((repository_root / PROPOSED_SCHEMA).read_text(encoding="utf-8"))
    defs = schema["$defs"]
    record = build_feed_case(
        simulation_run_id=RUN_ID,
        sequence=2,
        scenario_id="S04",
        decision=feed_decision("S04"),
        due_at=DUE,
        validator=validator,
    )
    row = {name: getattr(record, name) for name in record.__dataclass_fields__}
    row["model_score"] = Decimal("0.12345")
    row["model_version"] = "sandbox-portable-xgb-v1"

    summary = _summary(row)

    assert summary["origin"] == "feed"
    assert summary["model_score"] == 0.12345
    Draft202012Validator({**defs["caseSummary"], "$defs": defs}).validate(summary)
    # A showcase case may never carry a score.
    showcase = {**summary, "origin": "showcase"}
    assert list(
        Draft202012Validator({**defs["caseSummary"], "$defs": defs}).iter_errors(
            showcase
        )
    )


# ---- Revealing one payment (AC-4, AC-6) -------------------------------------


class ScriptedCursor:
    """Answer the reveal's one SELECT, and record every statement after it."""

    def __init__(self, event: dict | None) -> None:
        self.event = event
        self.statements: list[tuple[str, tuple]] = []

    def execute(self, query, parameters=()) -> None:
        self.statements.append((" ".join(str(query).split()), parameters))

    def fetchone(self):
        return self.event

    def updates(self) -> list[tuple[str, tuple]]:
        return [item for item in self.statements if item[0].startswith("UPDATE")]


def _due_event(scenario_id: str = "S02", **overrides) -> dict:
    decision = feed_decision(scenario_id)
    return {
        "due_at": DUE,
        "deterministic_route": decision.deterministic_route,
        "recommendation": decision.recommendation,
        "recommendation_basis": decision.recommendation_basis,
        "model_score": None,
        "model_version": None,
        "case_id": None,
        "scenario_id": scenario_id,
        "browser_id": BROWSER,
        **overrides,
    }


@pytest.fixture
def inserted(monkeypatch) -> list:
    saved: list = []

    def insert(cursor, record, browser_id) -> bool:
        saved.append((record, browser_id))
        return True

    monkeypatch.setattr(PsycopgCaseRepository, "insert_case", staticmethod(insert))
    return saved


def _case_update(cursor: ScriptedCursor) -> tuple | None:
    for query, parameters in cursor.updates():
        if "case_status" in query:
            return parameters[:2]
    return None


def test_a_revealed_hold_saves_one_case_for_the_runs_browser(
    inserted, validator: EventValidator
) -> None:
    """AC-4: the case is saved in the reveal's transaction, and linked."""
    cursor = ScriptedCursor(_due_event("S02"))

    revealed = PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 7, validator)

    assert revealed == 1
    assert "SET appended_at" in cursor.updates()[0][0]
    assert [(record.case_id, owner) for record, owner in inserted] == [
        ("run_feed_3f2a9c1e7b4d_007", BROWSER)
    ]
    assert inserted[0][0].origin == "feed"
    assert _case_update(cursor) == ("run_feed_3f2a9c1e7b4d_007", "saved")


def test_a_case_id_that_already_exists_is_not_claimed(
    monkeypatch, validator: EventValidator
) -> None:
    """If the insert writes nothing, the payment is not marked saved or linked."""
    monkeypatch.setattr(
        PsycopgCaseRepository,
        "insert_case",
        staticmethod(lambda cursor, record, browser_id: False),
    )
    cursor = ScriptedCursor(_due_event("S02"))

    assert PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 7, validator) == 1
    assert _case_update(cursor) == (None, "invalid")


def test_a_revealed_pass_gets_no_case(inserted, validator: EventValidator) -> None:
    """AC-4: PASS payments are decided and revealed, never saved."""
    cursor = ScriptedCursor(_due_event("S01"))

    assert PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 1, validator) == 1
    assert inserted == []
    assert _case_update(cursor) is None


def test_storage_off_still_reveals_and_marks_the_payment(inserted) -> None:
    """AC-6: no case store means storage_off, and the feed keeps running."""
    cursor = ScriptedCursor(_due_event("S03"))

    assert PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 3, None) == 1
    assert inserted == []
    assert _case_update(cursor) == (None, "storage_off")


def test_an_invalid_case_is_revealed_marked_and_not_retried(inserted) -> None:
    """AC-4: a validation failure reveals the payment as invalid, with no case."""
    cursor = ScriptedCursor(_due_event("S04"))

    assert (
        PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 4, RejectingValidator())
        == 1
    )
    assert inserted == []
    assert _case_update(cursor) == (None, "invalid")


def test_a_payment_already_revealed_or_stopped_is_left_alone(inserted) -> None:
    """Another worker's payment, or a stopped run's, is neither revealed nor saved."""
    cursor = ScriptedCursor(None)

    assert PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 5, None) == 0
    assert cursor.updates() == []
    assert inserted == []


def test_a_payment_that_already_has_a_case_never_gets_another(
    inserted, validator: EventValidator
) -> None:
    """A payment with a case pointer is never saved twice, even after a trim."""
    cursor = ScriptedCursor(_due_event("S02", case_id="run_feed_3f2a9c1e7b4d_007"))

    assert PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 7, validator) == 1
    assert inserted == []
    assert _case_update(cursor) is None


def test_a_row_from_before_the_decisions_migration_is_skipped(
    inserted, validator: EventValidator
) -> None:
    """Rows with no stored decision are revealed but never become a case."""
    cursor = ScriptedCursor(
        _due_event(
            "S02",
            deterministic_route=None,
            recommendation=None,
            recommendation_basis=None,
        )
    )

    assert PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 2, validator) == 1
    assert inserted == []


def test_the_migration_is_rerunnable(repository_root: Path) -> None:
    """The runner re-applies every file, so each change must be idempotent."""
    sql = (repository_root / "apps/api/migrations/0006_feed_decisions.sql").read_text(
        encoding="utf-8"
    )
    statements = [
        line
        for line in sql.splitlines()
        if line.startswith(("ALTER", "CREATE", "  ADD"))
    ]

    assert all(
        "IF NOT EXISTS" in line or "IF EXISTS" in line or "ADD CONSTRAINT" in line
        for line in statements
        if "ADD" in line or "CREATE" in line or "DROP" in line
    )
    assert "DROP CONSTRAINT IF EXISTS showcase_cases_model_score_feed_only" in sql


# ---- Locked verify steps (spec 0004 verify.md) ------------------------------


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


@pytest.mark.parametrize(
    ("scenario_id", "route", "recommendation", "basis"),
    [
        ("S02", "HOLD", "HOLD", "deterministic"),
        ("S04", "INVESTIGATE", "CHALLENGE", "evidence_grounded"),
    ],
)
def test_run_start_stores_the_rule_decision_on_every_scheduled_payment(
    monkeypatch, scenario_id, route, recommendation, basis
) -> None:
    """AC-1, AC-2: decided at run start, from the rule alone, with no score."""
    from server.sandbox_data import service
    from server.sandbox_data.simulation import build_scenario_schedule

    run_row = {
        "run_id": RUN_ID,
        "scenario_id": scenario_id,
        "fixture_version": "fixture-test",
        "seed": "sandbox-simulation-v1",
        "state": "pending",
        "scheduled_event_count": 3,
        "appended_event_count": 0,
    }
    cursor = RecordingCursor(
        [
            {"fixture_version": "fixture-test"},
            {"starts": 0},
            {"live": 0},
            run_row,
            {"next_due_at": None},
        ]
    )
    monkeypatch.setattr(
        service.psycopg, "connect", lambda *args, **kwargs: RecordingConnection(cursor)
    )
    schedule = build_scenario_schedule(
        scenario_id, date(2026, 9, 23), RUN_ID, event_count=3
    )

    PsycopgScenarioRepository("postgresql://example/db").create_simulation_run(
        scenario_id, RUN_ID, "sandbox-simulation-v1", schedule, BROWSER
    )

    [(query, rows)] = cursor.batches
    assert "deterministic_route, recommendation, recommendation_basis" in query
    # No score column is written at run start until slice 3.
    assert "model_score" not in query
    assert len(rows) == 3
    assert {row[-3:] for row in rows} == {(route, recommendation, basis)}


def test_a_workflow_scenario_schedule_stores_no_decision() -> None:
    """AC-1: S06 to S08 have no rule and no schedule, so nothing is decided."""
    from server.sandbox_data.simulation import build_scenario_schedule

    assert build_scenario_schedule("S06", date(2026, 9, 23), RUN_ID) == ()


@pytest.mark.parametrize(("origin", "cap"), [("feed", 20), ("showcase", 50)])
def test_insert_trims_only_its_own_origin_to_its_own_cap(
    origin, cap, validator: EventValidator
) -> None:
    """AC-5: each cap trims only its own origin, in the insert's transaction."""
    import dataclasses

    record = dataclasses.replace(
        build_feed_case(
            simulation_run_id=RUN_ID,
            sequence=1,
            scenario_id="S02",
            decision=feed_decision("S02"),
            due_at=DUE,
            validator=validator,
        ),
        origin=origin,
    )
    cursor = RecordingCursor([{"case_id": record.case_id}])

    assert PsycopgCaseRepository.insert_case(cursor, record, BROWSER) is True

    queries = [query for query, _ in cursor.statements]
    assert queries[0].startswith("SELECT pg_advisory_xact_lock")
    assert "ON CONFLICT (case_id) DO NOTHING" in queries[1]
    [(trim, parameters)] = [
        item for item in cursor.statements if "AND origin = %s" in item[0]
    ]
    assert trim.startswith("DELETE FROM showcase_cases")
    assert parameters == (BROWSER, origin, BROWSER, origin, cap)
    [(events_query, event_rows)] = cursor.batches
    assert "showcase_case_events" in events_query
    assert len(event_rows) == 4


def test_an_existing_case_id_writes_no_events_and_trims_nothing(
    validator: EventValidator,
) -> None:
    """AC-4: a retried insert of a known case ID is a no op."""
    record = build_feed_case(
        simulation_run_id=RUN_ID,
        sequence=1,
        scenario_id="S02",
        decision=feed_decision("S02"),
        due_at=DUE,
        validator=validator,
    )
    cursor = RecordingCursor([None])

    assert PsycopgCaseRepository.insert_case(cursor, record, BROWSER) is False
    assert cursor.batches == []
    assert not any(query.startswith("DELETE") for query, _ in cursor.statements)


def test_the_worker_saves_cases_only_when_case_storage_is_on(
    monkeypatch, repository_root: Path
) -> None:
    """AC-6: the same switch as Run showcase cases decides storage_off."""
    from server.sandbox_data import service

    service._compiled_event_validator.cache_clear()
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")
    monkeypatch.setenv("FCA_SHOWCASE_ROOT", str(repository_root))

    monkeypatch.setenv("SHOWCASE_CASES_ENABLED", "false")
    assert service._feed_case_validator() is None

    monkeypatch.setenv("SHOWCASE_CASES_ENABLED", "true")
    assert isinstance(service._feed_case_validator(), EventValidator)

    # An unreadable schema leaves storage off rather than stopping the feed.
    service._compiled_event_validator.cache_clear()
    monkeypatch.setenv("FCA_SHOWCASE_ROOT", str(repository_root / "missing"))
    assert service._feed_case_validator() is None
    service._compiled_event_validator.cache_clear()


@pytest.mark.parametrize(
    "run",
    [
        None,
        {"scenario_id": "S03", "fixture_version": "fixture-test"},
        {"scenario_id": "S02", "fixture_version": "older-import"},
    ],
)
def test_an_overlay_run_must_be_this_browsers_on_this_dataset(run) -> None:
    """AC-7: another browser's run, scenario's or import's reads as missing."""
    cursor = RecordingCursor([run])
    dataset = {"scenario_id": "S02", "fixture_version": "fixture-test"}

    with pytest.raises(main.ScenarioSimulationNotFound):
        PsycopgScenarioRepository._require_owned_run(
            cursor, "run-test", BROWSER, dataset
        )
    assert cursor.statements[0][1] == ("run-test", BROWSER)


def test_the_owners_run_on_this_dataset_is_accepted() -> None:
    cursor = RecordingCursor(
        [{"scenario_id": "S02", "fixture_version": "fixture-test"}]
    )

    PsycopgScenarioRepository._require_owned_run(
        cursor,
        "run-test",
        BROWSER,
        {"scenario_id": "S02", "fixture_version": "fixture-test"},
    )
