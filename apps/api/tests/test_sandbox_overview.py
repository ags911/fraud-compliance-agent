"""AI operations overview (spec 0011, ADR-026): facts, template, fact check, limits, route."""

import asyncio
import json
import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import jsonschema
import pytest
from fastapi.testclient import TestClient
from groq import BadRequestError
from httpx import Request, Response

from server import main
from server.main import create_app
from server.sandbox_data import service
from server.sandbox_data.overview import (
    build_overview_facts,
    is_grounded,
    overview_window,
    scenario_label,
    template_overview,
    valid_overview_shape,
    write_date,
    write_money,
)
from server.sandbox_data.overview_writer import (
    OverviewSettings,
    OverviewWriter,
    load_overview_settings,
)
from server.sandbox_data.service import (
    PsycopgScenarioRepository,
    ScenarioDatasetNotFound,
    ScenarioNotDecided,
)
from server.showcase_cases.repository import CasePage, CasesUnavailable, empty_totals
from server.showcase_investigation.admission import LiveAdmissionController
from server.showcase_investigation.errors import (
    InvalidProviderOutput,
    ProviderUnavailable,
)
from server.showcase_investigation.provider import GroqInvestigationProvider
from server.showcase_investigation.settings import LiveLimits

RUN_ID = "3f2a9c1e-7b4d-4e8b-9f3a-2c5d8e1f4a6b"
BROWSER = "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b"
OWNER = {"X-Showcase-Browser-Id": BROWSER}
START = date(2026, 6, 29)
END = date(2026, 9, 23)
LIMITS = LiveLimits(
    maximum_concurrent=1,
    maximum_per_client=3,
    per_client_window_seconds=600,
    maximum_per_process_window=20,
    maximum_window_seconds=1800,
    timeout_seconds=20,
)


def _aggregate(day: date, transactions: int, spend: int) -> dict[str, Any]:
    return {
        "aggregate_date": day,
        "transaction_count": transactions,
        "outbound_amount_minor": spend,
        "category_counts": {},
    }


def _part(
    scenario_id: str = "S01",
    rule: str = "PASS",
    aggregates: list[dict[str, Any]] | None = None,
    imported: list[dict[str, Any]] | None = None,
    revealed: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "scenario_id": scenario_id,
        "start_date": START,
        "end_date": END,
        "rule_recommendation": rule,
        "aggregates": aggregates or [],
        "imported": imported or [],
        "revealed": revealed or [],
    }


def _feed(policy: bool = True, **counts: int) -> dict[str, Any]:
    return {
        "run_id": RUN_ID,
        "scenario_id": "S01",
        "state": "running",
        "scheduled_event_count": 200,
        "appended_event_count": counts.get("shown", 12),
        "routing_snapshot": {
            "by_recommendation": {
                outcome: {"count": counts.get(outcome, 0), "recent": []}
                for outcome in ("PASS", "CHALLENGE", "HOLD")
            },
            "raised_by_model": counts.get("raised", 1),
            "routing_policy": {"version": "score-routing-v1"} if policy else None,
        },
    }


def _facts(
    range_: str = "30",
    parts: list[dict[str, Any]] | None = None,
    feed: dict[str, Any] | None = None,
    case_totals: dict[str, Any] | None = None,
    scenario_id: str = "S01",
):
    parts = parts or [
        _part(
            aggregates=[
                _aggregate(END, 4, 1_016_583),
                _aggregate(END - timedelta(days=3), 2, 25_000),
                _aggregate(END - timedelta(days=40), 9, 9_999_999),
            ],
            imported=[
                {"event_date": END, "payments": 3},
                {"event_date": END - timedelta(days=40), "payments": 7},
            ],
        )
    ]
    return build_overview_facts(
        scenario_id,
        range_,
        {"parts": parts, "feed": feed},
        case_totals,
        "Trusted recurring payment",
    )


# ---- Written figures and the window (AC-3) ----------------------------------


def test_figures_are_written_as_the_dashboard_writes_them() -> None:
    assert write_money(1_016_583) == "£10,165.83"
    assert write_money(5) == "£0.05"
    assert write_money(0) == "£0.00"
    assert write_date(date(2026, 9, 2)) == "2 Sep 2026"


