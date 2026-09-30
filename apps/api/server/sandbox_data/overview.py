"""Build a scenario overview's facts, its template summary, and its fact check (spec 0011).

Everything here is pure: the facts come from ``read_overview_sources`` and
the viewer's case totals, and nothing is read, stored or logged. The facts
reproduce the Risk Console's own rules (the date window in
``scenario-date-window.ts``, the stat cards in ``summariseSandboxActivity``,
the decisions chart's counts), so the two must change together.
"""

import functools
import json
import os
import re
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Literal

from server.sandbox_data.service import (
    MIXED_FEED_ID,
    MIXED_FEED_SOURCES,
    _calendar_days,
    _decision_days,
)

OverviewRange = Literal["7", "30", "all"]

_OUTCOMES = ("PASS", "CHALLENGE", "HOLD")
_MONTHS = (
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
)
MIXED_FEED_LABEL = "Mixed feed · S01 to S05"

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
_FIXTURE_PATH = Path("fixtures/s01-s08/scenarios.v1.json")

# Output bounds for a headline and its points (AC-4).
HEADLINE_MAX = 160
POINT_MAX = 200
POINTS_MIN = 3
POINTS_MAX = 5


def write_count(value: int) -> str:
    """Write a count as the dashboard does: ``1,234`` (``Intl.NumberFormat("en-GB")``)."""
    return f"{value:,}"


def write_money(amount_minor: int) -> str:
    """Write pence as the stat cards do: ``£10,165.83`` (en-GB, GBP).

    Integer arithmetic only, so no float rounding can change a penny.
    """
    return f"£{amount_minor // 100:,}.{amount_minor % 100:02d}"


def write_date(day: date) -> str:
    """Write a date as the dashboard does (date-fns ``d MMM yyyy``): ``2 Sep 2026``."""
    return f"{day.day} {_MONTHS[day.month - 1]} {day.year}"


@functools.cache
def _scenario_titles(root: Path) -> dict[str, str]:
    """Read S01 to S08 titles from the accepted fixture packet (the server's catalogue)."""
    document = json.loads((root / _FIXTURE_PATH).read_text(encoding="utf-8"))
    return {
        str(scenario["scenario_id"]): str(scenario["title"])
        for scenario in document["scenarios"]
    }


def scenario_label(scenario_id: str) -> str:
    """Return the overview's scenario label.

    Args:
        scenario_id: ``S01`` to ``S05``, or ``MIX``.

    Returns:
        ``Mixed feed · S01 to S05`` for the Mixed feed, else the scenario's
        title from ``fixtures/s01-s08/scenarios.v1.json`` (its wording may
        differ slightly from the web app's picker).

    Raises:
        OSError, KeyError, ValueError: If the accepted fixture cannot be read.

    Side effects:
        Reads the fixture once per root (``FCA_SHOWCASE_ROOT`` in an image).
    """
    if scenario_id == MIXED_FEED_ID:
        return MIXED_FEED_LABEL
    override = os.getenv("FCA_SHOWCASE_ROOT", "").strip()
    root = Path(override) if override else _REPOSITORY_ROOT
    return _scenario_titles(root)[scenario_id]


@dataclass(frozen=True)
class OverviewFacts:
    """The figures an overview may state, as numbers and as written tokens.

    Attributes:
        scenario_id: ``S01`` to ``S05`` or ``MIX``.
        window_start: First day shown.
        window_end: Last day shown.
        written: The facts object sent to the model, every figure already
            written as the dashboard writes it.
        feed_included: Whether the viewer's own run is in the facts.
        cases_included: Whether the viewer's saved cases are in the facts.
    """

    scenario_id: str
    window_start: date
    window_end: date
    written: dict[str, Any]
    feed_included: bool
    cases_included: bool

    @property
    def window_days(self) -> int:
        """Return the number of calendar days in the window, both ends included."""
        return (self.window_end - self.window_start).days + 1


def overview_window(start: date, end: date, range_: OverviewRange) -> tuple[date, date]:
    """Resolve a range as ``scenarioDateWindow`` does.

    The dataset's last day, counted back 7 or 30 days but never past its
    first day; ``all`` is the whole dataset.
    """
    if range_ == "all":
        return start, end
    return max(start, end - timedelta(days=int(range_) - 1)), end


