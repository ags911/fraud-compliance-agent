"""Score routing for rule cleared feed payments (spec 0010, ADR-025).

No database: run start and reveal run against the recording cursors of
``test_feed_decisions``. The committed policy file and model are the real,
pinned artifacts.
"""

import hashlib
import json
import logging
import re
from datetime import date
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from test_feed_decisions import (
    BROWSER,
    DUE,
    RUN_ID,
    RecordingConnection,
    RecordingCursor,
    ScriptedCursor,
    _case_update,
    _due_event,
)

from scripts.derive_score_routing_policy import choose_thresholds
from server.sandbox_data import service
from server.sandbox_data.decisions import FeedDecision, feed_decision
from server.sandbox_data.feed_cases import ModelRouting, build_feed_case
from server.sandbox_data.service import PsycopgScenarioRepository
from server.sandbox_data.simulation import (
    build_mixed_schedule,
    build_scenario_schedule,
)
from server.sandbox_model import (
    ScoreRoutingPolicy,
    load_portable_model,
    load_score_routing_policy,
    route_rule_pass,
    routing_policy,
    score_routing_policy,
)
from server.showcase_cases.capture import EventValidator
from server.showcase_cases.repository import PsycopgCaseRepository, _summary

POLICY = ScoreRoutingPolicy("score-routing-v1", "sandbox-portable-xgb-v1", 0.4, 0.7)
V1_EVENTS = "docs/contracts/public-showcase-events.v1.schema.json"
V2_EVENTS = "docs/contracts/public-showcase-events.v2.schema.json"
CASES_CONTRACT = "docs/contracts/showcase-cases.v1.1.schema.json"
SOURCES = ("S01", "S02", "S03", "S04", "S05")


@pytest.fixture(scope="module")
def v1_validator(repository_root: Path) -> EventValidator:
    return EventValidator(repository_root / V1_EVENTS)


@pytest.fixture(scope="module")
def v2_validator(repository_root: Path) -> EventValidator:
    return EventValidator(repository_root / V2_EVENTS)


@pytest.fixture(scope="module")
def model():
    loaded = load_portable_model()
    assert loaded is not None
    return loaded


# ---- The routing rule (AC-2, AC-3) -------------------------------------------


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (None, None),
        (0.0, None),
        (0.39999, None),
        (0.4, "CHALLENGE"),
        (0.69999, "CHALLENGE"),
        (0.7, "HOLD"),
        (1.0, "HOLD"),
    ],
)
def test_a_rule_pass_is_raised_only_at_or_above_a_threshold(score, expected) -> None:
    """AC-2: equal to a threshold counts as reaching it."""
    assert route_rule_pass(score, POLICY) == expected


def test_no_policy_never_raises() -> None:
    """AC-4: without a policy every payment keeps its rule decision."""
    assert route_rule_pass(0.99, None) is None


# ---- The committed policy and its loader (AC-4, AC-5) -----------------------


def test_the_committed_policy_is_compact_sorted_and_pinned(repository_root) -> None:
    """AC-5: generated compact JSON, sorted keys, matching the pinned digest."""
    raw = (repository_root / "config/sandbox-score-routing.v1.json").read_bytes()
    document = json.loads(raw)

    assert hashlib.sha256(raw).hexdigest() == routing_policy.POLICY_SHA256
    assert (
        raw
        == (json.dumps(document, sort_keys=True, separators=(",", ":")) + "\n").encode()
    )
    assert document["policy_version"] == "score-routing-v1"
    assert document["model_version"] == "sandbox-portable-xgb-v1"
    challenge, hold = (
        document["thresholds"]["challenge"],
        document["thresholds"]["hold"],
    )
    assert challenge["rule"] == "precision_at_least_0.50"
    assert challenge["precision"] >= 0.5
    assert hold["rule"] in ("precision_at_least_0.90", "top_0.1_percent_alert_rate")
    assert 0 < challenge["value"] < hold["value"] < 1
    for threshold in (challenge, hold):
        assert round(threshold["value"], 5) == threshold["value"]
        assert {"precision", "recall", "alert_rate"} <= set(threshold)


