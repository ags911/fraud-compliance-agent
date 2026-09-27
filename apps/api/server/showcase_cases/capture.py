"""Turn one run's emitted events into a validated, immutable case record."""

import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

RETENTION = timedelta(days=30)
# Per browser caps, each applied only to its own origin (spec 0004): Run
# showcase cases and live feed cases never trim each other.
MAX_CASES_PER_BROWSER = 50
MAX_FEED_CASES_PER_BROWSER = 20
MAX_CASES_BY_ORIGIN = {
    "showcase": MAX_CASES_PER_BROWSER,
    "feed": MAX_FEED_CASES_PER_BROWSER,
}
CONTRACT_VERSION = "1.0"


class CaseCaptureError(ValueError):
    """Signal that a run's events cannot form a complete, valid case."""


@dataclass(frozen=True)
class CapturedEvent:
    """One emitted event with the server time the stream wrapper received it."""

    payload: dict[str, Any]
    recorded_at: datetime

    @property
    def sequence(self) -> int:
        """Return the event's contract sequence number."""
        return int(self.payload["sequence"])


@dataclass(frozen=True)
class CaseRecord:
    """One completed run: summary columns plus its events in sequence order."""

    case_id: str
    scenario_id: str
    requested_mode: str
    execution_mode: str
    fallback_reason: str | None
    provider: str | None
    model_id: str | None
    deterministic_route: str
    investigation_status: str
    recommendation: str
    recommendation_basis: str
    failure_reason: str | None
    authority_status: str
    tool_call_count: int
    evidence_count: int
    event_count: int
    fixture_version: str | None
    started_at: datetime
    completed_at: datetime
    expires_at: datetime
    events: tuple[CapturedEvent, ...]
    contract_version: str = CONTRACT_VERSION
    # "showcase" for a Run showcase stream, "feed" for a live feed payment.
    origin: str = "showcase"
    # Display only evidence on a feed case; null until spec 0004 slice 3.
    model_score: float | None = None
    model_version: str | None = None


class EventValidator:
    """Validate emitted events against the accepted v1 event schema."""

    def __init__(self, schema_path: Path) -> None:
        """Compile the accepted schema once.

        Raises:
            OSError: If the schema file cannot be read.
            ValueError: If the schema file is not valid JSON.
        """
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        self._validator = Draft202012Validator(schema)

    def validate(self, payload: dict[str, Any]) -> None:
        """Raise CaseCaptureError when a payload is not an accepted v1 event."""
        try:
            self._validator.validate(payload)
        except ValidationError as error:
            raise CaseCaptureError(
                "an emitted event failed schema validation"
            ) from error


def _single(events: Sequence[CapturedEvent], name: str) -> CapturedEvent:
    """Return the one event of a type, or fail when it is missing or repeated."""
    matches = [event for event in events if event.payload.get("event") == name]
    if len(matches) != 1:
        raise CaseCaptureError(f"a case needs exactly one {name} event")
    return matches[0]


def build_case(
    events: Sequence[CapturedEvent], validator: EventValidator
) -> CaseRecord:
    """Build one case from a run's identity bearing events.

    Args:
        events: Every emitted event that carries an ``event_id`` (all but
            ``done``), in any order.
        validator: The compiled accepted event schema.

    Returns:
        The immutable case record, events sorted by sequence.

    Raises:
        CaseCaptureError: If the run did not reach ``run_result``, mixes runs,
            repeats a sequence, or any event fails validation.
    """
    if not events:
        raise CaseCaptureError("a run with no events cannot form a case")
    for event in events:
        validator.validate(event.payload)

    ordered = tuple(sorted(events, key=lambda event: event.sequence))
    if len({event.sequence for event in ordered}) != len(ordered):
        raise CaseCaptureError("a case cannot repeat a sequence number")
    if len({event.payload["event_id"] for event in ordered}) != len(ordered):
        raise CaseCaptureError("a case cannot repeat an event ID")
    run_ids = {event.payload["run_id"] for event in ordered}
    scenario_ids = {event.payload["scenario_id"] for event in ordered}
    if len(run_ids) != 1 or len(scenario_ids) != 1:
        raise CaseCaptureError("a case must hold exactly one run")

    started = _single(ordered, "run_started")
    route = _single(ordered, "route_resolved")
    result = _single(ordered, "run_result")
    investigations = [
        event for event in ordered if event.payload["event"] == "investigation_result"
    ]
    if len(investigations) > 1:
        raise CaseCaptureError("a case cannot hold two investigation results")
    if result.payload["execution_mode"] != started.payload["execution_mode"]:
        raise CaseCaptureError("run_started and run_result disagree on execution mode")

    evidence = [
        item
        for event in ordered
        if event.payload["event"] == "tool_result"
        for item in event.payload["evidence"]
    ]
    failure_reason = (
        investigations[0].payload.get("failure_reason") if investigations else None
    )
    return CaseRecord(
        case_id=next(iter(run_ids)),
        scenario_id=next(iter(scenario_ids)),
        requested_mode=started.payload["requested_mode"],
        execution_mode=result.payload["execution_mode"],
        fallback_reason=started.payload.get("fallback_reason"),
        provider=started.payload.get("provider"),
        model_id=started.payload.get("model_id"),
        deterministic_route=route.payload["deterministic_route"],
        investigation_status=result.payload["investigation_status"],
        recommendation=result.payload["recommendation"],
        recommendation_basis=result.payload["recommendation_basis"],
        failure_reason=failure_reason,
        authority_status=result.payload["authority_status"],
        tool_call_count=sum(
            1 for event in ordered if event.payload["event"] == "tool_call"
        ),
        evidence_count=len(evidence),
        event_count=len(ordered),
        fixture_version=evidence[0]["fixture_version"] if evidence else None,
        started_at=started.recorded_at,
        completed_at=result.recorded_at,
        expires_at=result.recorded_at + RETENTION,
        events=ordered,
    )