@pytest.mark.parametrize(
    ("range_", "expected_start"),
    [("7", date(2026, 9, 17)), ("30", date(2026, 8, 25)), ("all", START)],
)
def test_the_window_counts_back_from_the_last_day(range_, expected_start) -> None:
    assert overview_window(START, END, range_) == (expected_start, END)


def test_the_window_never_reaches_past_the_first_day() -> None:
    first = END - timedelta(days=3)
    assert overview_window(first, END, "30") == (first, END)


def test_facts_cover_the_window_by_the_cards_rules() -> None:
    facts = _facts()

    assert facts.window_days == 30
    assert facts.written["window"] == {
        "start": "25 Aug 2026",
        "end": "23 Sep 2026",
        "days": "30",
    }
    # The day 40 days back is outside the 30 day window.
    assert facts.written["activity"] == {
        "transactions": "6",
        "outbound_spend": "£10,415.83",
        "active_days": "2",
        "largest_day": {"date": "23 Sep 2026", "outbound_spend": "£10,165.83"},
    }
    assert facts.written["decisions"] == {"PASS": "3", "CHALLENGE": "0", "HOLD": "0"}
    assert facts.written["feed"] is None and facts.written["cases"] is None


def test_the_largest_day_is_the_first_with_the_highest_spend() -> None:
    first = END - timedelta(days=5)
    facts = _facts(
        parts=[_part(aggregates=[_aggregate(first, 1, 500), _aggregate(END, 1, 500)])]
    )
    assert facts.written["activity"]["largest_day"]["date"] == write_date(first)


def test_a_window_with_no_outbound_spend_has_no_largest_day() -> None:
    facts = _facts(parts=[_part(aggregates=[_aggregate(END, 2, 0)])])
    assert facts.written["activity"]["largest_day"] is None
    assert facts.written["activity"]["active_days"] == "1"


def test_the_viewers_revealed_payments_are_added_to_the_decisions() -> None:
    facts = _facts(
        parts=[
            _part(
                imported=[{"event_date": END, "payments": 2}],
                revealed=[
                    {"event_date": END, "recommendation": "HOLD", "payments": 1},
                    {"event_date": END, "recommendation": "PASS", "payments": 4},
                ],
            )
        ],
        feed=_feed(PASS=4, HOLD=1, shown=5),
    )
    assert facts.written["decisions"] == {"PASS": "6", "CHALLENGE": "0", "HOLD": "1"}
    assert facts.written["feed"] == {
        "state": "running",
        "shown": "5",
        "scheduled": "200",
        "PASS": "4",
        "CHALLENGE": "0",
        "HOLD": "1",
        "raised_by_model": "1",
        "score_routing_on": True,
    }


def test_the_mixed_feed_sums_its_five_sources() -> None:
    rules = {"S01": "PASS", "S02": "HOLD", "S03": "HOLD", "S04": "CHALLENGE"}
    parts = [
        _part(
            source,
            rules.get(source, "HOLD"),
            aggregates=[_aggregate(END, 1, 1_000)],
            imported=[{"event_date": END, "payments": 1}],
        )
        for source in ("S01", "S02", "S03", "S04", "S05")
    ]
    totals = empty_totals()
    totals["by_scenario"]["S02"]["HOLD"] = 2
    totals["by_scenario"]["S04"]["CHALLENGE"] = 1
    totals["by_scenario"]["S07"]["HOLD"] = 9

    facts = _facts(parts=parts, case_totals=totals, scenario_id="MIX")

    assert facts.written["activity"]["transactions"] == "5"
    assert facts.written["activity"]["outbound_spend"] == "£50.00"
    assert facts.written["decisions"] == {"PASS": "1", "CHALLENGE": "1", "HOLD": "3"}
    # Cases from outside S01 to S05 are not the Mixed feed's.
    assert facts.written["cases"] == {
        "total": "3",
        "PASS": "0",
        "CHALLENGE": "1",
        "HOLD": "2",
    }


