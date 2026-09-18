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


class HistoryPoint(StrictFiniteModel):
    """One bounded, amount-only historical observation for the demo pipeline."""

    amount: float


class RunRequest(StrictFiniteModel):
    """A custom transaction submitted from the console's form."""

    customer_id: str = Field(default="CUST-CONSOLE-001", min_length=1, max_length=128)
    transaction_id: str = Field(default="TXN-CONSOLE-001", min_length=1, max_length=128)
    account_id: str = Field(default="ACC-CONSOLE", min_length=1, max_length=128)
    amount: float
    iso_currency_code: str = Field(default="GBP", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    payment_channel: Literal["online", "in store", "other"] = "online"
    country: str | None = Field(default=None, max_length=64)
    personal_finance_category: str = Field(default="OTHER", min_length=1, max_length=128)
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
