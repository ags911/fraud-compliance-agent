"""Build and read deterministic, sanitised Sandbox scenario datasets."""

import json
import os
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

import psycopg
from psycopg.types.json import Jsonb

ENRICHMENT_VERSION = "s04-enrichment-v1"
SOURCE_CLASS = "sanitised_sandbox"


class SandboxDataUnavailable(RuntimeError):
    """Signal that the optional Sandbox data store is not configured or reachable."""


class ScenarioDatasetNotFound(RuntimeError):
    """Signal that a requested scenario has no imported dataset."""


@dataclass(frozen=True)
class SanitisedEvent:
    """Represent one permitted, date precision Sandbox event.

    The value contains no raw provider payload, description, provider ID, or
    access token. Amounts use integer minor currency units.
    """

    event_date: date
    available_date: date
    amount_minor: int
    currency: str
    direction: Literal["inbound", "outbound"]
    category_bucket: str
    payee_reference: str
    payment_channel: str | None


@dataclass(frozen=True)
class EnrichedTransaction:
    """Pair a sanitised transaction with deterministic point in time features."""

    transaction_id: str
    event: SanitisedEvent
    feature_snapshot: dict[str, int | float | str | None]


@dataclass(frozen=True)
class DailyAggregate:
    """Represent dashboard safe activity totals for one scenario day."""

    aggregate_date: date
    transaction_count: int
    outbound_amount_minor: int
    category_counts: dict[str, int]

    def to_wire(self) -> dict[str, object]:
        """Serialise the aggregate without exposing transaction level details."""
        return {
            "date": self.aggregate_date.isoformat(),
            "transaction_count": self.transaction_count,
            "outbound_amount_minor": self.outbound_amount_minor,
            "category_counts": self.category_counts,
        }


@dataclass(frozen=True)
class ScenarioDataset:
    """Represent one isolated, versioned deterministic scenario dataset."""

    scenario_id: str
    fixture_version: str
    creation_revision: str
    start_date: date
    end_date: date
    transactions: tuple[EnrichedTransaction, ...]
    daily_aggregates: tuple[DailyAggregate, ...]

    def to_analytics_response(self) -> dict[str, object]:
        """Return the contract shaped, dashboard safe aggregate response."""
        return {
            "contract_version": "1.0",
            "scenario_id": self.scenario_id,
            "fixture_version": self.fixture_version,
            "source_class": SOURCE_CLASS,
            "enrichment_version": ENRICHMENT_VERSION,
            "time_boundary": {
                "start_date": self.start_date.isoformat(),
                "end_date": self.end_date.isoformat(),
                "event_time_precision": "date",
            },
            "daily_aggregates": [aggregate.to_wire() for aggregate in self.daily_aggregates],
        }


