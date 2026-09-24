"""Decide live feed payments by their scenario's accepted route (spec 0004).

This table is the only source of a feed payment's route and recommendation.
A model score, when one exists, is display only evidence and never reads or
changes anything here.
"""

from dataclasses import dataclass

from server.showcase_investigation.runtime import _SKIPPED_SCENARIOS


@dataclass(frozen=True)
class FeedDecision:
    """One scenario's deterministic decision for every outbound feed payment.

    Attributes:
        deterministic_route: The accepted route, as ``route_resolved`` emits it.
        skip_reason: Why no investigation ran, as ``investigation_skipped`` emits it.
        recommendation: The final PASS, CHALLENGE or HOLD.
        recommendation_basis: How that recommendation was reached.
    """

    deterministic_route: str
    skip_reason: str
    recommendation: str
    recommendation_basis: str

    @property
    def saves_case(self) -> bool:
        """Return whether a revealed payment with this decision becomes a case."""
        return self.recommendation != "PASS"


# S01 to S03 reuse the runtime's own deterministic bypasses. S04 and S05 carry
# the recommendation and basis of the runtime's recorded run for the scenario,
# with the investigation skipped: no agent runs for a feed payment.
_RULES: dict[str, FeedDecision] = {
    **{
        scenario_id: FeedDecision(route, reason, route, "deterministic")
        for scenario_id, (route, reason) in _SKIPPED_SCENARIOS.items()
    },
    "S04": FeedDecision(
        "INVESTIGATE",
        "existing_recorded_recommendation",
        "CHALLENGE",
        "evidence_grounded",
    ),
    "S05": FeedDecision(
        "INVESTIGATE", "existing_recorded_recommendation", "HOLD", "fail_safe"
    ),
}


def feed_decision(scenario_id: str) -> FeedDecision | None:
    """Return the scenario's feed decision, or None for S06 to S08.

    Args:
        scenario_id: A showcase scenario identifier.

    Returns:
        The decision every outbound feed payment in that scenario receives, or
        None for a workflow scenario, which has no rule and no feed schedule.
    """
    return _RULES.get(scenario_id)
