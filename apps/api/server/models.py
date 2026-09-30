"""
Request models for the agent-console demo API.

Field names mirror the raw transaction dict shape fraud_compliance_agent_v2's
data_ingest_node/compute_features already expects (see
vendor/arbiris-sdk/examples/agents/fraud_compliance_agent_v2/nodes/data_ingest.py)
— this is a thin translation layer, not a new schema.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictFiniteModel(BaseModel):
    """Reject non-finite numbers and ignore-free coercion surprises.

    The current showcase still mirrors a legacy transaction shape, so this
    base class enforces representation safety without inventing unresolved
    money-direction or provider semantics.
    """

    model_config = ConfigDict(allow_inf_nan=False, str_strip_whitespace=True)


class DemoError(BaseModel):
    """Stable unavailable-error envelope exposed by the showcase API."""

    detail: Literal["demo_pipeline_unavailable", "demo_model_summary_unavailable"]


class ScenarioNotFoundError(BaseModel):
    """Error envelope returned when a preset scenario identifier is unknown."""

    detail: str


class HealthResponse(BaseModel):
    """Minimal unauthenticated liveness response."""

    status: Literal["ok"]


class ScenarioSummary(BaseModel):
    """Public identifier and display label for one synthetic legacy scenario."""

    id: str
    label: str


class DemoModelMetrics(BaseModel):
    """Aggregate mechanics-only metrics for one benchmark model."""

    model_id: str
    label: str
    pr_auc: float
    roc_auc: float
    brier_score: float
    threshold_sweep: list["DemoThresholdPoint"]
    slice_metrics: list["DemoSliceMetric"]


class DemoThresholdPoint(BaseModel):
    """One recorded, evaluation-only operating-point observation."""

    threshold: float
    precision: float
    recall: float
    false_positive_rate: float
    block_rate: float


class DemoSliceMetric(BaseModel):
    """A non-sensitive cohort metric retained in the sanitised report."""

    slice: str
    value: str
    count: int
    prevalence: float
    pr_auc: float
    roc_auc: float


class DemoModelSummary(BaseModel):
    """Safe portfolio summary of the local Sparkov benchmark evaluation."""

    artifact: str
    status: str
    data_source: str
    training_scope: str
    dataset_sha256: str
    feature_columns: list[str]
    partition_counts: dict[str, int]
    test_prevalence: float
    model_results: list[DemoModelMetrics]
    release_boundary: list[str]
    report_sha256: str


class SandboxTimeBoundary(StrictFiniteModel):
    """Describe the declared date boundary for one sanitised scenario dataset."""

    start_date: str
    end_date: str
    event_time_precision: Literal["date", "minute", "second"]


class SandboxDailyAggregate(StrictFiniteModel):
    """Expose one dashboard safe, scenario scoped daily aggregate."""

    date: str
    transaction_count: int = Field(ge=0)
    outbound_amount_minor: int = Field(ge=0)
    category_counts: dict[str, int]


class SandboxScenarioAnalytics(StrictFiniteModel):
    """Expose read only, sanitised scenario data for a dashboard chart."""

    contract_version: Literal["1.0"]
    scenario_id: str = Field(pattern=r"^S0[1-8]$")
    fixture_version: str = Field(min_length=1, max_length=128)
    source_class: Literal["sanitised_sandbox"]
    enrichment_version: Literal["s04-enrichment-v1", "sandbox-enrichment-v2"]
    baseline_version: str = Field(min_length=1, max_length=128)
    overlay_version: str = Field(min_length=1, max_length=128)
    time_boundary: SandboxTimeBoundary
    daily_aggregates: list[SandboxDailyAggregate]


class SandboxDecisionCounts(StrictFiniteModel):
    """How many outbound payments ended in each recommendation."""

    PASS: int = Field(ge=0)
    CHALLENGE: int = Field(ge=0)
    HOLD: int = Field(ge=0)


class SandboxDecisionDay(SandboxDecisionCounts):
    """One calendar day of decided outbound payments."""

    date: str


class SandboxScenarioDecisions(StrictFiniteModel):
    """Decided outbound payments per day for one scenario (spec 0004, internal).

    Each payment is decided by the scenario's deterministic rule alone; no model
    score contributes. Contract version "0": not an accepted contract.
    """

    contract_version: Literal["0"]
    scenario_id: str = Field(pattern=r"^S0[1-5]$")
    fixture_version: str = Field(min_length=1, max_length=128)
    days: list[SandboxDecisionDay]
    totals: SandboxDecisionCounts


class SandboxRoutedPayment(StrictFiniteModel):
    """One revealed payment on the routing board: opaque ID and outcome only.

    Sandbox simulation v1.1 (spec 0010) adds who routed it and its score.
    """

    event_id: str = Field(min_length=1, max_length=128)
    sequence: int = Field(gt=0)
    recommendation: Literal["PASS", "CHALLENGE", "HOLD"]
    routed_by: Literal["rule", "model"] | None = None
    model_score: float | None = Field(default=None, ge=0, le=1)


class SandboxRoutingLane(StrictFiniteModel):
    """Every payment routed to one outcome, listing only the newest 18."""

    count: int = Field(ge=0)
    recent: list[SandboxRoutedPayment] = Field(max_length=18)


class SandboxRoutingPolicy(StrictFiniteModel):
    """The loaded score routing policy's version and thresholds (spec 0010)."""

    version: str = Field(min_length=1)
    challenge: float = Field(ge=0, le=1)
    hold: float = Field(ge=0, le=1)