def build_overview_facts(
    scenario_id: str,
    range_: OverviewRange,
    sources: dict[str, Any],
    case_totals: dict[str, Any] | None,
    label: str,
) -> OverviewFacts:
    """Build an overview's facts from stored data only (AC-3).

    Args:
        scenario_id: ``S01`` to ``S05`` or ``MIX``.
        range_: The dashboard's selected range.
        sources: ``read_overview_sources`` output: ``parts`` and ``feed``.
        case_totals: The viewer's case list totals (``by_scenario``), or None
            when there is no browser ID or case storage is off or failing.
        label: The scenario label.

    Returns:
        The facts, with the window, activity, decisions, feed and cases.
    """
    parts = sources["parts"]
    # The Mixed feed spans the earliest start and latest end of its sources,
    # as the web app's combineAnalytics does.
    start, end = overview_window(
        min(part["start_date"] for part in parts),
        max(part["end_date"] for part in parts),
        range_,
    )
    days = _calendar_days(start, end)

    # Activity: daily aggregates (the run's shown payments already added)
    # summed across sources by date, then over the window, by the cards' rule.
    transactions_by_day = dict.fromkeys(days, 0)
    spend_by_day = dict.fromkeys(days, 0)
    for part in parts:
        for aggregate in part["aggregates"]:
            day = aggregate["aggregate_date"]
            if day in transactions_by_day:
                transactions_by_day[day] += aggregate["transaction_count"]
                spend_by_day[day] += aggregate["outbound_amount_minor"]
    largest: date | None = None
    for day in days:
        # The first day with the highest outbound spend above zero.
        if spend_by_day[day] > 0 and (
            largest is None or spend_by_day[day] > spend_by_day[largest]
        ):
            largest = day

    # Decisions: outbound payments per day by the chart's rule, run added.
    decided = dict.fromkeys(_OUTCOMES, 0)
    for part in parts:
        for day in _decision_days(
            part["start_date"],
            part["end_date"],
            part["rule_recommendation"],
            part["imported"],
            part["revealed"],
        )["days"]:
            if start <= date.fromisoformat(day["date"]) <= end:
                for outcome in _OUTCOMES:
                    decided[outcome] += day[outcome]

    feed = sources.get("feed")
    written_feed = None
    if feed is not None:
        snapshot = feed["routing_snapshot"]
        written_feed = {
            "state": str(feed["state"]),
            "shown": write_count(int(feed["appended_event_count"])),
            "scheduled": write_count(int(feed["scheduled_event_count"])),
            **{
                outcome: write_count(
                    int(snapshot["by_recommendation"][outcome]["count"])
                )
                for outcome in _OUTCOMES
            },
            "raised_by_model": write_count(int(snapshot["raised_by_model"])),
            "score_routing_on": snapshot["routing_policy"] is not None,
        }

    written_cases = None
    if case_totals is not None:
        scenarios = (
            MIXED_FEED_SOURCES if scenario_id == MIXED_FEED_ID else (scenario_id,)
        )
        counts = dict.fromkeys(_OUTCOMES, 0)
        for source in scenarios:
            by_outcome = case_totals["by_scenario"].get(source, {})
            for outcome in _OUTCOMES:
                counts[outcome] += int(by_outcome.get(outcome, 0))
        written_cases = {
            "total": write_count(sum(counts.values())),
            **{outcome: write_count(count) for outcome, count in counts.items()},
        }

    written = {
        "scenario": {"id": scenario_id, "label": label},
        "window": {
            "start": write_date(start),
            "end": write_date(end),
            "days": write_count(len(days)),
        },
        "activity": {
            "transactions": write_count(sum(transactions_by_day.values())),
            "outbound_spend": write_money(sum(spend_by_day.values())),
            "active_days": write_count(
                sum(1 for count in transactions_by_day.values() if count > 0)
            ),
            "largest_day": (
                {
                    "date": write_date(largest),
                    "outbound_spend": write_money(spend_by_day[largest]),
                }
                if largest is not None
                else None
            ),
        },
        "decisions": {outcome: write_count(decided[outcome]) for outcome in _OUTCOMES},
        "feed": written_feed,
        "cases": written_cases,
    }
    return OverviewFacts(
        scenario_id=scenario_id,
        window_start=start,
        window_end=end,
        written=written,
        feed_included=written_feed is not None,
        cases_included=written_cases is not None,
    )