def build_dataset(
    *,
    scenario_id: str,
    fixture_version: str,
    creation_revision: str,
    start_date: date,
    end_date: date,
    events: list[SanitisedEvent],
) -> ScenarioDataset:
    """Derive deterministic point in time features and daily aggregates.

    Args:
        scenario_id: Isolated target scenario identifier.
        fixture_version: Immutable dataset version within that scenario.
        creation_revision: Traceable sanitised input revision.
        start_date: Inclusive date boundary for the dataset.
        end_date: Inclusive date boundary for the dataset.
        events: Sanitised date precision events to enrich.

    Returns:
        A dataset containing only permitted enriched features and aggregates.

    Raises:
        ValueError: If dates, amounts, or scenario boundaries are invalid.

    Side effects:
        None. This function makes no provider or database calls.
    """
    if not scenario_id.startswith("S0") or start_date > end_date:
        raise ValueError("invalid scenario dataset boundary")

    sorted_events = sorted(events, key=lambda event: (event.event_date, event.available_date, event.payee_reference))
    prior_events: list[SanitisedEvent] = []
    transactions: list[EnrichedTransaction] = []
    daily: dict[date, list[SanitisedEvent]] = {}
    for index, event in enumerate(sorted_events, start=1):
        if event.amount_minor < 0 or event.event_date < start_date or event.event_date > end_date:
            raise ValueError("event is outside the permitted dataset boundary")
        prior_amounts = [item.amount_minor for item in prior_events]
        prior_mean = sum(prior_amounts) / len(prior_amounts) if prior_amounts else None
        # Date-only source values never permit a fabricated hour or sub-day velocity.
        features: dict[str, int | float | str | None] = {
            "category_bucket": event.category_bucket,
            "payee_reference": event.payee_reference,
            "event_day_of_week_utc": event.event_date.weekday(),
            "is_weekend": int(event.event_date.weekday() >= 5),
            "event_hour_utc": None,
            "event_hour_utc_availability": "unavailable",
            "prior_transaction_count": len(prior_events),
            "prior_mean_amount_minor": prior_mean,
            "amount_to_prior_mean": event.amount_minor / prior_mean if prior_mean else None,
            "count_1d": sum(item.event_date >= event.event_date.fromordinal(event.event_date.toordinal() - 1) for item in prior_events),
            "count_7d": sum(item.event_date >= event.event_date.fromordinal(event.event_date.toordinal() - 7) for item in prior_events),
            "amount_sum_1d": sum(item.amount_minor for item in prior_events if item.event_date >= event.event_date.fromordinal(event.event_date.toordinal() - 1)),
            "amount_sum_7d": sum(item.amount_minor for item in prior_events if item.event_date >= event.event_date.fromordinal(event.event_date.toordinal() - 7)),
            "payee_prior_count": sum(item.payee_reference == event.payee_reference for item in prior_events),
            "category_prior_count": sum(item.category_bucket == event.category_bucket for item in prior_events),
        }
        transactions.append(EnrichedTransaction(f"{scenario_id}-txn-{index:04d}", event, features))
        prior_events.append(event)
        daily.setdefault(event.event_date, []).append(event)

    aggregates = tuple(
        DailyAggregate(
            aggregate_date=aggregate_date,
            transaction_count=len(day_events),
            outbound_amount_minor=sum(event.amount_minor for event in day_events if event.direction == "outbound"),
            category_counts=dict(sorted(Counter(event.category_bucket for event in day_events).items())),
        )
        for aggregate_date, day_events in sorted(daily.items())
    )
    return ScenarioDataset(scenario_id, fixture_version, creation_revision, start_date, end_date, tuple(transactions), aggregates)