def test_scenario_labels_come_from_the_server_catalogue() -> None:
    assert scenario_label("S02") == "High-value and high-velocity risk"
    assert scenario_label("MIX") == "Mixed feed · S01 to S05"


# ---- Template (AC-5) ---------------------------------------------------------


def test_the_template_has_three_points_with_no_feed_cases_or_spend() -> None:
    facts = _facts(parts=[_part(aggregates=[_aggregate(END, 0, 0)])])
    headline, points = template_overview(facts)

    assert headline == (
        "Trusted recurring payment: 0 transactions and £0.00 outbound spend "
        "over 30 days."
    )
    assert points == [
        "0 PASS, 0 CHALLENGE and 0 HOLD.",
        "No day had outbound spend.",
        "Payments landed on 0 of 30 days.",
    ]


def test_the_template_adds_feed_and_cases_when_present() -> None:
    totals = empty_totals()
    totals["by_scenario"]["S01"]["PASS"] = 1
    headline, points = template_overview(
        _facts(feed=_feed(shown=12, raised=2), case_totals=totals)
    )
    assert points[1] == "The largest day was 23 Sep 2026, with £10,165.83 outbound."
    assert (
        points[3] == "Your live feed has shown 12 of 200 payments; the model raised 2."
    )
    assert points[4] == "You have 1 saved case for this scenario."
    assert len(points) == 5


def test_the_template_says_when_score_routing_is_off() -> None:
    _, points = template_overview(_facts(feed=_feed(policy=False, shown=3)))
    assert (
        points[3] == "Your live feed has shown 3 of 200 payments; score routing is off."
    )


def test_the_template_passes_its_own_fact_check() -> None:
    totals = empty_totals()
    totals["by_scenario"]["S01"]["HOLD"] = 1_234
    facts = _facts(feed=_feed(shown=12), case_totals=totals, scenario_id="S01")
    headline, points = template_overview(facts)
    assert is_grounded([headline, *points], facts)


# ---- Fact check (AC-4) -------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Outbound spend was £10,415.83 over 30 days.",
        "The largest day was 23 Sep 2026.",
        "S01 to S05 made 6 transactions, 3 PASS.",
        "Between 25 Aug 2026 and 23 Sep 2026, 2 days were active.",
    ],
)
def test_exact_figures_pass(text) -> None:
    assert is_grounded([text], _facts())


@pytest.mark.parametrize(
    "text",
    [
        "10% of payments were held.",
        "Spend reached £10k.",
        "Spend was about £10,416.",
        "The busiest day was 22 Sep 2026.",
        # A count that exists only as money.
        "There were 10,415.83 payments.",
        "Spend fell by -3 days.",
        "Spend rose +6 transactions.",
        "There were ten thousand payments.",
        "The largest day was 23 Sep.",
        "Payments landed in 2026.",
        "The largest day was 23 Sept 2026.",
    ],
)
def test_other_figures_fail(text) -> None:
    assert not is_grounded(["A fine headline.", text], _facts())


def test_only_the_accepted_shape_is_used() -> None:
    good = {"headline": "H", "points": ["a", "b", "c"]}
    assert valid_overview_shape(good) == ("H", ["a", "b", "c"])
    assert valid_overview_shape({**good, "advice": "x"}) is None
    assert valid_overview_shape({"headline": "H", "points": ["a", "b"]}) is None
    assert valid_overview_shape({"headline": "H", "points": ["a"] * 6}) is None
    assert valid_overview_shape({"headline": "x" * 161, "points": ["a"] * 3}) is None
    assert (
        valid_overview_shape({"headline": "H", "points": ["x" * 201, "b", "c"]}) is None
    )
    assert valid_overview_shape({"headline": "H", "points": ["a", 2, "c"]}) is None


# ---- The live writer (AC-4 to AC-6, AC-8) ----------------------------------


def _settings(
    live: bool = True, ready: bool = True, model_id: str = "allowed-model"
) -> OverviewSettings:
    return OverviewSettings(
        live_enabled=live,
        groq_api_key="test-key" if ready else None,
        groq_model=model_id,
        groq_allowed_models=(model_id,),
        limits=LIMITS,
        max_completion_tokens=400,
        reasoning_effort="low",
    )