def test_the_policy_loads_for_the_pinned_model(model) -> None:
    policy = load_score_routing_policy(model)

    assert policy is not None
    assert policy.policy_version == "score-routing-v1"
    assert policy.model_version == model.model_version
    assert 0 < policy.challenge < policy.hold < 1


def test_a_missing_model_turns_routing_off_without_a_routing_warning(
    caplog,
) -> None:
    """AC-4: the model loader already warned; routing adds no second warning."""
    with caplog.at_level(logging.WARNING):
        assert load_score_routing_policy(None) is None

    assert "sandbox_score_routing_unavailable" not in caplog.text


def _write(tmp_path: Path, content: bytes) -> Path:
    path = tmp_path / "policy.json"
    path.write_bytes(content)
    return path


@pytest.mark.parametrize("problem", ["missing", "tampered", "invalid", "other_model"])
def test_a_policy_problem_turns_routing_off_with_one_warning(
    problem, model, tmp_path, repository_root, monkeypatch, caplog
) -> None:
    """AC-4: missing, tampered, invalid or another model's policy is refused."""
    shipped = (repository_root / "config/sandbox-score-routing.v1.json").read_bytes()
    if problem == "missing":
        path = tmp_path / "absent.json"
    elif problem == "tampered":
        path = _write(tmp_path, shipped.replace(b"0.39337", b"0.29337"))
    elif problem == "invalid":
        path = _write(tmp_path, b"{not json")
        monkeypatch.setattr(
            routing_policy, "POLICY_SHA256", hashlib.sha256(b"{not json").hexdigest()
        )
    else:
        other = shipped.replace(b"sandbox-portable-xgb-v1", b"sandbox-portable-xgb-v9")
        path = _write(tmp_path, other)
        monkeypatch.setattr(
            routing_policy, "POLICY_SHA256", hashlib.sha256(other).hexdigest()
        )

    with caplog.at_level(logging.WARNING):
        assert load_score_routing_policy(model, path) is None

    assert caplog.text.count("sandbox_score_routing_unavailable") == 1


def test_the_process_policy_is_loaded_once(monkeypatch) -> None:
    """AC-4: the warning, if any, is logged once per process."""
    calls: list[int] = []
    monkeypatch.setattr(
        routing_policy,
        "load_score_routing_policy",
        lambda model: calls.append(1) or POLICY,
    )
    score_routing_policy.cache_clear()
    try:
        assert score_routing_policy() is POLICY
        assert score_routing_policy() is POLICY
        assert calls == [1]
    finally:
        score_routing_policy.cache_clear()


# ---- Threshold selection (AC-5) ----------------------------------------------


def test_thresholds_are_the_lowest_scores_reaching_each_precision() -> None:
    scores = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]
    labels = [0, 0, 0, 0, 1, 0, 1, 1, 1, 1]

    challenge, hold = choose_thresholds(scores, labels)

    # At 0.1 every row is flagged and 5 of 10 are fraud: precision 0.50
    # exactly, which counts. At 0.6, 4 of 5 (0.80); at 0.7, 4 of 4.
    assert challenge == {
        "value": 0.1,
        "rule": "precision_at_least_0.50",
        "precision": 0.5,
        "recall": 1.0,
        "alert_rate": 1.0,
    }
    assert hold["value"] == 0.7
    assert hold["rule"] == "precision_at_least_0.90"
    assert hold["precision"] == 1.0
    assert hold["recall"] == 0.8
    assert hold["alert_rate"] == 0.4


def test_hold_falls_back_to_the_top_alert_rate_when_precision_never_reaches_090() -> (
    None
):
    scores = [index / 2000 for index in range(2000)]
    # Even rows are fraud, so precision is 0.50 at best and never 0.90.
    labels = [1 if index % 2 == 0 else 0 for index in range(2000)]

    challenge, hold = choose_thresholds(scores, labels)

    assert challenge["value"] == 0.0
    assert hold["rule"] == "top_0.1_percent_alert_rate"
    # The row ranked ceil(0.001 * 2000) = 2 from the top.
    assert hold["value"] == 1998 / 2000
    assert hold["alert_rate"] == 2 / 2000


