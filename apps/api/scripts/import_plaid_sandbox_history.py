"""Import one full Plaid Sandbox history into a sanitised S01 through S08 baseline.

This is an explicit operator command. It is the only code path in this slice
that contacts Plaid. Provider responses remain in process memory and the
database receives only date precision, HMAC pseudonymised event values.
"""

import hashlib
import hmac
import json
import os
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from server.sandbox_data.service import (
    PsycopgScenarioRepository,
    SanitisedEvent,
    build_scenario_datasets,
)

_PLAID_SANDBOX_URL = "https://sandbox.plaid.com"
_REQUIRED_ENV = (
    "DATABASE_URL",
    "PLAID_CLIENT_ID",
    "PLAID_SECRET",
    "PLAID_SANDBOX_ACCESS_TOKEN",
    "SANDBOX_PSEUDONYMISATION_KEY",
)


class PlaidSandboxImportError(RuntimeError):
    """Represent a redacted failure while importing Plaid Sandbox data."""


def _plaid_post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Call a fixed Plaid Sandbox endpoint without logging its response."""
    body = json.dumps(
        {
            "client_id": os.environ["PLAID_CLIENT_ID"],
            "secret": os.environ["PLAID_SECRET"],
            **payload,
        }
    ).encode("utf-8")
    request = Request(
        f"{_PLAID_SANDBOX_URL}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            decoded = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        try:
            body = json.loads(error.read().decode("utf-8"))
            detail = f"{body.get('error_type', 'unknown')}/{body.get('error_code', 'unknown')}"
        except (UnicodeDecodeError, json.JSONDecodeError):
            detail = "unknown/unknown"
        raise PlaidSandboxImportError(
            f"Plaid Sandbox request failed: {detail}"
        ) from None
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise PlaidSandboxImportError(
            "Plaid Sandbox network or response failure"
        ) from error
    if not isinstance(decoded, dict):
        raise PlaidSandboxImportError("Plaid Sandbox returned an invalid response")
    return decoded


def read_full_history(access_token: str) -> list[dict[str, Any]]:
    """Retrieve every page from an initial `/transactions/sync` import.

    The caller must use a fresh explicit import cursor. This function does not
    persist a cursor and must not be called from the served API.
    """
    cursor: str | None = None
    transactions: dict[str, dict[str, Any]] = {}
    while True:
        payload: dict[str, Any] = {"access_token": access_token, "count": 500}
        if cursor:
            payload["cursor"] = cursor
        page = _plaid_post("/transactions/sync", payload)
        for transaction in [*page.get("added", []), *page.get("modified", [])]:
            if not isinstance(transaction, dict):
                raise PlaidSandboxImportError(
                    "Plaid Sandbox returned an invalid transaction"
                )
            source_id = transaction.get("transaction_id")
            if not isinstance(source_id, str) or not source_id:
                raise PlaidSandboxImportError(
                    "Plaid Sandbox transaction lacks an identifier"
                )
            transactions[source_id] = transaction
        cursor = page.get("next_cursor")
        if not page.get("has_more", False):
            return list(transactions.values())
        if not isinstance(cursor, str) or not cursor:
            raise PlaidSandboxImportError("Plaid Sandbox pagination cursor is invalid")


def _pseudonymise(value: str, key: str, prefix: str) -> str:
    """Create a stable opaque identifier from an in-memory provider value."""
    digest = hmac.new(
        key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return f"{prefix}_{digest[:24]}"


def _category_bucket(transaction: dict[str, Any]) -> str:
    """Reduce Plaid category data to a stable safe display bucket."""
    category = transaction.get("personal_finance_category")
    if isinstance(category, dict) and isinstance(category.get("primary"), str):
        raw = category["primary"]
    else:
        raw = "other"
    normalised = "".join(
        character.lower() if character.isalnum() else "_" for character in raw
    ).strip("_")
    return normalised[:64] or "other"


def sanitise_history(
    transactions: list[dict[str, Any]], pseudonymisation_key: str
) -> list[SanitisedEvent]:
    """Reduce in-memory Plaid transactions to the permitted deterministic fields."""
    events: list[SanitisedEvent] = []
    for transaction in transactions:
        raw_date = transaction.get("date")
        raw_available_date = transaction.get("authorized_date") or raw_date
        raw_amount = transaction.get("amount")
        raw_currency = transaction.get("iso_currency_code")
        if (
            not isinstance(raw_date, str)
            or not isinstance(raw_available_date, str)
            or not isinstance(raw_currency, str)
        ):
            continue
        if (
            not isinstance(raw_amount, (int, float))
            or len(raw_currency) != 3
            or not raw_currency.isalpha()
        ):
            continue
        event_date = date.fromisoformat(raw_date)
        available_date = max(event_date, date.fromisoformat(raw_available_date))
        amount_minor = int(
            (Decimal(str(abs(raw_amount))) * 100).quantize(
                Decimal(1), rounding=ROUND_HALF_UP
            )
        )
        raw_payee = (
            transaction.get("merchant_name")
            or transaction.get("name")
            or transaction.get("transaction_id")
        )
        raw_identifier = transaction.get("transaction_id")
        if (
            not isinstance(raw_payee, str)
            or not raw_payee
            or not isinstance(raw_identifier, str)
            or not raw_identifier
        ):
            continue
        channel = transaction.get("payment_channel")
        events.append(
            SanitisedEvent(
                event_date=event_date,
                available_date=available_date,
                amount_minor=amount_minor,
                currency=raw_currency.upper(),
                direction="outbound" if raw_amount >= 0 else "inbound",
                category_bucket=_category_bucket(transaction),
                payee_reference=_pseudonymise(raw_payee, pseudonymisation_key, "payee"),
                payment_channel=channel if isinstance(channel, str) else None,
                event_id=_pseudonymise(raw_identifier, pseudonymisation_key, "evt"),
            )
        )
    if not events:
        raise PlaidSandboxImportError(
            "Plaid Sandbox history contained no usable dated transactions"
        )
    return events


def _creation_revision(events: list[SanitisedEvent]) -> str:
    """Create a reproducible revision from sanitised values only."""
    rows = [
        (
            event.event_id,
            event.event_date.isoformat(),
            event.available_date.isoformat(),
            event.amount_minor,
            event.currency,
            event.direction,
            event.category_bucket,
            event.payee_reference,
            event.payment_channel,
        )
        for event in sorted(events, key=lambda item: item.event_id or "")
    ]
    return hashlib.sha256(
        json.dumps(rows, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:16]


def import_plaid_sandbox_history(
    database_url: str,
    access_token: str,
    pseudonymisation_key: str,
    scenario_packet_path: Path,
) -> tuple[str, int]:
    """Import one full baseline and derive isolated S01 through S08 datasets."""
    packet = json.loads(scenario_packet_path.read_text(encoding="utf-8"))
    events = sanitise_history(read_full_history(access_token), pseudonymisation_key)
    start_date = min(event.event_date for event in events)
    end_date = max(event.event_date for event in events)
    revision = _creation_revision(events)
    baseline_version = f"plaid-sandbox-{revision}"
    datasets = build_scenario_datasets(
        baseline_version=baseline_version,
        creation_revision=revision,
        start_date=start_date,
        end_date=end_date,
        baseline_events=events,
        scenario_packet=packet,
    )
    PsycopgScenarioRepository(database_url).replace_baseline_and_scenarios(
        baseline_version=baseline_version,
        creation_revision=revision,
        start_date=start_date,
        end_date=end_date,
        events=events,
        datasets=datasets,
    )
    return baseline_version, len(events)


def main() -> None:
    """Run the explicitly invoked full-history Sandbox import."""
    missing = [name for name in _REQUIRED_ENV if not os.getenv(name)]
    if missing:
        raise SystemExit("Missing required configuration: " + ", ".join(missing))
    if os.getenv("PLAID_ENV", "").strip().lower() != "sandbox":
        raise SystemExit("This importer is restricted to PLAID_ENV=sandbox")
    packet_path = (
        Path(__file__).resolve().parents[3]
        / "fixtures"
        / "s01-s08"
        / "scenarios.v1.json"
    )
    baseline_version, count = import_plaid_sandbox_history(
        os.environ["DATABASE_URL"],
        os.environ["PLAID_SANDBOX_ACCESS_TOKEN"],
        os.environ["SANDBOX_PSEUDONYMISATION_KEY"],
        packet_path,
    )
    print(f"{baseline_version}: {count} sanitised events across S01-S08")


if __name__ == "__main__":
    main()
