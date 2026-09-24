"""Strict response models for the internal case routes (proposed contract).

They mirror ``docs/proposals/schemas/showcase-cases.v0.proposed.schema.json``.
Stored event payloads stay plain dictionaries: they are the accepted
public-showcase-events.v1 payloads, validated against that schema on write.
"""

from typing import Any, Literal

from pydantic import Field

from server.showcase_investigation.models import StrictShowcaseModel

Recommendation = Literal["PASS", "CHALLENGE", "HOLD"]
Mode = Literal["recorded", "live"]


class CaseSummary(StrictShowcaseModel):
    """One stored case's summary columns; never includes the browser ID."""

    case_id: str = Field(pattern=r"^run_[a-z0-9_]{3,64}$")
    scenario_id: str = Field(pattern=r"^S0[1-8]$")
    requested_mode: Mode
    execution_mode: Mode
    fallback_reason: (
        Literal["live_disabled", "admission_limited", "provider_unavailable"] | None
    )
    provider: Literal["groq"] | None
    model_id: str | None
    deterministic_route: Literal["PASS", "HOLD", "INVESTIGATE"]
    investigation_status: Literal["skipped", "complete", "incomplete"]
    recommendation: Recommendation
    recommendation_basis: Literal["deterministic", "evidence_grounded", "fail_safe"]
    failure_reason: (
        Literal[
            "provider_unavailable",
            "tool_failed",
            "invalid_output",
            "timeout",
            "tool_budget_exhausted",
        ]
        | None
    )
    authority_status: Literal["not_evaluated"]
    tool_call_count: int = Field(ge=0)
    evidence_count: int = Field(ge=0)
    event_count: int = Field(ge=1)
    fixture_version: str | None
    started_at: str
    completed_at: str
    expires_at: str
    contract_version: Literal["1.0"]


class StoredCaseEvent(StrictShowcaseModel):
    """One audit trail entry: a stored event and when the server received it."""

    sequence: int = Field(ge=0)
    event_id: str = Field(min_length=1)
    event_type: str = Field(min_length=1)
    recorded_at: str
    payload: dict[str, Any]


class CaseDetailResponse(StrictShowcaseModel):
    """One case with its full, ordered audit trail."""

    contract_version: Literal["1.0"]
    case: CaseSummary
    events: list[StoredCaseEvent] = Field(min_length=1)
