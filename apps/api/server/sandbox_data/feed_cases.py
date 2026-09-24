"""Build one live feed payment's case from the accepted event shapes (spec 0004).

A feed case is four public-showcase-events.v1 payloads, built through spec
0002's ``build_case`` and ``EventValidator``, so it is stored, listed and
opened exactly like a Run showcase case.
"""

import dataclasses
from datetime import datetime
from typing import Any

from server.sandbox_data.decisions import FeedDecision
from server.showcase_cases.capture import (
    CapturedEvent,
    CaseRecord,
    EventValidator,
    build_case,
)


def _run_hex(simulation_run_id: str) -> str:
    """Return the first 12 hex digits of a run UUID, hyphens removed."""
    return simulation_run_id.replace("-", "").lower()[:12]


def feed_case_id(simulation_run_id: str, sequence: int) -> str:
    """Return a payment's case ID, for example ``run_feed_3f2a9c1e7b4d_007``.

    Args:
        simulation_run_id: The feed run's UUID.
        sequence: The payment's one based position in that run.
    """
    return f"run_feed_{_run_hex(simulation_run_id)}_{sequence:03d}"


def build_feed_case(
    *,
    simulation_run_id: str,
    sequence: int,
    scenario_id: str,
    decision: FeedDecision,
    due_at: datetime,
    validator: EventValidator,
    model_score: float | None = None,
    model_version: str | None = None,
) -> CaseRecord:
    """Build and validate the case for one revealed non PASS feed payment.

    Args:
        simulation_run_id: The feed run's UUID.
        sequence: The payment's one based position in that run.
        scenario_id: The run's scenario, S01 to S05.
        decision: The scenario's rule decision stored on the payment.
        due_at: The payment's due time; every event is recorded at it, so
            cases revealed in one poll still order stably.
        validator: The compiled accepted event schema.
        model_score: The payment's display only score, if one exists.
        model_version: The version of the model that produced that score.

    Returns:
        A ``feed`` case whose events are valid ``public-showcase-events.v1``
        payloads, expiring 30 days after ``due_at``.

    Raises:
        CaseCaptureError: If any event fails validation; nothing is stored.
    """
    case_id = feed_case_id(simulation_run_id, sequence)
    prefix = f"evt_feed_{_run_hex(simulation_run_id)}_{sequence:03d}"

    # Built explicitly: the runtime's identity helper would truncate these IDs.
    def identity(number: int, event: str) -> dict[str, Any]:
        return {
            "schema_version": "1.0",
            "event_id": f"{prefix}_{number}",
            "run_id": case_id,
            "scenario_id": scenario_id,
            "sequence": number,
            "event": event,
        }

    payloads = [
        {
            **identity(1, "run_started"),
            "requested_mode": "recorded",
            "execution_mode": "recorded",
            "fallback_reason": None,
            "provider": None,
            "model_id": None,
            "data_label": "synthetic",
        },
        {
            **identity(2, "route_resolved"),
            "deterministic_route": decision.deterministic_route,
            "investigation_eligibility": "skipped",
        },
        {**identity(3, "investigation_skipped"), "reason": decision.skip_reason},
        {
            **identity(4, "run_result"),
            "investigation_status": "skipped",
            "recommendation": decision.recommendation,
            "recommendation_basis": decision.recommendation_basis,
            "authority_status": "not_evaluated",
            "simulated_action": "none",
            "execution_mode": "recorded",
            "data_label": "synthetic",
        },
    ]
    record = build_case(
        [CapturedEvent(payload=payload, recorded_at=due_at) for payload in payloads],
        validator,
    )
    return dataclasses.replace(
        record, origin="feed", model_score=model_score, model_version=model_version
    )