class FakeProvider:
    model_id = "allowed-model"

    def __init__(self, output: object = None, error: Exception | None = None) -> None:
        self.output = output
        self.error = error
        self.calls: list[dict[str, Any]] = []

    async def complete_json(
        self, messages, *, max_completion_tokens, reasoning_effort=None
    ):
        self.calls.append(
            {
                "messages": messages,
                "max_completion_tokens": max_completion_tokens,
                "reasoning_effort": reasoning_effort,
            }
        )
        if self.error is not None:
            raise self.error
        if self.output == "hang":
            await asyncio.sleep(10)
        return self.output


class CountingAdmission(LiveAdmissionController):
    def __init__(self, allow: bool = True) -> None:
        super().__init__(LIMITS)
        self.allow = allow
        self.acquired = 0
        self.released = 0

    async def acquire(self, client_key):
        self.acquired += 1
        if not self.allow:
            from server.showcase_investigation.admission import AdmissionDecision

            return AdmissionDecision(False, "admission_limited")
        return await super().acquire(client_key)

    async def release(self):
        self.released += 1
        await super().release()


GROUNDED = {
    "headline": "Trusted recurring payment had 6 transactions over 30 days.",
    "points": [
        "Outbound spend was £10,415.83.",
        "The largest day was 23 Sep 2026, with £10,165.83 outbound.",
        "3 PASS decisions.",
    ],
}


def _write(writer: OverviewWriter, facts=None):
    return asyncio.run(writer.write(facts or _facts(), "client-a"))


def test_a_grounded_live_overview_is_used_with_its_model() -> None:
    provider = FakeProvider(GROUNDED)
    admission = CountingAdmission()
    result = _write(OverviewWriter(_settings(), provider=provider, admission=admission))

    assert result.source == "live"
    assert result.model_id == "allowed-model"
    assert result.fallback_reason is None
    assert result.headline == GROUNDED["headline"]
    # The model sees only the server built facts, with the token cap of 400.
    [call] = provider.calls
    assert call["max_completion_tokens"] == 400
    assert call["reasoning_effort"] is None
    assert json.loads(call["messages"][1]["content"]) == _facts().written
    assert admission.released == 1


@pytest.mark.parametrize("model_id", ["openai/gpt-oss-20b", "openai/gpt-oss-120b"])
def test_supported_gpt_oss_overviews_use_low_reasoning_effort(model_id) -> None:
    """Use the accepted low effort only for the two Groq supported model IDs."""
    provider = FakeProvider(GROUNDED)

    result = _write(OverviewWriter(_settings(model_id=model_id), provider=provider))

    assert result.source == "live"
    assert provider.calls[0]["reasoning_effort"] == "low"


def test_switch_off_is_the_template_and_takes_no_slot() -> None:
    admission = CountingAdmission()
    provider = FakeProvider(GROUNDED)
    result = _write(
        OverviewWriter(_settings(live=False), provider=provider, admission=admission)
    )
    assert (result.source, result.fallback_reason) == ("template", "live_disabled")
    assert result.model_id is None
    assert admission.acquired == 0 and provider.calls == []


def test_a_provider_that_is_not_ready_takes_no_slot() -> None:
    admission = CountingAdmission()
    result = _write(OverviewWriter(_settings(ready=False), admission=admission))
    assert result.fallback_reason == "provider_unavailable"
    assert admission.acquired == 0


def test_a_refused_slot_is_the_limit_reason() -> None:
    provider = FakeProvider(GROUNDED)
    result = _write(
        OverviewWriter(
            _settings(), provider=provider, admission=CountingAdmission(allow=False)
        )
    )
    assert result.fallback_reason == "admission_limited"
    assert provider.calls == []


def test_a_timeout_is_the_template_and_releases_the_slot(monkeypatch) -> None:
    fast = OverviewSettings(
        **{
            **_settings().__dict__,
            "limits": LiveLimits(**{**LIMITS.__dict__, "timeout_seconds": 1}),
        }
    )
    admission = CountingAdmission()
    monkeypatch.setattr(asyncio, "sleep", _fast_hang)
    result = _write(
        OverviewWriter(fast, provider=FakeProvider("hang"), admission=admission)
    )
    assert result.fallback_reason == "timeout"
    assert admission.released == 1