class SandboxRoutingSnapshot(StrictFiniteModel):
    """A run's revealed payments grouped by recommendation (spec 0006).

    ``raised_by_model`` counts every shown payment the model raised, and
    ``routing_policy`` is null whenever score routing is off (spec 0010).
    """

    by_recommendation: dict[Literal["PASS", "CHALLENGE", "HOLD"], SandboxRoutingLane]
    raised_by_model: int = Field(default=0, ge=0)
    routing_policy: SandboxRoutingPolicy | None = None


class SandboxSimulationRun(StrictFiniteModel):
    """Expose safe progress for one server-owned Sandbox simulation run.

    A Mixed feed run (``MIX``, spec 0008) draws from S01 to S05 and has no
    single fixture version; each of its payments records its own.
    """

    run_id: str = Field(min_length=1, max_length=64)
    scenario_id: str = Field(pattern=r"^(S0[1-8]|MIX)$")
    fixture_version: str | None = Field(default=None, min_length=1, max_length=128)
    seed: str = Field(min_length=1, max_length=128)
    state: Literal["pending", "running", "completed", "failed", "cancelled"]
    scheduled_event_count: int = Field(ge=0)
    appended_event_count: int = Field(ge=0)
    next_due_at: str | None = None
    # Kept after a cancel, so a stopped run's board does not reset to zero.
    routing_snapshot: SandboxRoutingSnapshot | None = None


class SandboxOverviewRequest(StrictFiniteModel):
    """Ask for one scenario's overview (spec 0011): the range and the viewer's run.

    The browser sends no figures or text; the server builds the facts. The run
    ID travels in the body so it stays out of URLs and access logs.
    """

    model_config = ConfigDict(
        allow_inf_nan=False, str_strip_whitespace=True, extra="forbid"
    )

    range: Literal["7", "30", "all"]
    simulation_run_id: str | None = Field(
        default=None,
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    )


class SandboxOverviewWindow(StrictFiniteModel):
    """The calendar days an overview covers, both ends included."""

    start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    days: int = Field(ge=1)


class SandboxOverviewIncluded(StrictFiniteModel):
    """Whether the viewer's own feed and saved cases are in the facts."""

    feed: bool
    cases: bool


class SandboxOverview(StrictFiniteModel):
    """One scenario overview (``sandbox-overview.v1``, ADR-026).

    ``source`` says who wrote it: the allowlisted model, fact checked, or the
    fixed template. It never decides or changes anything.
    """

    contract_version: Literal["1.0"]
    scenario_id: Literal["S01", "S02", "S03", "S04", "S05", "MIX"]
    range: Literal["7", "30", "all"]
    window: SandboxOverviewWindow
    source: Literal["live", "template"]
    model_id: str | None = Field(min_length=1, max_length=128)
    headline: str = Field(min_length=1, max_length=160)
    points: list[str] = Field(min_length=3, max_length=5)
    fallback_reason: (
        Literal[
            "live_disabled",
            "admission_limited",
            "provider_unavailable",
            "timeout",
            "invalid_output",
            "ungrounded",
        ]
        | None
    )
    included: SandboxOverviewIncluded


class HistoryPoint(StrictFiniteModel):
    """One bounded, amount-only historical observation for the demo pipeline."""

    amount: float


class RunRequest(StrictFiniteModel):
    """A custom transaction submitted from the console's form."""

    customer_id: str = Field(default="CUST-CONSOLE-001", min_length=1, max_length=128)
    transaction_id: str = Field(default="TXN-CONSOLE-001", min_length=1, max_length=128)
    account_id: str = Field(default="ACC-CONSOLE", min_length=1, max_length=128)
    amount: float
    iso_currency_code: str = Field(
        default="GBP", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$"
    )
    payment_channel: Literal["online", "in store", "other"] = "online"
    country: str | None = Field(default=None, max_length=64)
    personal_finance_category: str = Field(
        default="OTHER", min_length=1, max_length=128
    )
    velocity_6h: int = Field(default=0, ge=0, le=100_000)
    first_seen_payee: bool = False
    account_balance: float = 0.0
    account_balance_pct_remaining: float = Field(default=1.0, ge=0.0, le=1.0)
    inbound_credit_within_2h: bool = False
    history: list[HistoryPoint] = Field(default_factory=list, max_length=500)
    simulate_llm_outage: bool = False

    def to_raw_transaction(self) -> dict:
        """Translate validated demo input into the vendor pipeline's expected raw shape.

        Returns:
            A transient dictionary containing only the current demo request's
            transaction fields. It is passed in memory to the vendor pipeline.

        Side effects:
            None. The method does not persist input or submit a payment.
        """
        return {
            "transaction_id": self.transaction_id,
            "account_id": self.account_id,
            "amount": self.amount,
            "iso_currency_code": self.iso_currency_code,
            "payment_channel": self.payment_channel,
            "country": self.country,
            "personal_finance_category": self.personal_finance_category,
            "velocity_6h": self.velocity_6h,
            "first_seen_payee": self.first_seen_payee,
            "account_balance": self.account_balance,
            "account_balance_pct_remaining": self.account_balance_pct_remaining,
            "inbound_credit_within_2h": self.inbound_credit_within_2h,
        }

    def to_raw_history(self) -> list[dict]:
        """Translate validated historical amount points into transient pipeline input.

        Returns:
            One amount-only dictionary per supplied history point.

        Side effects:
            None. The method does not persist history or infer customer facts.
        """
        return [{"amount": point.amount} for point in self.history]


class PresetRunRequest(StrictFiniteModel):
    """Overrides applied on top of a named preset scenario (currently just the toggle)."""

    simulate_llm_outage: bool = False
