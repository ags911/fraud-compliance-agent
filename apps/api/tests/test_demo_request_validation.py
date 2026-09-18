"""Validation tests for bounded, synthetic demo requests."""

import math

import pytest
from pydantic import ValidationError

from server.models import HistoryPoint, RunRequest


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_run_request_rejects_non_finite_numbers(value: float) -> None:
    """Non-finite values never enter scoring or signed-record generation."""
    with pytest.raises(ValidationError):
        RunRequest(amount=value)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("velocity_6h", -1),
        ("account_balance_pct_remaining", -0.01),
        ("account_balance_pct_remaining", 1.01),
        ("iso_currency_code", "gbp"),
        ("customer_id", ""),
    ],
)
def test_run_request_rejects_out_of_contract_values(field: str, value: object) -> None:
    """Obvious representation errors fail before the legacy pipeline runs."""
    with pytest.raises(ValidationError):
        RunRequest(amount=10, **{field: value})


def test_run_request_bounds_history_size() -> None:
    """Oversized history collections cannot create unbounded request work."""
    history = [HistoryPoint(amount=1) for _ in range(501)]

    with pytest.raises(ValidationError):
        RunRequest(amount=10, history=history)


def test_run_request_preserves_unresolved_money_direction() -> None:
    """Finite negative amounts remain allowed until money direction is contracted."""
    request = RunRequest(amount=-10)

    assert request.amount == -10