def test_a_hold_not_above_challenge_fails() -> None:
    with pytest.raises(ValueError, match="HOLD threshold must be above CHALLENGE"):
        choose_thresholds([0.5] * 10, [1, 0] * 5)


def test_threshold_inputs_must_align() -> None:
    with pytest.raises(ValueError):
        choose_thresholds([], [])
    with pytest.raises(ValueError):
        choose_thresholds([0.1], [0, 1])


# ---- Planted S01 outliers (AC-6) ---------------------------------------------


def test_every_twentieth_s01_payment_from_the_tenth_is_a_planted_outlier() -> None:
    schedule = build_scenario_schedule("S01", date(2026, 9, 23), RUN_ID)
    plain = build_scenario_schedule(
        "S01", date(2026, 9, 23), RUN_ID, plant_outliers=False
    )

    outliers = [item for item in schedule if item.synthetic_outlier]
    assert [item.sequence for item in outliers] == list(range(10, 201, 20))
    for item in outliers:
        assert 5 * 4200 <= item.event.amount_minor <= 20 * 4200
        assert item.event.payee_reference == "payee_s01_recurring"
    # Every other payment is exactly the schedule spec 0003 already defined.
    for item, before in zip(schedule, plain, strict=True):
        if not item.synthetic_outlier:
            assert item == before


def test_other_scenarios_have_no_outliers() -> None:
    for scenario_id in SOURCES[1:]:
        schedule = build_scenario_schedule(scenario_id, date(2026, 9, 23), RUN_ID)
        assert not any(item.synthetic_outlier for item in schedule)


def test_mixed_feed_outliers_follow_s01s_own_order() -> None:
    """AC-6: counted by S01's own order, not the overall position."""
    days = dict.fromkeys(SOURCES, date(2026, 9, 23))
    schedule = build_mixed_schedule(days, RUN_ID)
    s01 = [item for item in schedule if item.source_scenario_id == "S01"]

    flagged = [
        position for position, item in enumerate(s01, start=1) if item.synthetic_outlier
    ]
    assert flagged == [
        position for position in range(1, len(s01) + 1) if position % 20 == 10
    ]
    assert flagged
    assert all(
        item.source_scenario_id == "S01" for item in schedule if item.synthetic_outlier
    )
    single = build_scenario_schedule("S01", date(2026, 9, 23), RUN_ID)
    for position in flagged:
        outlier = s01[position - 1].event
        assert outlier.amount_minor == single[position - 1].event.amount_minor
        assert outlier.payee_reference == "payee_s01_recurring"


# ---- Routing at run start (AC-1, AC-2, AC-4) ---------------------------------


class FixedModel:
    """Score each payment by amount: planted outliers high, the rest low.

    ``log_amount`` is ``log1p`` of pounds: normal S01 payments stay below 4.1
    (at most £55) and outliers start above 5.3 (at least £210).
    """

    model_version = "sandbox-portable-xgb-v1"

    def score(self, values):
        return (0.95 if values[0] > 4.7 else 0.01), "0" * 64


