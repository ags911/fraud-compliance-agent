"""Build one live feed payment's case from the accepted event shapes (spec 0004).

A feed case is four public-showcase-events.v1 payloads, built through spec
0002's ``build_case`` and ``EventValidator``, so it is stored, listed and
opened exactly like a Run showcase case. A payment the model raised (spec 0010,
ADR-025) is instead four public-showcase-events.v2 payloads whose result
explains the score and thresholds.
"""

import dataclasses
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from server.sandbox_data.decisions import FeedDecision
from server.showcase_cases.capture import (
    CapturedEvent,
    CaseRecord,
    EventValidator,
    build_case,
)


@dataclass(frozen=True)
class ModelRouting:
    """Why the model raised a rule cleared payment, as its v2 case states it.

    Attributes:
        score: The stored score, rounded to 5 places.
        challenge: The policy's CHALLENGE threshold.
        hold: The policy's HOLD threshold.
        policy_version: The policy the payment stored at run start.
        model_version: The model that produced the score.
        synthetic_outlier: Whether the payment is a planted S01 outlier.
    """

    score: float
    challenge: float
    hold: float
    policy_version: str
    model_version: str
    synthetic_outlier: bool


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
    model_routing: ModelRouting | None = None,
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
        model_routing: Set only when the model raised the payment; the case
            then uses ``public-showcase-events.v2`` and ``validator`` must be
            the v2 schema.

    Returns:
        A ``feed`` case whose events are valid ``public-showcase-events.v1``
        payloads (v2 when ``model_routing`` is set), expiring 30 days after
        ``due_at``.

    Raises:
        CaseCaptureError: If any event fails validation; nothing is stored.
    """
    case_id = feed_case_id(simulation_run_id, sequence)
    version = "1.0" if model_routing is None else "2.0"
    prefix = f"evt_feed_{_run_hex(simulation_run_id)}_{sequence:03d}"

    # Built explicitly: the runtime's identity helper would truncate these IDs.
    def identity(number: int, event: str) -> dict[str, Any]:
        return {
            "schema_version": version,
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
            **(
                {}
                if model_routing is None
                else {
                    "model_routing": {
                        **dataclasses.asdict(model_routing),
                        "rule_recommendation": "PASS",
                    }
                }
            ),
        },
    ]
    record = build_case(
        [CapturedEvent(payload=payload, recorded_at=due_at) for payload in payloads],
        validator,
    )
    return dataclasses.replace(
        record,
        origin="feed",
        model_score=model_score,
        model_version=model_version,
        routed_by="rule" if model_routing is None else "model",
        event_contract_version="1" if model_routing is None else "2",
    )
