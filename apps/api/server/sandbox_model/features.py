"""Build the eight approved display-only features without offline dependencies."""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

FEATURE_NAMES = (
    "log_amount",
    "event_day_of_week_utc",
    "is_weekend",
    "card_prior_count",
    "card_prior_mean_amount",
    "amount_to_card_prior_mean",
    "card_merchant_prior_count",
    "card_category_prior_count",
)


@dataclass(frozen=True)
class PortablePayment:
    """Represent one sanitised outbound payment used for display-only features.

    Args:
        event_date: UTC calendar date; the Sandbox source has date precision.
        transaction_id: Stable local transaction identifier for deterministic order.
        amount_minor: Non-negative payment amount in minor currency units.
        payee_reference: Sanitised payee grouping key.
        category_bucket: Sanitised category grouping key.
    """

    event_date: date
    transaction_id: str
    amount_minor: int
    payee_reference: str
    category_bucket: str


def build_feature_vector(
    payment: PortablePayment, history: Iterable[PortablePayment]
) -> tuple[float | None, ...]:
    """Build ADR-024's ordered vector from strictly earlier outbound payments.

    Args:
        payment: Scheduled payment to describe; it is never included in history.
        history: Earlier imported or scheduled outbound payments for one scenario.

    Returns:
        The eight ordered values. Amount-history fields are ``None`` when there
        is no prior history so the booster takes its documented missing branch.

    Raises:
        ValueError: If a payment amount is negative.

    Side effects:
        None. This performs no persistence and does not make a decision.
    """
    ordered = tuple(history)
    if payment.amount_minor < 0 or any(item.amount_minor < 0 for item in ordered):
        raise ValueError("portable model amounts must be non-negative")
    amounts = [item.amount_minor / 100 for item in ordered]
    mean = sum(amounts) / len(amounts) if amounts else None
    day_of_week = payment.event_date.weekday()
    return (
        math.log1p(payment.amount_minor / 100),
        float(day_of_week),
        float(day_of_week >= 5),
        float(len(ordered)),
        mean,
        (payment.amount_minor / 100) / mean if mean and mean > 0 else None,
        float(sum(item.payee_reference == payment.payee_reference for item in ordered)),
        float(sum(item.category_bucket == payment.category_bucket for item in ordered)),
    )


def model_input_sha256(values: tuple[float | None, ...]) -> str:
    """Return the audit digest of one canonical approved feature vector.

    Args:
        values: Exactly the ordered feature vector returned by
            :func:`build_feature_vector`.

    Returns:
        A SHA-256 digest of compact JSON where missing values remain ``null``.

    Raises:
        ValueError: If the vector does not have the approved feature count.

    Side effects:
        None.
    """
    if len(values) != len(FEATURE_NAMES):
        raise ValueError("portable model vector has an unexpected feature count")
    payload = json.dumps(values, allow_nan=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