def _start(monkeypatch, scenario_id: str, model, policy) -> list[dict]:
    """Start a run through the recording cursor; return its rows by column."""
    run_row = {
        "run_id": RUN_ID,
        "scenario_id": scenario_id,
        "fixture_version": "fixture-test",
        "seed": "sandbox-simulation-v1",
        "state": "pending",
        "scheduled_event_count": 40,
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
    monkeypatch.setattr(service, "portable_model", lambda: model)
    monkeypatch.setattr(service, "score_routing_policy", lambda: policy)
    schedule = build_scenario_schedule(
        scenario_id, date(2026, 9, 23), RUN_ID, event_count=40
    )
    service.PsycopgScenarioRepository("postgresql://example/db").create_simulation_run(
        scenario_id, RUN_ID, "sandbox-simulation-v1", schedule, BROWSER
    )
    [(query, rows)] = cursor.batches
    columns = re.search(r"\(run_id, (.*?)\) VALUES", query).group(1).split(", ")
    return [dict(zip(["run_id", *columns], row, strict=True)) for row in rows]


def test_s01_outliers_are_raised_and_normal_payments_stay_pass(
    monkeypatch,
) -> None:
    """AC-1, AC-2: the rule PASS is stored and the score raises it."""
    rows = _start(monkeypatch, "S01", FixedModel(), POLICY)

    raised = [row for row in rows if row["routed_by"] == "model"]
    assert [row["sequence"] for row in raised] == [10, 30]
    for row in raised:
        assert row["synthetic_outlier"] is True
        assert row["rule_recommendation"] == "PASS"
        assert row["deterministic_route"] == "PASS"
        assert row["recommendation"] == "HOLD"
        assert row["recommendation_basis"] == "model_threshold"
        assert row["routing_policy_version"] == "score-routing-v1"
    for row in rows:
        if row["routed_by"] == "rule":
            assert row["recommendation"] == row["rule_recommendation"] == "PASS"
            assert row["recommendation_basis"] == "deterministic"
            # Assessed by the policy, and left alone.
            assert row["routing_policy_version"] == "score-routing-v1"


@pytest.mark.parametrize("scenario_id", SOURCES[1:])
def test_the_score_never_changes_a_rule_hold_or_challenge(
    monkeypatch, scenario_id
) -> None:
    """AC-1, AC-3: S02 to S05 keep their rule decision whatever the score."""

    class HighModel(FixedModel):
        def score(self, values):
            return 0.99, "0" * 64

    rows = _start(monkeypatch, scenario_id, HighModel(), POLICY)
    rule = feed_decision(scenario_id)

    for row in rows:
        assert row["rule_recommendation"] == rule.recommendation
        assert row["recommendation"] == rule.recommendation
        assert row["routed_by"] == "rule"
        assert row["routing_policy_version"] is None


@pytest.mark.parametrize("off", ["no_policy", "no_model", "scoring_fault"])
def test_routing_off_gives_exactly_the_spec_0004_decisions(monkeypatch, off) -> None:
    """AC-4: without a model, a policy or a score, the rule decides alone."""

    class BrokenModel(FixedModel):
        def score(self, values):
            raise OverflowError("math range error")

    model = {"no_policy": FixedModel(), "no_model": None}.get(off, BrokenModel())
    policy = None if off == "no_policy" else POLICY
    rows = _start(monkeypatch, "S01", model, policy)

    assert {row["recommendation"] for row in rows} == {"PASS"}
    assert {row["routed_by"] for row in rows} == {"rule"}
    assert {row["routing_policy_version"] for row in rows} == {None}
    assert {row["recommendation_basis"] for row in rows} == {"deterministic"}


# ---- The model raised case (AC-7, AC-8) --------------------------------------


ROUTING = ModelRouting(
    score=0.953,
    challenge=0.39337,
    hold=0.72222,
    policy_version="score-routing-v1",
    model_version="sandbox-portable-xgb-v1",
    synthetic_outlier=True,
)
RAISED = FeedDecision("PASS", "deterministic_clear_route", "HOLD", "model_threshold")


def test_a_model_raised_case_uses_v2_events_that_explain_the_route(
    v2_validator, v1_validator
) -> None:
    record = build_feed_case(
        simulation_run_id=RUN_ID,
        sequence=10,
        scenario_id="S01",
        decision=RAISED,
        due_at=DUE,
        validator=v2_validator,
        model_score=0.953,
        model_version="sandbox-portable-xgb-v1",
        model_routing=ROUTING,
    )

    payloads = [event.payload for event in record.events]
    assert {payload["schema_version"] for payload in payloads} == {"2.0"}
    assert [payload["event"] for payload in payloads] == [
        "run_started",
        "route_resolved",
        "investigation_skipped",
        "run_result",
    ]
    assert payloads[1]["deterministic_route"] == "PASS"
    assert payloads[2]["reason"] == "deterministic_clear_route"
    result = payloads[3]
    assert result["recommendation"] == "HOLD"
    assert result["recommendation_basis"] == "model_threshold"
    assert result["model_routing"] == {
        "score": 0.953,
        "challenge": 0.39337,
        "hold": 0.72222,
        "rule_recommendation": "PASS",
        "policy_version": "score-routing-v1",
        "model_version": "sandbox-portable-xgb-v1",
        "synthetic_outlier": True,
    }
    assert record.routed_by == "model"
    assert record.event_contract_version == "2"
    # v2 events never pass as v1.
    with pytest.raises(ValueError):
        build_feed_case(
            simulation_run_id=RUN_ID,
            sequence=10,
            scenario_id="S01",
            decision=RAISED,
            due_at=DUE,
            validator=v1_validator,
            model_routing=ROUTING,
        )


def test_a_rule_case_stays_on_v1(v1_validator) -> None:
    record = build_feed_case(
        simulation_run_id=RUN_ID,
        sequence=2,
        scenario_id="S04",
        decision=feed_decision("S04"),
        due_at=DUE,
        validator=v1_validator,
    )

    assert {event.payload["schema_version"] for event in record.events} == {"1.0"}
    assert "model_routing" not in record.events[-1].payload
    assert record.routed_by == "rule"
    assert record.event_contract_version == "1"


def test_case_summaries_match_showcase_cases_v11(
    repository_root, v1_validator, v2_validator
) -> None:
    schema = json.loads((repository_root / CASES_CONTRACT).read_text(encoding="utf-8"))
    defs = schema["$defs"]
    summary_schema = Draft202012Validator({**defs["caseSummary"], "$defs": defs})
    raised = build_feed_case(
        simulation_run_id=RUN_ID,
        sequence=10,
        scenario_id="S01",
        decision=RAISED,
        due_at=DUE,
        validator=v2_validator,
        model_score=0.953,
        model_version="sandbox-portable-xgb-v1",
        model_routing=ROUTING,
    )
    rule = build_feed_case(
        simulation_run_id=RUN_ID,
        sequence=2,
        scenario_id="S04",
        decision=feed_decision("S04"),
        due_at=DUE,
        validator=v1_validator,
    )

    for record in (raised, rule):
        row = {name: getattr(record, name) for name in record.__dataclass_fields__}
        summary = _summary(row)
        assert summary["contract_version"] == "1.1"
        summary_schema.validate(summary)
    # A model routed summary must name the v2 events and the model basis.
    wrong = {**_summary({n: getattr(raised, n) for n in raised.__dataclass_fields__})}
    wrong["event_contract_version"] = "1"
    assert list(summary_schema.iter_errors(wrong))


@pytest.fixture
def inserted(monkeypatch) -> list:
    saved: list = []

    def insert(cursor, record, browser_id) -> bool:
        saved.append(record)
        return True

    monkeypatch.setattr(PsycopgCaseRepository, "insert_case", staticmethod(insert))
    return saved


def _raised_event(**overrides) -> dict:
    return _due_event(
        "S01",
        deterministic_route="PASS",
        recommendation="CHALLENGE",
        recommendation_basis="model_threshold",
        model_score=0.52,
        model_version="sandbox-portable-xgb-v1",
        routed_by="model",
        routing_policy_version="score-routing-v1",
        synthetic_outlier=True,
        **overrides,
    )


def test_revealing_a_model_raised_payment_saves_a_v2_case(
    monkeypatch, inserted, v1_validator, v2_validator, model
) -> None:
    """AC-7: thresholds come from the policy version the payment stored."""
    policy = load_score_routing_policy(model)
    monkeypatch.setattr(service, "policy_for_version", lambda version: policy)
    monkeypatch.setattr(
        service, "_feed_case_validator", lambda version="1": v2_validator
    )
    cursor = ScriptedCursor(_raised_event())

    assert (
        PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 10, v1_validator) == 1
    )

    [record] = inserted
    routing = record.events[-1].payload["model_routing"]
    assert routing["challenge"] == policy.challenge
    assert routing["hold"] == policy.hold
    assert routing["score"] == 0.52
    assert routing["synthetic_outlier"] is True
    assert record.event_contract_version == "2"
    assert _case_update(cursor) == ("run_feed_3f2a9c1e7b4d_010", "saved")