def template_overview(facts: OverviewFacts) -> tuple[str, list[str]]:
    """Write the template summary from the facts by fixed rules (AC-5).

    The first three points are always present, so there are always 3 to 5.
    """
    written = facts.written
    activity = written["activity"]
    window = written["window"]
    decisions = written["decisions"]
    headline = (
        f"{written['scenario']['label']}: {activity['transactions']} transactions "
        f"and {activity['outbound_spend']} outbound spend over {window['days']} days."
    )
    largest = activity["largest_day"]
    points = [
        (
            f"{decisions['PASS']} PASS, {decisions['CHALLENGE']} CHALLENGE and "
            f"{decisions['HOLD']} HOLD."
        ),
        (
            f"The largest day was {largest['date']}, with "
            f"{largest['outbound_spend']} outbound."
            if largest is not None
            else "No day had outbound spend."
        ),
        f"Payments landed on {activity['active_days']} of {window['days']} days.",
    ]
    feed = written["feed"]
    if feed is not None:
        shown = (
            f"Your live feed has shown {feed['shown']} of {feed['scheduled']} payments"
        )
        points.append(
            f"{shown}; the model raised {feed['raised_by_model']}."
            if feed["score_routing_on"]
            else f"{shown}; score routing is off."
        )
    cases = written["cases"]
    if cases is not None:
        noun = "case" if cases["total"] == "1" else "cases"
        points.append(f"You have {cases['total']} saved {noun} for this scenario.")
    return headline, points


def _allowed_figures(written: dict[str, Any]) -> set[str]:
    """Return every figure token the facts write: counts, money and dates."""
    tokens: set[str] = set()

    def collect(value: object) -> None:
        if isinstance(value, dict):
            for item in value.values():
                collect(item)
        elif isinstance(value, str) and any(char.isdigit() for char in value):
            tokens.add(value)

    # The scenario's ID and label are names, not figures.
    collect({key: value for key, value in written.items() if key != "scenario"})
    return tokens


_SCENARIO_ID = re.compile(r"\bS0\d\b")
_MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?"
_DATE = re.compile(rf"\b\d{{1,2}} {_MONTH} \d{{4}}\b")
_DAY_MONTH = re.compile(rf"\b\d{{1,2}} {_MONTH}(?! \d)")
# A figure: an optional sign, an optional pound sign, digits with any commas
# or decimal point inside, and anything glued to the end (%, k, m, st).
_FIGURE = re.compile(r"[+\-−]?£?\d(?:[\d,.]*\d)?[%A-Za-z]*")
_NUMBER_WORDS = re.compile(
    r"\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|"
    r"thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|"
    r"thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|"
    r"millions?|billions?|dozens?)\b",
    re.IGNORECASE,
)


def is_grounded(texts: list[str], facts: OverviewFacts) -> bool:
    """Return whether every figure in ``texts`` is written exactly as the facts write it.

    Scenario IDs are skipped. Dates must be whole (day, month, year) and
    match a fact's date character for character; every other figure,
    money included, must equal a fact's token exactly. A sign, a ``%``, an
    abbreviation, rounding, a partial date or a number word fails.
    """
    allowed = _allowed_figures(facts.written)
    for text in texts:
        remaining = _SCENARIO_ID.sub(" ", text)
        if _NUMBER_WORDS.search(remaining):
            return False
        for match in _DATE.finditer(remaining):
            if match.group(0) not in allowed:
                return False
        remaining = _DATE.sub(" ", remaining)
        if _DAY_MONTH.search(remaining):
            return False
        for match in _FIGURE.finditer(remaining):
            if match.group(0) not in allowed:
                return False
    return True


def valid_overview_shape(output: object) -> tuple[str, list[str]] | None:
    """Return ``(headline, points)`` when model output has the accepted shape, else None.

    Exactly ``headline`` (1 to 160 characters) and ``points`` (3 to 5 strings,
    each 1 to 200 characters); anything else is rejected.
    """
    if not isinstance(output, dict) or set(output) != {"headline", "points"}:
        return None
    headline, points = output["headline"], output["points"]
    if not isinstance(headline, str) or not isinstance(points, list):
        return None
    headline = headline.strip()
    if not 1 <= len(headline) <= HEADLINE_MAX:
        return None
    if not POINTS_MIN <= len(points) <= POINTS_MAX:
        return None
    cleaned = []
    for point in points:
        if not isinstance(point, str) or not 1 <= len(point.strip()) <= POINT_MAX:
            return None
        cleaned.append(point.strip())
    return headline, cleaned
