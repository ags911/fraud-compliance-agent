"""Append one sanitised deterministic simulated event to one Neon scenario timeline."""

import argparse
import json
import os
from datetime import date
from pathlib import Path

from server.sandbox_data.service import PsycopgScenarioRepository, SanitisedEvent


def load_simulated_event(path: Path) -> tuple[str, SanitisedEvent]:
    """Validate a small reviewed append document without accepting raw provider fields."""
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
        scenario_id = document["scenario_id"]
        event = SanitisedEvent(
            event_date=date.fromisoformat(document["event_date"]),
            available_date=date.fromisoformat(document["available_date"]),
            amount_minor=int(document["amount_minor"]),
            currency=str(document["currency"]),
            direction=document["direction"],
            category_bucket=str(document["category_bucket"]),
            payee_reference=str(document["payee_reference"]),
            payment_channel=document.get("payment_channel"),
            event_id=str(document["event_id"]),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ValueError("invalid simulated event document") from error
    return str(scenario_id), event


def main() -> None:
    """Append a reviewed event idempotently when Neon is configured."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("event", type=Path, help="sanitised simulated event JSON path")
    arguments = parser.parse_args()
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL must be configured outside source control")
    scenario_id, event = load_simulated_event(arguments.event)
    appended = PsycopgScenarioRepository(database_url).append_simulated_event(
        scenario_id, event
    )
    print("appended" if appended else "already_appended")


if __name__ == "__main__":
    main()