_real_sleep = asyncio.sleep


async def _fast_hang(seconds: float) -> None:
    # Wait past the one second timeout without slowing the suite further.
    await _real_sleep(min(seconds, 1.5))


@pytest.mark.parametrize(
    ("provider", "reason"),
    [
        (FakeProvider(error=InvalidProviderOutput("bad json")), "invalid_output"),
        (FakeProvider(error=ProviderUnavailable("down")), "provider_unavailable"),
        (FakeProvider({"headline": "H", "points": ["a"]}), "invalid_output"),
        (
            FakeProvider(
                {**GROUNDED, "points": [*GROUNDED["points"][:2], "10% held."]}
            ),
            "ungrounded",
        ),
    ],
)
def test_unusable_output_is_the_template_with_its_reason(provider, reason) -> None:
    admission = CountingAdmission()
    result = _write(OverviewWriter(_settings(), provider=provider, admission=admission))
    assert (result.source, result.fallback_reason) == ("template", reason)
    assert admission.released == 1


def test_a_live_call_logs_one_fixed_line_only(caplog) -> None:
    caplog.set_level(logging.INFO, logger="server.sandbox_data.overview_writer")
    _write(OverviewWriter(_settings(), provider=FakeProvider(GROUNDED)))

    assert [record.getMessage() for record in caplog.records] == [
        "overview_written source=live reason=none"
    ]


def test_the_live_prompt_requires_the_accepted_number_of_points() -> None:
    """Keep the provider instruction aligned with the response contract."""
    provider = FakeProvider(GROUNDED)

    assert _write(OverviewWriter(_settings(), provider=provider)).source == "live"

    system_message = provider.calls[0]["messages"][0]["content"]
    assert "exactly 3 to 5 points" in system_message


def test_the_overview_limits_never_share_run_showcases_counters() -> None:
    overview = OverviewWriter(_settings(), provider=FakeProvider(GROUNDED))
    for _ in range(3):
        assert _write(overview).source == "live"
    # The overview's own per visitor limit (3 per 10 minutes) is used up ...
    assert _write(overview).fallback_reason == "admission_limited"
    # ... and Run showcase's controller still admits the same visitor.
    showcase = LiveAdmissionController(LiveLimits(1, 2, 600, 10, 1800, 45))
    assert asyncio.run(showcase.acquire("client-a")).allowed
    # The reverse: a full Run showcase controller does not refuse an overview.
    fresh = OverviewWriter(_settings(), provider=FakeProvider(GROUNDED))
    assert _write(fresh).source == "live"


def test_accepted_config_loads_with_the_switch_off_by_default(monkeypatch) -> None:
    monkeypatch.delenv("SHOWCASE_OVERVIEW_LIVE_ENABLED", raising=False)
    settings = load_overview_settings()
    assert settings.live_enabled is False
    assert settings.limits == LIMITS
    assert settings.max_completion_tokens == 400
    assert settings.reasoning_effort == "low"


def test_overviews_can_set_effort_without_changing_investigations() -> None:
    seen: list[tuple[int, str | None]] = []

    class Completions:
        async def create(self, **kwargs):
            seen.append(
                (kwargs["max_completion_tokens"], kwargs.get("reasoning_effort"))
            )
            message = type("M", (), {"content": json.dumps({"tools": []})})
            return type("R", (), {"choices": [type("C", (), {"message": message})]})

    client = type(
        "Client", (), {"chat": type("Chat", (), {"completions": Completions()})}
    )
    provider = GroqInvestigationProvider("key", "model", client=client)

    asyncio.run(
        provider.complete_json([], max_completion_tokens=400, reasoning_effort="low")
    )
    with pytest.raises(InvalidProviderOutput):
        asyncio.run(provider.select_tools({}, ["get_payee_evidence"]))
    assert seen == [(400, "low"), (800, None)]