def test_a_raised_payment_without_its_policy_is_shown_with_no_case(
    monkeypatch, inserted, v1_validator
) -> None:
    """Never an unexplained case: no policy means no case, and the feed goes on."""
    monkeypatch.setattr(service, "policy_for_version", lambda version: None)
    cursor = ScriptedCursor(_raised_event())

    assert (
        PsycopgScenarioRepository._reveal_event(cursor, RUN_ID, 10, v1_validator) == 1
    )
    assert inserted == []
    assert _case_update(cursor) == (None, "invalid")


# ---- The routing snapshot (AC-8, AC-9) ----------------------------------------


class _SnapshotCursor:
    def __init__(self, run: dict, events: list[dict]) -> None:
        self.answers = [run, {"next_due_at": None}]
        self.events = events

    def execute(self, query, parameters=()) -> None:
        return None

    def fetchone(self):
        return self.answers.pop(0)

    def fetchall(self):
        return self.events


def test_the_snapshot_counts_every_model_raised_payment(monkeypatch) -> None:
    """AC-8: raised_by_model is never truncated to the recent lists."""
    monkeypatch.setattr(service, "score_routing_policy", lambda: POLICY)
    events = [
        {
            "event_id": f"evt-{sequence}",
            "sequence": sequence,
            "recommendation": "HOLD",
            "routed_by": "model" if sequence <= 25 else "rule",
            "model_score": 0.9 if sequence <= 25 else None,
        }
        for sequence in range(40, 0, -1)
    ]
    run = {
        "run_id": RUN_ID,
        "scenario_id": "S01",
        "fixture_version": "fixture-test",
        "seed": "sandbox-simulation-v1",
        "state": "running",
        "scheduled_event_count": 200,
        "appended_event_count": 40,
    }

    snapshot = PsycopgScenarioRepository.read_simulation_run_cursor(
        _SnapshotCursor(run, events), RUN_ID, BROWSER
    )["routing_snapshot"]

    assert snapshot["raised_by_model"] == 25
    assert snapshot["routing_policy"] == {
        "version": "score-routing-v1",
        "challenge": 0.4,
        "hold": 0.7,
    }
    assert len(snapshot["by_recommendation"]["HOLD"]["recent"]) == 18


