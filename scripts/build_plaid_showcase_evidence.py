"""Derive one sanitised S04 account-activity evidence fact from Plaid Sandbox.

Scope: ADR-018 authorises deriving the S04 `get_account_activity_evidence`
tool's evidence from Plaid Sandbox data. This script creates one scripted
Sandbox test item with a known transaction pattern, reads it back through
`/transactions/sync`, and reduces it to a single safe, aggregate, non-
identifying fact plus a sanitised, checksummed provenance record.

It never prints or writes a raw transaction, name, or account identifier.
Scripted Sandbox data is a test case the author controls, not independently
observed behaviour, and the written artifact says so.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

_PLAID_BASE_URL = "https://sandbox.plaid.com"
_REQUIRED_ENV = ("PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV")


class PlaidBuildError(RuntimeError):
    """Signal a redacted Plaid Sandbox failure without raw provider detail."""

    def __init__(self, error_type: str, error_code: str) -> None:
        self.error_type = error_type
        self.error_code = error_code
        super().__init__(f"Plaid Sandbox request failed: {error_type}/{error_code}.")


def _find_repository_root(start: Path) -> Path:
    """Locate the repository root from this script's own location.

    Args:
        start: This file's resolved directory.

    Returns:
        The monorepo root, identified by `docs/project-context.md`.

    Raises:
        RuntimeError: If run outside the repository.
    """
    for candidate in (start, *start.parents):
        if (candidate / "docs" / "project-context.md").is_file():
            return candidate
    raise RuntimeError(
        "Run this script from inside the fraud-compliance-agent repository."
    )


def _plaid_post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Call one Plaid Sandbox endpoint, keeping the raw response in memory only.

    Args:
        path: Relative Sandbox endpoint path.
        payload: Non-secret request fields; credentials are attached here.

    Returns:
        The decoded JSON response.

    Raises:
        PlaidBuildError: For a redacted provider error category.
        RuntimeError: For a network or malformed-response failure.

    Side effects:
        Sends one Sandbox HTTPS request. Never logs or persists the response.
    """
    body = json.dumps(
        {
            "client_id": os.environ["PLAID_CLIENT_ID"],
            "secret": os.environ["PLAID_SECRET"],
            **payload,
        }
    ).encode("utf-8")
    request = Request(
        f"{_PLAID_BASE_URL}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        try:
            decoded = json.loads(exc.read().decode("utf-8"))
            error_type, error_code = (
                decoded.get("error_type", "unknown"),
                decoded.get("error_code", "unknown"),
            )
        except (UnicodeDecodeError, json.JSONDecodeError):
            error_type, error_code = "unknown", "unknown"
        raise PlaidBuildError(error_type, error_code) from None
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("Plaid Sandbox network or response failure.") from exc


def _read_all_sync_pages(access_token: str) -> list[dict[str, Any]]:
    """Read one complete `/transactions/sync` update for a Sandbox item.

    Args:
        access_token: In-memory Sandbox token; never logged or persisted.

    Returns:
        Every page of the current update, in order.

    Side effects:
        Makes one or more Sandbox requests.
    """
    pages: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        request: dict[str, Any] = {"access_token": access_token}
        if cursor:
            request["cursor"] = cursor
        page = _plaid_post("/transactions/sync", request)
        pages.append(page)
        if not page.get("has_more", False):
            return pages
        cursor = page.get("next_cursor")


def _wait_for_initial_sync(
    access_token: str, timeout_seconds: float = 45.0
) -> list[dict[str, Any]]:
    """Poll Sandbox until its scripted initial transaction generation completes.

    A freshly created Sandbox item generates its configured transactions
    asynchronously; a single immediate `/transactions/sync` call can observe
    zero added transactions before generation finishes.

    Args:
        access_token: In-memory Sandbox token; never logged or persisted.
        timeout_seconds: Bounded wait before giving up.

    Returns:
        The pages of the first update that reports a completed status.

    Raises:
        RuntimeError: If no completed update is observed within the timeout.

    Side effects:
        Polls Plaid Sandbox at a fixed interval.
    """
    started = time.monotonic()
    while True:
        pages = _read_all_sync_pages(access_token)
        status = pages[-1].get("transactions_update_status", "")
        if status in {"INITIAL_UPDATE_COMPLETE", "HISTORICAL_UPDATE_COMPLETE"}:
            return pages
        if time.monotonic() - started >= timeout_seconds:
            raise RuntimeError(
                f"Sandbox initial transaction generation did not complete in time (last status: {status})."
            )
        time.sleep(2)


def derive_account_activity_fact(pages: list[dict[str, Any]]) -> dict[str, Any]:
    """Reduce raw Sandbox pages to one safe, aggregate account-activity fact.

    Args:
        pages: In-memory Sync pages for one scripted Sandbox item.

    Returns:
        Aggregate counts only: no name, account identifier, or exact amount.
        `repeat_payee_observed` follows the accepted payee-history proxy rule
        (ADR-018): a pseudonymised counterparty repeating more than once in
        the pulled window.

    Side effects:
        None.
    """
    added = [transaction for page in pages for transaction in page.get("added", [])]
    counterparty_counts: dict[str, int] = {}
    for transaction in added:
        # A pseudonymised proxy only: the raw name never leaves this function.
        key = hashlib.sha256(
            (transaction.get("merchant_name") or transaction.get("name") or "").encode(
                "utf-8"
            )
        ).hexdigest()[:16]
        counterparty_counts[key] = counterparty_counts.get(key, 0) + 1
    return {
        "transaction_count_30d": len(added),
        "repeat_payee_observed": any(
            count > 1 for count in counterparty_counts.values()
        ),
        "distinct_payee_count": len(counterparty_counts),
    }


def main() -> int:
    """Create one scripted Sandbox item, derive one fact, and write the record.

    Returns:
        Zero on success.

    Raises:
        RuntimeError: If required Plaid Sandbox configuration is absent or not
            `sandbox`.

    Side effects:
        Makes Plaid Sandbox network requests and writes one sanitised JSON
        record under `docs/proposals/`. Writes no raw transaction, name, or
        account identifier.
    """
    missing = [name for name in _REQUIRED_ENV if not os.getenv(name)]
    if missing:
        raise RuntimeError("Missing required configuration: " + ", ".join(missing))
    if os.environ["PLAID_ENV"].strip().lower() != "sandbox":
        raise RuntimeError("This script is restricted to PLAID_ENV=sandbox.")

    repository_root = _find_repository_root(Path(__file__).resolve().parent)
    report_path = (
        repository_root
        / "docs"
        / "proposals"
        / "plaid-showcase-account-activity-derivation.observation.json"
    )

    # A custom Sandbox user with a scripted transaction history: this is a
    # deliberately authored test case, not independently observed behaviour,
    # so the written record says so rather than implying discovery.
    custom_config = {
        "override_accounts": [
            {
                "type": "depository",
                "subtype": "checking",
                "transactions": [
                    {
                        "date_transacted": "2026-08-25",
                        "date_posted": "2026-08-25",
                        "amount": 42.00,
                        "description": "Coffee Shop",
                    },
                    {
                        "date_transacted": "2026-09-01",
                        "date_posted": "2026-09-01",
                        "amount": 18.50,
                        "description": "Coffee Shop",
                    },
                    {
                        "date_transacted": "2026-09-08",
                        "date_posted": "2026-09-08",
                        "amount": 65.00,
                        "description": "Grocery Store",
                    },
                    {
                        "date_transacted": "2026-09-15",
                        "date_posted": "2026-09-15",
                        "amount": 22.00,
                        "description": "Coffee Shop",
                    },
                ],
            }
        ]
    }
    public_token = _plaid_post(
        "/sandbox/public_token/create",
        {
            "institution_id": "ins_109508",
            "initial_products": ["transactions"],
            "options": {
                "override_username": "user_custom",
                "override_password": json.dumps(custom_config),
            },
        },
    )["public_token"]
    access_token = _plaid_post(
        "/item/public_token/exchange", {"public_token": public_token}
    )["access_token"]

    pages = _wait_for_initial_sync(access_token)
    fact = derive_account_activity_fact(pages)

    record = {
        "artifact": "plaid-showcase-account-activity-derivation",
        "status": "scripted_sandbox_test_case",
        "authorised_by": "ADR-018",
        "scenario_id": "S04",
        "tool_name": "get_account_activity_evidence",
        "source_system": "plaid_sandbox",
        "run_at": datetime.now(UTC).isoformat(),
        "derived_fact": fact,
        "derivation_rule": "payee-history proxy per ADR-018: a pseudonymised counterparty identifier repeating more than once in the pulled window",
        "limitations": [
            "This Sandbox item's transaction history was authored by this script, not observed independently; it is a scripted test case.",
            "No raw transaction, merchant name, or account identifier is retained past this reduction.",
            "This record informs a fixture value; it does not itself grant runtime consumption.",
        ],
    }
    record["report_sha256"] = hashlib.sha256(
        json.dumps(record, sort_keys=True).encode("utf-8")
    ).hexdigest()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(record, sort_keys=True, indent=2) + "\n", encoding="utf-8"
    )
    print(
        "Sanitised derivation record written:", report_path.relative_to(repository_root)
    )
    print("Derived fact:", fact)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