def test_a_groq_json_validation_failure_is_invalid_output() -> None:
    """Label Groq JSON mode refusal as unusable output, not an outage."""

    class Completions:
        async def create(self, **kwargs):
            request = Request("POST", "https://api.groq.com/openai/v1/chat/completions")
            response = Response(400, request=request)
            raise BadRequestError(
                "JSON validation failed",
                response=response,
                body={"error": {"code": "json_validate_failed"}},
            )

    client = type(
        "Client", (), {"chat": type("Chat", (), {"completions": Completions()})}
    )
    provider = GroqInvestigationProvider("key", "model", client=client)

    with pytest.raises(InvalidProviderOutput):
        asyncio.run(provider.complete_json([], max_completion_tokens=400))


# ---- The route (AC-1, AC-2, AC-6, AC-7, AC-8) -------------------------------


def _sources(scenario_id, simulation_run_id=None, browser_id=None):
    feed = _feed() if simulation_run_id == RUN_ID and browser_id == BROWSER else None
    return {
        "parts": [
            _part(
                aggregates=[_aggregate(END, 4, 1_016_583)],
                imported=[{"event_date": END, "payments": 3}],
            )
        ],
        "feed": feed,
    }


@pytest.fixture
def overview_client(monkeypatch):
    calls: list[tuple] = []

    def load(scenario_id, simulation_run_id=None, browser_id=None):
        calls.append((scenario_id, simulation_run_id, browser_id))
        return _sources(scenario_id, simulation_run_id, browser_id)

    monkeypatch.setattr(main, "load_sandbox_overview_sources", load)
    monkeypatch.delenv("SHOWCASE_OVERVIEW_LIVE_ENABLED", raising=False)
    client = TestClient(create_app())
    client.calls = calls
    return client


def _schema(repository_root: Path) -> dict:
    return json.loads(
        (repository_root / "docs/contracts/sandbox-overview.v1.schema.json").read_text()
    )


def test_the_route_writes_a_template_with_the_switch_off(
    overview_client, repository_root
) -> None:
    response = overview_client.post(
        "/sandbox/scenarios/S01/overview",
        json={"range": "30", "simulation_run_id": RUN_ID},
        headers=OWNER,
    )
    assert response.status_code == 200
    body = response.json()
    jsonschema.validate(body, _schema(repository_root))
    assert body["source"] == "template"
    assert body["fallback_reason"] == "live_disabled"
    assert body["model_id"] is None
    assert body["window"] == {"start": "2026-08-25", "end": "2026-09-23", "days": 30}
    # Case storage is off in tests, so only the feed is included.
    assert body["included"] == {"feed": True, "cases": False}
    assert overview_client.calls == [("S01", RUN_ID, BROWSER)]


@pytest.mark.parametrize("header", [{}, {"X-Showcase-Browser-Id": "not-a-uuid"}])
def test_no_or_a_malformed_browser_id_leaves_feed_and_cases_out(
    overview_client, header
) -> None:
    response = overview_client.post(
        "/sandbox/scenarios/S01/overview",
        json={"range": "7", "simulation_run_id": RUN_ID},
        headers=header,
    )
    assert response.status_code == 200
    assert response.json()["included"] == {"feed": False, "cases": False}
    # Without a browser ID the run ID is never used.
    assert overview_client.calls == [("S01", None, None)]


def test_saved_cases_enter_the_facts_for_their_owner(monkeypatch) -> None:
    totals = empty_totals()
    totals["by_scenario"]["S01"]["CHALLENGE"] = 2

    class Cases:
        def list_cases(self, browser_id, *, limit):
            assert (browser_id, limit) == (BROWSER, 1)
            return CasePage([], None, totals)

    monkeypatch.setattr(main, "load_sandbox_overview_sources", _sources)
    monkeypatch.setattr(main, "PsycopgCaseRepository", lambda url: Cases())
    monkeypatch.setenv("SHOWCASE_CASES_ENABLED", "true")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example.invalid/db")
    body = (
        TestClient(create_app())
        .post("/sandbox/scenarios/S01/overview", json={"range": "all"}, headers=OWNER)
        .json()
    )
    assert body["included"] == {"feed": False, "cases": True}
    assert body["points"][-1] == "You have 2 saved cases for this scenario."