# ---- Migration and image (AC-3, AC-14) ---------------------------------------


def test_migration_0008_is_rerunnable_and_only_escalates(repository_root) -> None:
    sql = (repository_root / "apps/api/migrations/0008_score_routing.sql").read_text()

    for line in sql.splitlines():
        if line.startswith("ALTER TABLE") and "ADD COLUMN" in line:
            assert "IF NOT EXISTS" in line
    for match in re.finditer(r"ADD CONSTRAINT (\w+)", sql):
        assert f"DROP CONSTRAINT IF EXISTS {match.group(1)}" in sql
    assert "score_routing_escalates_only" in sql
    assert "rule_recommendation = 'PASS'" in sql
    assert "model_threshold" in sql


def test_the_image_ships_the_policy_and_the_v2_events(repository_root) -> None:
    dockerfile = (repository_root / "apps/api/Dockerfile").read_text()
    dockerignore = (repository_root / ".dockerignore").read_text()

    for path in (
        "config/sandbox-score-routing.v1.json",
        "docs/contracts/public-showcase-events.v2.schema.json",
    ):
        assert f"COPY {path} " in dockerfile
        assert f"!{path}" in dockerignore


def test_the_decisions_overlay_counts_each_payments_final_recommendation() -> None:
    """AC-12: an S01 payment the model raised counts as HOLD; imports stay PASS."""
    from server.sandbox_data.service import _decision_days

    day = date(2026, 9, 23)
    counted = _decision_days(
        day,
        day,
        "PASS",
        [{"event_date": day, "payments": 7}],
        [
            {"event_date": day, "recommendation": "PASS", "payments": 18},
            {"event_date": day, "recommendation": "HOLD", "payments": 1},
            {"event_date": day, "recommendation": "CHALLENGE", "payments": 1},
        ],
    )

    assert counted["totals"] == {"PASS": 25, "CHALLENGE": 1, "HOLD": 1}