def load_fixture(path: Path) -> ScenarioDataset:
    """Load a committed sanitised fixture and derive its deterministic dataset."""
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
        boundary = document["time_boundary"]
        events = [
            SanitisedEvent(
                event_date=date.fromisoformat(item["event_date"]),
                available_date=date.fromisoformat(item["available_date"]),
                amount_minor=int(item["amount_minor"]),
                currency=str(item["currency"]),
                direction=item["direction"],
                category_bucket=str(item["category_bucket"]),
                payee_reference=str(item["payee_reference"]),
                payment_channel=item.get("payment_channel"),
            )
            for item in document["events"]
        ]
        return build_dataset(
            scenario_id=str(document["scenario_id"]),
            fixture_version=str(document["fixture_version"]),
            creation_revision=str(document["creation_revision"]),
            start_date=date.fromisoformat(boundary["start_date"]),
            end_date=date.fromisoformat(boundary["end_date"]),
            events=events,
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ValueError("invalid sanitised Sandbox fixture") from error


class PsycopgScenarioRepository:
    """Persist and read isolated scenario data through parameterised PostgreSQL queries."""

    def __init__(self, database_url: str) -> None:
        """Store the Neon PostgreSQL connection URL without opening a connection."""
        if not database_url.startswith(("postgresql://", "postgres://")):
            raise SandboxDataUnavailable("DATABASE_URL must be a PostgreSQL URL")
        self._database_url = database_url

    def replace_dataset(self, dataset: ScenarioDataset) -> None:
        """Replace one fixture version atomically with its derived records.

        Side effects:
            Opens one PostgreSQL transaction and writes only the supplied
            scenario and fixture version.
        """
        try:
            with psycopg.connect(self._database_url) as connection, connection.cursor() as cursor:
                # Deleting this exact version makes a rerun deterministic without crossing scenarios.
                cursor.execute("DELETE FROM sandbox_datasets WHERE scenario_id = %s AND fixture_version = %s", (dataset.scenario_id, dataset.fixture_version))
                cursor.execute(
                    """INSERT INTO sandbox_datasets (scenario_id, fixture_version, source_class, creation_revision, enrichment_version, start_date, end_date, event_time_precision)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'date')""",
                    (dataset.scenario_id, dataset.fixture_version, SOURCE_CLASS, dataset.creation_revision, ENRICHMENT_VERSION, dataset.start_date, dataset.end_date),
                )
                for transaction in dataset.transactions:
                    event = transaction.event
                    cursor.execute(
                        """INSERT INTO sandbox_transactions (scenario_id, fixture_version, transaction_id, event_date, available_date, amount_minor, currency, direction, category_bucket, payee_reference, payment_channel, feature_snapshot)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                        (dataset.scenario_id, dataset.fixture_version, transaction.transaction_id, event.event_date, event.available_date, event.amount_minor, event.currency, event.direction, event.category_bucket, event.payee_reference, event.payment_channel, Jsonb(transaction.feature_snapshot)),
                    )
                for aggregate in dataset.daily_aggregates:
                    cursor.execute(
                        """INSERT INTO sandbox_daily_aggregates (scenario_id, fixture_version, aggregate_date, transaction_count, outbound_amount_minor, category_counts)
                        VALUES (%s, %s, %s, %s, %s, %s)""",
                        (dataset.scenario_id, dataset.fixture_version, aggregate.aggregate_date, aggregate.transaction_count, aggregate.outbound_amount_minor, Jsonb(aggregate.category_counts)),
                    )
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    def read_analytics(self, scenario_id: str) -> dict[str, object]:
        """Read the newest imported aggregate response for one scenario.

        Returns:
            Dashboard safe metadata and daily aggregates only.

        Raises:
            ScenarioDatasetNotFound: If no imported version exists for the scenario.
            SandboxDataUnavailable: If PostgreSQL cannot be queried.
        """
        try:
            with psycopg.connect(self._database_url, row_factory=psycopg.rows.dict_row) as connection, connection.cursor() as cursor:
                cursor.execute(
                    """SELECT scenario_id, fixture_version, source_class, enrichment_version, start_date, end_date, event_time_precision
                    FROM sandbox_datasets WHERE scenario_id = %s ORDER BY imported_at DESC LIMIT 1""",
                    (scenario_id,),
                )
                dataset = cursor.fetchone()
                if dataset is None:
                    raise ScenarioDatasetNotFound(scenario_id)
                cursor.execute(
                    """SELECT aggregate_date, transaction_count, outbound_amount_minor, category_counts
                    FROM sandbox_daily_aggregates WHERE scenario_id = %s AND fixture_version = %s ORDER BY aggregate_date""",
                    (scenario_id, dataset["fixture_version"]),
                )
                aggregates = cursor.fetchall()
        except ScenarioDatasetNotFound:
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error
        return {
            "contract_version": "1.0",
            "scenario_id": dataset["scenario_id"],
            "fixture_version": dataset["fixture_version"],
            "source_class": dataset["source_class"],
            "enrichment_version": dataset["enrichment_version"],
            "time_boundary": {"start_date": dataset["start_date"].isoformat(), "end_date": dataset["end_date"].isoformat(), "event_time_precision": dataset["event_time_precision"]},
            "daily_aggregates": [{"date": item["aggregate_date"].isoformat(), "transaction_count": item["transaction_count"], "outbound_amount_minor": item["outbound_amount_minor"], "category_counts": item["category_counts"]} for item in aggregates],
        }


def load_sandbox_analytics(scenario_id: str) -> dict[str, object]:
    """Load one scenario's prepared chart data from configured Neon PostgreSQL."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).read_analytics(scenario_id)