def test_failing_case_storage_leaves_only_cases_out(monkeypatch) -> None:
    class Cases:
        def list_cases(self, browser_id, *, limit):
            raise CasesUnavailable("connection_failed")

    monkeypatch.setattr(main, "load_sandbox_overview_sources", _sources)
    monkeypatch.setattr(main, "PsycopgCaseRepository", lambda url: Cases())
    monkeypatch.setenv("SHOWCASE_CASES_ENABLED", "true")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example.invalid/db")
    response = TestClient(create_app()).post(
        "/sandbox/scenarios/S01/overview",
        json={"range": "all", "simulation_run_id": RUN_ID},
        headers=OWNER,
    )
    assert response.status_code == 200
    assert response.json()["included"] == {"feed": True, "cases": False}


@pytest.mark.parametrize(
    ("scenario_id", "status", "detail"),
    [
        ("S06", 404, "sandbox_scenario_not_decided"),
        ("S08", 404, "sandbox_scenario_not_decided"),
        ("S09", 404, "sandbox_scenario_not_found"),
        ("mix", 404, "sandbox_scenario_not_found"),
    ],
)
def test_workflow_and_unknown_scenarios_are_refused(
    overview_client, scenario_id, status, detail
) -> None:
    response = overview_client.post(
        f"/sandbox/scenarios/{scenario_id}/overview", json={"range": "7"}
    )
    assert (response.status_code, response.json()["detail"]) == (status, detail)
    assert overview_client.calls == []


@pytest.mark.parametrize(
    "body",
    [
        {"range": "14"},
        {},
        {"range": "7", "simulation_run_id": "not-a-run"},
        {"range": "7", "headline": "injected text"},
    ],
)
def test_a_bad_body_is_a_redacted_422(overview_client, body) -> None:
    response = overview_client.post("/sandbox/scenarios/S01/overview", json=body)
    assert response.status_code == 422
    assert response.json() == {"detail": "invalid_overview_request"}


def test_the_read_limit_is_always_on(monkeypatch) -> None:
    monkeypatch.setattr(main, "load_sandbox_overview_sources", _sources)
    monkeypatch.delenv("PUBLIC_DATABASE_GUARDS_ENABLED", raising=False)
    monkeypatch.setenv("SHOWCASE_CLIENT_CASE_READS_PER_MINUTE", "2")
    client = TestClient(create_app())
    statuses = [
        client.post("/sandbox/scenarios/S01/overview", json={"range": "7"}).status_code
        for _ in range(3)
    ]
    assert statuses == [200, 200, 429]
    refused = client.post("/sandbox/scenarios/S01/overview", json={"range": "7"})
    assert refused.json() == {"detail": "overview_rate_limited"}


def test_unavailable_data_is_a_redacted_503(monkeypatch) -> None:
    def load(*args):
        raise service.SandboxDataUnavailable("Sandbox database is unavailable")

    monkeypatch.setattr(main, "load_sandbox_overview_sources", load)
    response = TestClient(create_app()).post(
        "/sandbox/scenarios/MIX/overview", json={"range": "all"}
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "sandbox_scenario_data_unavailable"}


def test_the_route_logs_no_facts_or_run_id(overview_client, caplog) -> None:
    caplog.set_level(logging.INFO, logger="server")
    overview_client.post(
        "/sandbox/scenarios/S01/overview",
        json={"range": "30", "simulation_run_id": RUN_ID},
        headers=OWNER,
    )
    logged = " ".join(record.getMessage() for record in caplog.records)
    assert "overview_written source=template reason=live_disabled" in logged
    assert RUN_ID not in logged and BROWSER not in logged and "£" not in logged


# ---- The single read (AC-3, AC-7) -------------------------------------------


