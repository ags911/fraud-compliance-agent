"""Typed state and provider outputs for the public showcase investigation."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ScenarioId = Literal["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"]
ExecutionMode = Literal["recorded", "live"]
ToolName = Literal[
    "get_payee_evidence",
    "get_account_activity_evidence",
    "get_device_session_evidence",
]
FailureReason = Literal[
    "provider_unavailable",
    "tool_failed",
    "invalid_output",
    "timeout",
    "tool_budget_exhausted",
]


class StrictShowcaseModel(BaseModel):
    """Reject extra provider or caller fields at the showcase boundary."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ShowcaseInvestigationRequest(StrictShowcaseModel):
    """Select one accepted synthetic scenario and requested execution mode."""

    scenario_id: ScenarioId
    execution_mode: ExecutionMode


class ShowcaseErrorDetail(StrictShowcaseModel):
    """Stable, redacted public error detail."""

    code: Literal["invalid_request", "showcase_investigation_unavailable"]
    message: str = Field(min_length=1, max_length=160)


class ShowcaseError(StrictShowcaseModel):
    """Public HTTP error envelope for the investigation route."""

    detail: ShowcaseErrorDetail


class EvidenceItem(StrictShowcaseModel):
    """One display-safe synthetic fact returned by an allowlisted tool."""

    evidence_id: str = Field(pattern=r"^ev_[a-z0-9_]{3,48}$")
    category: Literal[
        "payee_relationship",
        "payee_name_match",
        "account_balance_impact",
        "payment_velocity",
        "recent_credit_context",
        "device_familiarity",
        "session_change",
        "location_channel_context",
    ]
    display_value: str = Field(min_length=1, max_length=160)
    source_class: Literal["synthetic_fixture"]
    fixture_version: str = Field(min_length=1, max_length=64)


class ToolPlan(StrictShowcaseModel):
    """Bound a provider-selected plan to distinct allowlisted read-only tools."""

    tools: list[ToolName] = Field(min_length=2, max_length=3)


class RecommendationClaim(StrictShowcaseModel):
    """One user-visible claim grounded in same-run evidence identifiers."""

    claim_id: str = Field(pattern=r"^claim_[a-z0-9_]{3,48}$")
    text: str = Field(min_length=1, max_length=200)
    evidence_ids: list[str] = Field(min_length=1, max_length=6)


class ProviderAssessment(StrictShowcaseModel):
    """Validated recommendation fields returned by the optional provider."""

    recommendation: Literal["PASS", "CHALLENGE", "HOLD"]
    summary: str = Field(min_length=1, max_length=280)
    claims: list[RecommendationClaim] = Field(min_length=1, max_length=6)
    uncertainties: list[str] = Field(default_factory=list, max_length=6)


class LiveInvestigationResult(StrictShowcaseModel):
    """Return validated live evidence and assessment or one stable failure."""

    called_tools: list[ToolName] = Field(default_factory=list, max_length=3)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=12)
    assessment: ProviderAssessment | None = None
    failure_reason: FailureReason | None = None