class OverviewCursor:
    """Answer the overview read's queries by what they select."""

    def __init__(self, run: dict | None, owner_run: dict | None = None) -> None:
        self.run = run
        self.owner_run = owner_run
        self.statements: list[str] = []
        self._last = ""
        self._parameters: tuple = ()

    def execute(self, query, parameters=()) -> None:
        self._last = " ".join(str(query).split())
        self._parameters = parameters
        self.statements.append(self._last)

    def fetchone(self):
        if "FROM sandbox_datasets" in self._last:
            return {
                "scenario_id": self._parameters[0],
                "fixture_version": "s01-v1",
                "start_date": START,
                "end_date": END,
            }
        if "SELECT run_id, scenario_id" in self._last:
            return self.run
        if "MIN(due_at)" in self._last:
            return {"next_due_at": None}
        if (
            "SELECT scenario_id, fixture_version FROM sandbox_simulation_runs"
            in self._last
        ):
            return self.owner_run
        raise AssertionError(self._last)

    def fetchall(self):
        return []

    def __enter__(self):
        return self

    def __exit__(self, *exc) -> None:
        return None


class OverviewConnection:
    def __init__(self, cursor: OverviewCursor) -> None:
        self._cursor = cursor

    def cursor(self) -> OverviewCursor:
        return self._cursor

    def __enter__(self):
        return self

    def __exit__(self, *exc) -> None:
        return None


def _run(scenario_id: str = "S01") -> dict:
    return {
        "run_id": RUN_ID,
        "scenario_id": scenario_id,
        "fixture_version": "s01-v1",
        "seed": "seed",
        "state": "running",
        "scheduled_event_count": 200,
        "appended_event_count": 0,
        "created_at": None,
        "started_at": None,
        "completed_at": None,
        "failure_reason": None,
    }


def _read(monkeypatch, cursor: OverviewCursor, scenario_id: str = "S01"):
    monkeypatch.setattr(
        service.psycopg, "connect", lambda *a, **k: OverviewConnection(cursor)
    )
    return PsycopgScenarioRepository(
        "postgresql://example.invalid/db"
    ).read_overview_sources(scenario_id, RUN_ID, BROWSER)


def test_the_viewers_own_run_is_overlaid(monkeypatch) -> None:
    cursor = OverviewCursor(
        _run(), owner_run={"scenario_id": "S01", "fixture_version": "s01-v1"}
    )
    sources = _read(monkeypatch, cursor)
    assert sources["feed"]["run_id"] == RUN_ID
    assert any(
        "FROM sandbox_simulation_events WHERE run_id" in s for s in cursor.statements
    )


def test_the_overview_read_uses_one_repeatable_read_snapshot(monkeypatch) -> None:
    """Require every overview figure to come from the same database snapshot."""
    cursor = OverviewCursor(
        _run(), owner_run={"scenario_id": "S01", "fixture_version": "s01-v1"}
    )

    _read(monkeypatch, cursor)

    assert (
        cursor.statements[0]
        == "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
    )


def test_an_unknown_or_foreign_run_leaves_only_the_feed_out(monkeypatch) -> None:
    cursor = OverviewCursor(None)
    sources = _read(monkeypatch, cursor)
    assert sources["feed"] is None
    assert len(sources["parts"]) == 1
    # No overlay query runs for a run that is not the viewer's.
    assert not any(
        "FROM sandbox_simulation_events WHERE run_id = %s AND appended_at IS NOT NULL"
        in s
        for s in cursor.statements
    )


def test_a_run_for_another_scenario_is_left_out(monkeypatch) -> None:
    cursor = OverviewCursor(
        _run("S02"), owner_run={"scenario_id": "S02", "fixture_version": "s01-v1"}
    )
    assert _read(monkeypatch, cursor)["feed"] is None


def test_the_mixed_feed_reads_five_sources(monkeypatch) -> None:
    cursor = OverviewCursor(None)
    sources = _read(monkeypatch, cursor, "MIX")
    assert len(sources["parts"]) == 5
    assert [part["rule_recommendation"] for part in sources["parts"]] == [
        "PASS",
        "HOLD",
        "HOLD",
        "CHALLENGE",
        "HOLD",
    ]


def test_workflow_scenarios_have_no_overview_read(monkeypatch) -> None:
    with pytest.raises(ScenarioNotDecided):
        _read(monkeypatch, OverviewCursor(None), "S07")
    with pytest.raises(ScenarioDatasetNotFound):
        _read(monkeypatch, OverviewCursor(None), "X01")
