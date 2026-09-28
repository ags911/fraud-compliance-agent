"""Build, persist, and read deterministic, sanitised Sandbox scenario data."""

import functools
import hashlib
import json
import logging
import os
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

import psycopg
from psycopg.types.json import Jsonb

from server.public_database_guards import (
    ClientWindowLimiter,
    load_public_database_guard_settings,
    table_has_capacity,
)
from server.sandbox_data.decisions import FeedDecision, feed_decision
from server.sandbox_data.feed_cases import build_feed_case
from server.sandbox_model import load_portable_model
from server.sandbox_model.features import PortablePayment, build_feature_vector
from server.showcase_cases.capture import CaseCaptureError, EventValidator
from server.showcase_cases.repository import (
    CaseStorageCeiling,
    CasesUnavailable,
    PsycopgCaseRepository,
)
from server.showcase_cases.settings import load_case_settings

logger = logging.getLogger(__name__)

ENRICHMENT_VERSION = "sandbox-enrichment-v2"
OVERLAY_VERSION = "s01-s08-overlay-v1"
SOURCE_CLASS = "sanitised_sandbox"
SCENARIO_IDS = tuple(f"S0{number}" for number in range(1, 9))
# The Mixed feed (spec 0008): a run level identifier, not a dataset, whose
# payments come from these payment scenarios, each with its own rule.
MIXED_FEED_ID = "MIX"
MIXED_FEED_SOURCES = ("S01", "S02", "S03", "S04", "S05")


class SandboxDataUnavailable(RuntimeError):
    """Signal that the optional Sandbox data store is not configured or reachable."""


class ScenarioDatasetNotFound(RuntimeError):
    """Signal that a requested scenario has no imported dataset."""


class ScenarioSimulationNotFound(RuntimeError):
    """Signal that a requested deterministic simulation run does not exist."""


class ScenarioNotDecided(RuntimeError):
    """Signal a workflow scenario (S06 to S08), which has no feed decision rule."""


class SimulationBusy(RuntimeError):
    """Signal that the site already has the maximum number of live feed runs."""


class SimulationRateLimited(RuntimeError):
    """Signal that one browser started too many feed runs in the last minute."""


class SimulationStorageCeiling(RuntimeError):
    """Signal that an opt-in public database row ceiling refuses a feed start."""


class SimulationClientRateLimited(RuntimeError):
    """Signal that one server-derived client started too many feeds this minute."""


@dataclass(frozen=True)
class SandboxDatasetPruneCounts:
    """Report the number of eligible sanitised dataset and baseline records.

    Attributes:
        datasets: Superseded scenario datasets not retained for a simulation run.
        baselines: Baselines with no remaining dataset reference.
    """

    datasets: int
    baselines: int


# Spec 0003 limits: live runs across the site, starts per browser per rolling
# minute (10 since spec 0005 starts a feed on load and on scenario change),
# and how long a finished run is kept before the worker sweeps it.
MAX_LIVE_SIMULATION_RUNS = 20
MAX_SIMULATION_STARTS_PER_MINUTE = 10
SIMULATION_RETENTION = timedelta(days=7)
_client_start_limiter: ClientWindowLimiter | None = None
_client_start_limit: int | None = None


def admit_client_simulation_start(client_identity: str) -> None:
    """Reserve one opt-in process-local feed start for a derived client identity.

    Args:
        client_identity: Server-derived address used only as an in-memory key.

    Raises:
        SimulationClientRateLimited: If the configured client limit is reached.

    Side effects:
        Maintains an in-memory rolling minute counter only when the proposed
        public-database guards are explicitly enabled.
    """
    global _client_start_limiter, _client_start_limit
    settings = load_public_database_guard_settings()
    if not settings.enabled:
        return
    if (
        _client_start_limiter is None
        or _client_start_limit != settings.client_feed_starts_per_minute
    ):
        _client_start_limiter = ClientWindowLimiter(
            settings.client_feed_starts_per_minute
        )
        _client_start_limit = settings.client_feed_starts_per_minute
    if not _client_start_limiter.allow(client_identity):
        raise SimulationClientRateLimited()


@dataclass(frozen=True)
class SanitisedEvent:
    """Represent one permitted date precision event without provider identifiers."""

    event_date: date
    available_date: date
    amount_minor: int
    currency: str
    direction: Literal["inbound", "outbound"]
    category_bucket: str
    payee_reference: str
    payment_channel: str | None
    event_id: str | None = None


@dataclass(frozen=True)
class EnrichedTransaction:
    """Pair one sanitised transaction with deterministic point in time features."""

    transaction_id: str
    event: SanitisedEvent
    feature_snapshot: dict[str, int | float | str | None]


@dataclass(frozen=True)
class DailyAggregate:
    """Represent dashboard safe activity totals for one calendar day."""

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
    baseline_version: str | None = None
    overlay_version: str | None = None

    def to_analytics_response(self) -> dict[str, object]:
        """Return the contract shaped, dashboard safe aggregate response."""
        return {
            "contract_version": "1.0",
            "scenario_id": self.scenario_id,
            "fixture_version": self.fixture_version,
            "source_class": SOURCE_CLASS,
            "enrichment_version": ENRICHMENT_VERSION,
            "baseline_version": self.baseline_version or "fixture-only",
            "overlay_version": self.overlay_version or "fixture-only",
            "time_boundary": {
                "start_date": self.start_date.isoformat(),
                "end_date": self.end_date.isoformat(),
                "event_time_precision": "date",
            },
            "daily_aggregates": [
                aggregate.to_wire() for aggregate in self.daily_aggregates
            ],
        }


def _calendar_days(start_date: date, end_date: date) -> tuple[date, ...]:
    """Return every UTC calendar day in an inclusive validated date range."""
    if start_date > end_date:
        raise ValueError("invalid scenario dataset boundary")
    return tuple(
        start_date + timedelta(days=offset)
        for offset in range((end_date - start_date).days + 1)
    )


def _event_identifier(scenario_id: str, event: SanitisedEvent, index: int) -> str:
    """Return a deterministic opaque event identifier without source identifiers."""
    if event.event_id:
        return event.event_id
    payload = "|".join(
        (
            scenario_id,
            event.event_date.isoformat(),
            event.available_date.isoformat(),
            str(event.amount_minor),
            event.currency,
            event.direction,
            event.category_bucket,
            event.payee_reference,
            str(index),
        )
    )
    return f"evt_{hashlib.sha256(payload.encode('utf-8')).hexdigest()[:24]}"


def build_dataset(
    *,
    scenario_id: str,
    fixture_version: str,
    creation_revision: str,
    start_date: date,
    end_date: date,
    events: list[SanitisedEvent],
    baseline_version: str | None = None,
    overlay_version: str | None = None,
) -> ScenarioDataset:
    """Derive safe point in time features and one aggregate for every calendar day."""
    if scenario_id not in SCENARIO_IDS or not fixture_version or not creation_revision:
        raise ValueError("invalid scenario dataset boundary")
    calendar_days = _calendar_days(start_date, end_date)
    sorted_events = sorted(
        events,
        key=lambda event: (
            event.event_date,
            event.available_date,
            event.payee_reference,
            event.event_id or "",
        ),
    )
    prior_events: list[SanitisedEvent] = []
    transactions: list[EnrichedTransaction] = []
    daily: dict[date, list[SanitisedEvent]] = {
        calendar_day: [] for calendar_day in calendar_days
    }
    for index, event in enumerate(sorted_events, start=1):
        if (
            event.amount_minor < 0
            or event.available_date < event.event_date
            or event.event_date < start_date
            or event.event_date > end_date
            or len(event.currency) != 3
            or not event.currency.isupper()
        ):
            raise ValueError("event is outside the permitted dataset boundary")
        prior_amounts = [item.amount_minor for item in prior_events]
        prior_mean = sum(prior_amounts) / len(prior_amounts) if prior_amounts else None
        one_day_ago = event.event_date - timedelta(days=1)
        seven_days_ago = event.event_date - timedelta(days=7)
        features: dict[str, int | float | str | None] = {
            "category_bucket": event.category_bucket,
            "payee_reference": event.payee_reference,
            "event_day_of_week_utc": event.event_date.weekday(),
            "is_weekend": int(event.event_date.weekday() >= 5),
            "event_hour_utc": None,
            "event_hour_utc_availability": "unavailable",
            "prior_transaction_count": len(prior_events),
            "prior_mean_amount_minor": prior_mean,
            "amount_to_prior_mean": event.amount_minor / prior_mean
            if prior_mean
            else None,
            "count_1d": sum(item.event_date >= one_day_ago for item in prior_events),
            "count_7d": sum(item.event_date >= seven_days_ago for item in prior_events),
            "amount_sum_1d": sum(
                item.amount_minor
                for item in prior_events
                if item.event_date >= one_day_ago
            ),
            "amount_sum_7d": sum(
                item.amount_minor
                for item in prior_events
                if item.event_date >= seven_days_ago
            ),
            "payee_prior_count": sum(
                item.payee_reference == event.payee_reference for item in prior_events
            ),
            "category_prior_count": sum(
                item.category_bucket == event.category_bucket for item in prior_events
            ),
        }
        transactions.append(
            EnrichedTransaction(
                _event_identifier(scenario_id, event, index), event, features
            )
        )
        prior_events.append(event)
        daily[event.event_date].append(event)
    aggregates = tuple(
        DailyAggregate(
            aggregate_date=calendar_day,
            transaction_count=len(daily[calendar_day]),
            outbound_amount_minor=sum(
                event.amount_minor
                for event in daily[calendar_day]
                if event.direction == "outbound"
            ),
            category_counts=dict(
                sorted(
                    Counter(
                        event.category_bucket for event in daily[calendar_day]
                    ).items()
                )
            ),
        )
        for calendar_day in calendar_days
    )
    return ScenarioDataset(
        scenario_id,
        fixture_version,
        creation_revision,
        start_date,
        end_date,
        tuple(transactions),
        aggregates,
        baseline_version,
        overlay_version,
    )


def build_scenario_datasets(
    *,
    baseline_version: str,
    creation_revision: str,
    start_date: date,
    end_date: date,
    baseline_events: list[SanitisedEvent],
    scenario_packet: dict[str, Any],
) -> tuple[ScenarioDataset, ...]:
    """Copy a sanitised baseline into S01 through S08 with fixture based overlays.

    A scenario receives a transaction overlay only when its accepted fixture
    names amount, currency, and direction. Control only scenarios keep their
    own isolated baseline copy until an explicit simulated event is appended.
    """
    scenarios = scenario_packet.get("scenarios")
    if not isinstance(scenarios, list):
        raise TypeError("scenario packet does not define scenarios")
    by_id = {
        item.get("scenario_id"): item for item in scenarios if isinstance(item, dict)
    }
    if set(by_id) != set(SCENARIO_IDS):
        raise ValueError("scenario packet must define S01 through S08 exactly once")
    datasets: list[ScenarioDataset] = []
    for scenario_id in SCENARIO_IDS:
        facts = by_id[scenario_id].get("facts", {})
        if not isinstance(facts, dict):
            raise TypeError("scenario facts are invalid")
        events = list(baseline_events)
        if {"amount_minor", "currency", "direction"}.issubset(facts):
            amount_minor, currency, direction = (
                facts["amount_minor"],
                facts["currency"],
                facts["direction"],
            )
            if (
                not isinstance(amount_minor, int)
                or not isinstance(currency, str)
                or direction not in {"inbound", "outbound"}
            ):
                raise ValueError("scenario transaction overlay is invalid")
            events.append(
                SanitisedEvent(
                    end_date,
                    end_date,
                    amount_minor,
                    currency,
                    direction,
                    f"scenario_{scenario_id.lower()}",
                    f"payee_{scenario_id.lower()}",
                    "simulated",
                    f"overlay_{scenario_id.lower()}_v1",
                )
            )
        source_revision = facts.get("source_revision", "control-only")
        datasets.append(
            build_dataset(
                scenario_id=scenario_id,
                fixture_version=f"{baseline_version.lower()}-{scenario_id.lower()}-v1",
                creation_revision=f"{creation_revision}:{source_revision}",
                start_date=start_date,
                end_date=end_date,
                events=events,
                baseline_version=baseline_version,
                overlay_version=OVERLAY_VERSION,
            )
        )
    return tuple(datasets)


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

    @staticmethod
    def _insert_dataset_contents(
        cursor: psycopg.Cursor[Any], dataset: ScenarioDataset
    ) -> None:
        """Insert transaction and calendar aggregate rows for one dataset."""
        for transaction in dataset.transactions:
            event = transaction.event
            cursor.execute(
                """INSERT INTO sandbox_transactions (scenario_id, fixture_version, transaction_id, event_date, available_date, amount_minor, currency, direction, category_bucket, payee_reference, payment_channel, feature_snapshot)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    dataset.scenario_id,
                    dataset.fixture_version,
                    transaction.transaction_id,
                    event.event_date,
                    event.available_date,
                    event.amount_minor,
                    event.currency,
                    event.direction,
                    event.category_bucket,
                    event.payee_reference,
                    event.payment_channel,
                    Jsonb(transaction.feature_snapshot),
                ),
            )
        for aggregate in dataset.daily_aggregates:
            cursor.execute(
                """INSERT INTO sandbox_daily_aggregates (scenario_id, fixture_version, aggregate_date, transaction_count, outbound_amount_minor, category_counts)
            VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    dataset.scenario_id,
                    dataset.fixture_version,
                    aggregate.aggregate_date,
                    aggregate.transaction_count,
                    aggregate.outbound_amount_minor,
                    Jsonb(aggregate.category_counts),
                ),
            )

    @classmethod
    def _insert_dataset(
        cls, cursor: psycopg.Cursor[Any], dataset: ScenarioDataset
    ) -> None:
        """Insert one dataset and its derived records using the current transaction."""
        cursor.execute(
            """INSERT INTO sandbox_datasets (scenario_id, fixture_version, source_class, creation_revision, enrichment_version, start_date, end_date, event_time_precision, baseline_version, overlay_version)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'date', %s, %s)""",
            (
                dataset.scenario_id,
                dataset.fixture_version,
                SOURCE_CLASS,
                dataset.creation_revision,
                ENRICHMENT_VERSION,
                dataset.start_date,
                dataset.end_date,
                dataset.baseline_version,
                dataset.overlay_version,
            ),
        )
        cls._insert_dataset_contents(cursor, dataset)

    @staticmethod
    def _delete_dataset_version(
        cursor: psycopg.Cursor[Any], scenario_id: str, fixture_version: str
    ) -> None:
        """Delete one dataset version, its derived rows, and retired append history.

        Args:
            cursor: Open cursor in the caller's database transaction.
            scenario_id: Validated scenario owning the dataset.
            fixture_version: Validated version to remove.

        Side effects:
            Deletes only rows for the supplied dataset, in foreign-key-safe order.
        """
        for query in (
            "DELETE FROM sandbox_simulated_event_appends WHERE scenario_id = %s AND fixture_version = %s",
            "DELETE FROM sandbox_daily_aggregates WHERE scenario_id = %s AND fixture_version = %s",
            "DELETE FROM sandbox_transactions WHERE scenario_id = %s AND fixture_version = %s",
            "DELETE FROM sandbox_datasets WHERE scenario_id = %s AND fixture_version = %s",
        ):
            cursor.execute(query, (scenario_id, fixture_version))

    @classmethod
    def _delete_dataset(
        cls, cursor: psycopg.Cursor[Any], dataset: ScenarioDataset
    ) -> None:
        """Delete one fixture version, children before the parent row they reference."""
        cls._delete_dataset_version(
            cursor, dataset.scenario_id, dataset.fixture_version
        )

    def replace_dataset(self, dataset: ScenarioDataset) -> None:
        """Replace one fixture version atomically with its derived records."""
        try:
            with (
                psycopg.connect(self._database_url) as connection,
                connection.cursor() as cursor,
            ):
                self._delete_dataset(cursor, dataset)
                self._insert_dataset(cursor, dataset)
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    def replace_baseline_and_scenarios(
        self,
        *,
        baseline_version: str,
        creation_revision: str,
        start_date: date,
        end_date: date,
        events: list[SanitisedEvent],
        datasets: tuple[ScenarioDataset, ...],
    ) -> None:
        """Persist one sanitised common baseline and all isolated scenario datasets."""
        try:
            with (
                psycopg.connect(self._database_url) as connection,
                connection.cursor() as cursor,
            ):
                cursor.execute(
                    "DELETE FROM sandbox_baseline_transactions WHERE baseline_version = %s",
                    (baseline_version,),
                )
                cursor.execute(
                    "DELETE FROM sandbox_baselines WHERE baseline_version = %s",
                    (baseline_version,),
                )
                cursor.execute(
                    """INSERT INTO sandbox_baselines (baseline_version, creation_revision, start_date, end_date, event_time_precision)
                VALUES (%s, %s, %s, %s, 'date')""",
                    (baseline_version, creation_revision, start_date, end_date),
                )
                for index, event in enumerate(events, start=1):
                    cursor.execute(
                        """INSERT INTO sandbox_baseline_transactions (baseline_version, transaction_id, event_date, available_date, amount_minor, currency, direction, category_bucket, payee_reference, payment_channel)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                        (
                            baseline_version,
                            _event_identifier("BASE", event, index),
                            event.event_date,
                            event.available_date,
                            event.amount_minor,
                            event.currency,
                            event.direction,
                            event.category_bucket,
                            event.payee_reference,
                            event.payment_channel,
                        ),
                    )
                for dataset in datasets:
                    self._delete_dataset(cursor, dataset)
                    self._insert_dataset(cursor, dataset)
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    def prune_superseded_datasets(
        self, *, apply: bool = False
    ) -> SandboxDatasetPruneCounts:
        """Plan or apply the explicit retention cleanup for imported Sandbox data.

        Args:
            apply: When true, delete eligible rows; false reports counts only.

        Returns:
            Counts of superseded datasets and unreferenced baselines selected.

        Raises:
            TypeError: If ``apply`` is not a boolean.
            SandboxDataUnavailable: If the database is unreachable or returns
                an invalid retention selection.

        Side effects:
            When ``apply`` is true, deletes sanitised child rows before their
            dataset parent, then removes unreferenced baseline rows. It never
            runs from reads or simulation execution.
        """
        if not isinstance(apply, bool):
            raise TypeError("apply must be a boolean")
        try:
            with (
                psycopg.connect(self._database_url) as connection,
                connection.cursor() as cursor,
            ):
                # A run's foreign key makes its historical dataset ineligible.
                cursor.execute(
                    """WITH ranked_datasets AS (
                    SELECT scenario_id, fixture_version,
                           ROW_NUMBER() OVER (
                               PARTITION BY scenario_id
                               ORDER BY imported_at DESC, fixture_version DESC
                           ) AS import_rank
                    FROM sandbox_datasets
                    )
                    SELECT scenario_id, fixture_version
                    FROM ranked_datasets AS dataset
                    WHERE import_rank > 1
                      AND NOT EXISTS (
                          SELECT 1 FROM sandbox_simulation_runs AS run
                          WHERE run.scenario_id = dataset.scenario_id
                            AND run.fixture_version = dataset.fixture_version
                      )
                      -- A Mixed run has no fixture version of its own; each of
                      -- its payments references its source dataset instead.
                      AND NOT EXISTS (
                          SELECT 1 FROM sandbox_simulation_events AS event
                          WHERE event.source_scenario_id = dataset.scenario_id
                            AND event.source_fixture_version = dataset.fixture_version
                      )"""
                )
                dataset_versions = self._validated_dataset_versions(cursor.fetchall())

                # Baselines can be retired only after retained datasets are known.
                cursor.execute(
                    """SELECT baseline.baseline_version
                    FROM sandbox_baselines AS baseline
                    WHERE NOT EXISTS (
                        SELECT 1 FROM sandbox_datasets AS dataset
                        WHERE dataset.baseline_version = baseline.baseline_version
                    )"""
                )
                baseline_versions = self._validated_baseline_versions(cursor.fetchall())
                if apply:
                    for scenario_id, fixture_version in dataset_versions:
                        self._delete_dataset_version(
                            cursor, scenario_id, fixture_version
                        )
                    for baseline_version in baseline_versions:
                        cursor.execute(
                            "DELETE FROM sandbox_baseline_transactions WHERE baseline_version = %s",
                            (baseline_version,),
                        )
                        cursor.execute(
                            "DELETE FROM sandbox_baselines WHERE baseline_version = %s",
                            (baseline_version,),
                        )
                return SandboxDatasetPruneCounts(
                    datasets=len(dataset_versions), baselines=len(baseline_versions)
                )
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    @staticmethod
    def _validated_dataset_versions(
        rows: list[tuple[Any, ...]],
    ) -> list[tuple[str, str]]:
        """Validate the database-selected dataset identifiers before deletion."""
        versions: list[tuple[str, str]] = []
        for row in rows:
            if (
                len(row) != 2
                or not isinstance(row[0], str)
                or not row[0]
                or not isinstance(row[1], str)
                or not row[1]
            ):
                raise SandboxDataUnavailable("Sandbox retention selection is invalid")
            versions.append((row[0], row[1]))
        return versions

    @staticmethod
    def _validated_baseline_versions(rows: list[tuple[Any, ...]]) -> list[str]:
        """Validate the database-selected baseline identifiers before deletion."""
        versions: list[str] = []
        for row in rows:
            if len(row) != 1 or not isinstance(row[0], str) or not row[0]:
                raise SandboxDataUnavailable("Sandbox retention selection is invalid")
            versions.append(row[0])
        return versions

    def create_simulation_run(
        self,
        scenario_id: str,
        run_id: str,
        seed: str,
        schedule: tuple[Any, ...],
        browser_id: str,
    ) -> dict[str, object]:
        """Persist one immutable scheduled run owned by one browser.

        Under one transaction wide advisory lock, so concurrent starts cannot
        overshoot a limit: refuse when this browser started too many runs in the
        last minute or the site is at its live run cap, then cancel this
        browser's other live run (never another browser's) and insert.

        A Mixed run (``MIX``, spec 0008) has no fixture version of its own;
        each payment records its source scenario and that scenario's latest
        fixture version, and is decided by that scenario's rule.
        """
        mixed = scenario_id == MIXED_FEED_ID
        if (
            (scenario_id not in SCENARIO_IDS and not mixed)
            or not run_id
            or not seed
            or not browser_id
        ):
            raise ValueError(
                "simulation run requires a scenario, run ID, seed and browser ID"
            )
        try:
            with (
                psycopg.connect(
                    self._database_url, row_factory=psycopg.rows.dict_row
                ) as connection,
                connection.cursor() as cursor,
            ):
                # A Mixed run needs every source dataset; the run itself names none.
                source_versions: dict[str, str] = {}
                for source in MIXED_FEED_SOURCES if mixed else (scenario_id,):
                    cursor.execute(
                        "SELECT fixture_version FROM sandbox_datasets WHERE scenario_id = %s ORDER BY imported_at DESC LIMIT 1",
                        (source,),
                    )
                    found = cursor.fetchone()
                    if found is None:
                        raise ScenarioDatasetNotFound(scenario_id)
                    source_versions[source] = found["fixture_version"]
                dataset = {
                    "fixture_version": None if mixed else source_versions[scenario_id]
                }
                cursor.execute(
                    "SELECT pg_advisory_xact_lock(hashtext('sandbox_simulation_start'))"
                )
                settings = load_public_database_guard_settings()
                # Estimate durable rows once a minute, before any run or its
                # schedule is inserted, so a public start cannot exceed budget.
                if settings.enabled and (
                    not table_has_capacity(
                        cursor,
                        "sandbox_simulation_runs",
                        settings.simulation_run_row_ceiling,
                    )
                    or not table_has_capacity(
                        cursor,
                        "sandbox_simulation_events",
                        settings.simulation_event_row_ceiling,
                        len(schedule),
                    )
                ):
                    raise SimulationStorageCeiling()
                cursor.execute(
                    """SELECT count(*) AS starts FROM sandbox_simulation_runs
                    WHERE browser_id = %s AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'""",
                    (browser_id,),
                )
                if cursor.fetchone()["starts"] >= MAX_SIMULATION_STARTS_PER_MINUTE:
                    raise SimulationRateLimited(browser_id)
                # This browser's own live run is about to be replaced, so it does not count.
                cursor.execute(
                    """SELECT count(*) AS live FROM sandbox_simulation_runs
                    WHERE state IN ('pending', 'running') AND browser_id IS DISTINCT FROM %s""",
                    (browser_id,),
                )
                if cursor.fetchone()["live"] >= MAX_LIVE_SIMULATION_RUNS:
                    raise SimulationBusy()
                cursor.execute(
                    """UPDATE sandbox_simulation_runs SET state = 'cancelled', completed_at = CURRENT_TIMESTAMP
                    WHERE browser_id = %s AND state IN ('pending', 'running')""",
                    (browser_id,),
                )
                cursor.execute(
                    """INSERT INTO sandbox_simulation_runs (run_id, scenario_id, fixture_version, seed, state, scheduled_event_count, browser_id)
                    VALUES (%s, %s, %s, %s, 'pending', %s, %s)""",
                    (
                        run_id,
                        scenario_id,
                        dataset["fixture_version"],
                        seed,
                        len(schedule),
                        browser_id,
                    ),
                )
                now = datetime.now(UTC)

                # Every outbound payment is decided now, by its scenario's rule
                # alone (spec 0004); a Mixed payment by its source scenario's
                # (spec 0008). The model score stays null until slice 3.
                def decided(
                    source: str, direction: str
                ) -> tuple[str | None, str | None, str | None]:
                    decision = feed_decision(source)
                    if decision is None or direction != "outbound":
                        return (None, None, None)
                    return (
                        decision.deterministic_route,
                        decision.recommendation,
                        decision.recommendation_basis,
                    )

                def lineage(item: Any) -> tuple[str | None, str | None]:
                    if not mixed:
                        return (None, None)
                    return (
                        item.source_scenario_id,
                        source_versions[item.source_scenario_id],
                    )

                # Features use only the owning scenario's imported outbound
                # history, then earlier scheduled payments from that scenario.
                model = load_portable_model()
                histories: dict[str, list[PortablePayment]] = {}
                for source, fixture_version in source_versions.items():
                    cursor.execute(
                        """SELECT transaction_id, event_date, amount_minor, payee_reference, category_bucket
                        FROM sandbox_transactions WHERE scenario_id = %s AND fixture_version = %s
                          AND direction = 'outbound' ORDER BY event_date, transaction_id""",
                        (source, fixture_version),
                    )
                    histories[source] = [
                        PortablePayment(
                            row["event_date"],
                            row["transaction_id"],
                            row["amount_minor"],
                            row["payee_reference"],
                            row["category_bucket"],
                        )
                        for row in cursor.fetchall()
                    ]

                def model_values(
                    item: Any,
                ) -> tuple[float | None, str | None, str | None]:
                    """Score one scheduled outbound payment without affecting its decision.

                    The return is deliberately nullable: a missing or invalid
                    artifact leaves the durable decision and any later case unchanged.
                    """
                    source = item.source_scenario_id or scenario_id
                    payment = PortablePayment(
                        item.event.event_date,
                        item.event.event_id or "",
                        item.event.amount_minor,
                        item.event.payee_reference,
                        item.event.category_bucket,
                    )
                    if item.event.direction != "outbound" or model is None:
                        return None, None, None
                    values = build_feature_vector(payment, histories[source])
                    score, input_hash = model.score(values)
                    histories[source].append(payment)
                    return round(score, 5), model.model_version, input_hash

                # One batched insert: a feed schedules hundreds of events.
                cursor.executemany(
                    """INSERT INTO sandbox_simulation_events (run_id, sequence, event_id, due_at, event_date, available_date, amount_minor, currency, direction, category_bucket, payee_reference, payment_channel, source_scenario_id, source_fixture_version, deterministic_route, recommendation, recommendation_basis, model_score, model_version, model_input_sha256)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    [
                        (
                            run_id,
                            item.sequence,
                            item.event.event_id,
                            now + timedelta(seconds=item.delay_seconds),
                            item.event.event_date,
                            item.event.available_date,
                            item.event.amount_minor,
                            item.event.currency,
                            item.event.direction,
                            item.event.category_bucket,
                            item.event.payee_reference,
                            item.event.payment_channel,
                            *lineage(item),
                            *decided(
                                item.source_scenario_id or scenario_id,
                                item.event.direction,
                            ),
                            *model_values(item),
                        )
                        for item in schedule
                    ],
                )
                return self.read_simulation_run_cursor(cursor, run_id, browser_id)
        except (
            ScenarioDatasetNotFound,
            SimulationBusy,
            SimulationRateLimited,
            SimulationStorageCeiling,
        ):
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    @staticmethod
    def read_simulation_run_cursor(
        cursor: psycopg.Cursor[Any], run_id: str, browser_id: str
    ) -> dict[str, object]:
        """Return safe progress for one of this browser's runs; another's reads as missing."""
        cursor.execute(
            """SELECT run_id, scenario_id, fixture_version, seed, state, scheduled_event_count, appended_event_count, created_at, started_at, completed_at, failure_reason
            FROM sandbox_simulation_runs WHERE run_id = %s AND browser_id = %s""",
            (run_id, browser_id),
        )
        run = cursor.fetchone()
        if run is None:
            raise ScenarioSimulationNotFound(run_id)
        cursor.execute(
            "SELECT MIN(due_at) AS next_due_at FROM sandbox_simulation_events WHERE run_id = %s AND appended_at IS NULL",
            (run_id,),
        )
        next_due = cursor.fetchone()["next_due_at"]
        routing: dict[str, dict[str, object]] = {
            outcome: {"count": 0, "recent": []}
            for outcome in ("PASS", "CHALLENGE", "HOLD")
        }
        if int(run["appended_event_count"]) > 0:
            cursor.execute(
                """SELECT event_id, sequence, recommendation
                    FROM sandbox_simulation_events
                    WHERE run_id = %s AND appended_at IS NOT NULL
                      AND recommendation IN ('PASS', 'CHALLENGE', 'HOLD')
                    ORDER BY sequence DESC""",
                (run_id,),
            )
            for event in cursor.fetchall():
                outcome = str(event["recommendation"])
                lane = routing[outcome]
                lane["count"] = int(lane["count"]) + 1
                recent = lane["recent"]
                if isinstance(recent, list) and len(recent) < 18:
                    recent.append(
                        {
                            "event_id": event["event_id"],
                            "sequence": event["sequence"],
                            "recommendation": outcome,
                        }
                    )
        return {
            "run_id": run["run_id"],
            "scenario_id": run["scenario_id"],
            "fixture_version": run["fixture_version"],
            "seed": run["seed"],
            "state": run["state"],
            "scheduled_event_count": run["scheduled_event_count"],
            "appended_event_count": run["appended_event_count"],
            "next_due_at": next_due.isoformat() if next_due else None,
            "routing_snapshot": {"by_recommendation": routing},
        }

    def read_simulation_run(self, run_id: str, browser_id: str) -> dict[str, object]:
        """Read safe state for one of this browser's simulation runs."""
        try:
            with (
                psycopg.connect(
                    self._database_url, row_factory=psycopg.rows.dict_row
                ) as connection,
                connection.cursor() as cursor,
            ):
                return self.read_simulation_run_cursor(cursor, run_id, browser_id)
        except ScenarioSimulationNotFound:
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    def cancel_simulation_run(self, run_id: str, browser_id: str) -> dict[str, object]:
        """Stop one of this browser's runs; shown payments stay shown, no more are added."""
        try:
            with (
                psycopg.connect(
                    self._database_url, row_factory=psycopg.rows.dict_row
                ) as connection,
                connection.cursor() as cursor,
            ):
                cursor.execute(
                    """UPDATE sandbox_simulation_runs SET state = 'cancelled', completed_at = CURRENT_TIMESTAMP
                    WHERE run_id = %s AND browser_id = %s AND state IN ('pending', 'running')""",
                    (run_id, browser_id),
                )
                return self.read_simulation_run_cursor(cursor, run_id, browser_id)
        except ScenarioSimulationNotFound:
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    def sweep_finished_simulation_runs(self, now: datetime | None = None) -> int:
        """Delete finished runs older than the retention window; events cascade."""
        cutoff = (now or datetime.now(UTC)) - SIMULATION_RETENTION
        try:
            with (
                psycopg.connect(self._database_url) as connection,
                connection.cursor() as cursor,
            ):
                cursor.execute(
                    """DELETE FROM sandbox_simulation_runs
                    WHERE state IN ('completed', 'cancelled', 'failed') AND completed_at < %s""",
                    (cutoff,),
                )
                return cursor.rowcount
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    def advance_due_simulation_events(
        self,
        now: datetime | None = None,
        case_validator: EventValidator | None = None,
    ) -> int:
        """Reveal every due event exactly once and return the number revealed.

        Each payment is revealed in its own transaction; a revealed non PASS
        payment's feed case is saved in that same transaction (spec 0004), so a
        failure before commit leaves the payment unrevealed and no case.

        The imported scenario dataset is never changed: a run's shown events
        are overlaid on it only when that run's analytics are read, so every
        run starts from the same imported base.

        Args:
            now: The clock used to find due events.
            case_validator: The accepted event schema when case storage is on;
                None when it is off, so payments are marked ``storage_off``.
        """
        now = now or datetime.now(UTC)
        advanced = 0
        try:
            # Autocommit, so each ``transaction()`` block is one real transaction.
            with (
                psycopg.connect(
                    self._database_url,
                    autocommit=True,
                    row_factory=psycopg.rows.dict_row,
                ) as connection,
                connection.cursor() as cursor,
            ):
                cursor.execute(
                    """SELECT event.run_id, event.sequence
                    FROM sandbox_simulation_events AS event JOIN sandbox_simulation_runs AS run USING (run_id)
                    WHERE event.appended_at IS NULL AND event.due_at <= %s AND run.state IN ('pending', 'running')
                    ORDER BY event.due_at, event.run_id, event.sequence""",
                    (now,),
                )
                for row in cursor.fetchall():
                    with connection.transaction():
                        advanced += self._reveal_event(
                            cursor, row["run_id"], row["sequence"], case_validator
                        )
                with connection.transaction():
                    cursor.execute("""UPDATE sandbox_simulation_runs AS run SET state = 'completed', completed_at = CURRENT_TIMESTAMP
                        WHERE state IN ('pending', 'running') AND scheduled_event_count = appended_event_count
                        AND NOT EXISTS (SELECT 1 FROM sandbox_simulation_events AS event WHERE event.run_id = run.run_id AND event.appended_at IS NULL)""")
                return advanced
        except (ScenarioDatasetNotFound, ScenarioSimulationNotFound):
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    @staticmethod
    def _reveal_event(
        cursor: psycopg.Cursor[Any],
        run_id: str,
        sequence: int,
        case_validator: EventValidator | None,
    ) -> int:
        """Reveal one due payment and save its feed case, in the caller's transaction.

        Returns:
            1 when the payment was revealed now; 0 when another worker holds
            it, it was already revealed, or its run was stopped meanwhile.
        """
        # The run row is locked too, so a Stop waits for this payment and then
        # reports its true count; nothing is revealed after it.
        cursor.execute(
            """SELECT event.due_at, event.deterministic_route, event.recommendation, event.recommendation_basis,
                event.model_score, event.model_version, event.case_id,
                COALESCE(event.source_scenario_id, run.scenario_id) AS scenario_id, run.browser_id
            FROM sandbox_simulation_events AS event JOIN sandbox_simulation_runs AS run USING (run_id)
            WHERE event.run_id = %s AND event.sequence = %s AND event.appended_at IS NULL
              AND run.state IN ('pending', 'running')
            FOR UPDATE OF event, run SKIP LOCKED""",
            (run_id, sequence),
        )
        event = cursor.fetchone()
        if event is None:
            return 0
        cursor.execute(
            "UPDATE sandbox_simulation_events SET appended_at = CURRENT_TIMESTAMP WHERE run_id = %s AND sequence = %s",
            (run_id, sequence),
        )
        cursor.execute(
            "UPDATE sandbox_simulation_runs SET state = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), appended_event_count = appended_event_count + 1 WHERE run_id = %s",
            (run_id,),
        )
        # PASS payments, and rows from before migration 0006, get no case.
        rule = feed_decision(event["scenario_id"])
        if (
            rule is None
            or event["recommendation"] in (None, "PASS")
            or event["case_id"] is not None
        ):
            return 1
        case_id: str | None = None
        # Runs from before migration 0005 have no owner, but they also have no
        # decision, so an ownerless decided payment does not occur in practice.
        if case_validator is None or event["browser_id"] is None:
            case_status = "storage_off"
        else:
            try:
                record = build_feed_case(
                    simulation_run_id=run_id,
                    sequence=sequence,
                    scenario_id=event["scenario_id"],
                    # The stored decision, with the rule's skip reason.
                    decision=FeedDecision(
                        event["deterministic_route"],
                        rule.skip_reason,
                        event["recommendation"],
                        event["recommendation_basis"],
                    ),
                    due_at=event["due_at"],
                    validator=case_validator,
                    model_score=float(event["model_score"])
                    if event["model_score"] is not None
                    else None,
                    model_version=event["model_version"],
                )
            except (CaseCaptureError, KeyError, TypeError, ValueError):
                # Revealed but never retried: the payment is shown, no case is kept.
                case_status = "invalid"
            else:
                try:
                    inserted = PsycopgCaseRepository.insert_case(
                        cursor, record, event["browser_id"]
                    )
                except CaseStorageCeiling:
                    logger.warning("case_persist_failed failure_class=storage_ceiling")
                    # The column allows saved, invalid or storage_off (migration
                    # 0006); a ceiling refusal is recorded as storage off.
                    case_status = "storage_off"
                else:
                    if inserted:
                        case_id, case_status = record.case_id, "saved"
                    else:
                        # The case ID already belongs to another row (a collision
                        # the run UUID makes near impossible), so keep no pointer.
                        case_status = "invalid"
        cursor.execute(
            "UPDATE sandbox_simulation_events SET case_id = %s, case_status = %s WHERE run_id = %s AND sequence = %s",
            (case_id, case_status, run_id, sequence),
        )
        return 1

    @staticmethod
    def _require_owned_run(
        cursor: psycopg.Cursor[Any],
        simulation_run_id: str,
        browser_id: str | None,
        dataset: dict[str, Any],
    ) -> None:
        """Raise ScenarioSimulationNotFound unless the run is this browser's, on this dataset.

        Another browser's run, another scenario's, or one on an older import
        all read as the same missing run, so a run ID reveals nothing. A Mixed
        run (spec 0008) belongs to each of its source scenarios' datasets; the
        overlay queries then take only payments from this dataset.
        """
        cursor.execute(
            """SELECT scenario_id, fixture_version FROM sandbox_simulation_runs
        WHERE run_id = %s AND browser_id = %s""",
            (simulation_run_id, browser_id),
        )
        run = cursor.fetchone()
        if run is not None and run["scenario_id"] == MIXED_FEED_ID:
            if dataset["scenario_id"] in MIXED_FEED_SOURCES:
                return
            raise ScenarioSimulationNotFound(simulation_run_id)
        if (
            run is None
            or run["scenario_id"] != dataset["scenario_id"]
            or run["fixture_version"] != dataset["fixture_version"]
        ):
            raise ScenarioSimulationNotFound(simulation_run_id)

    def read_analytics(
        self,
        scenario_id: str,
        simulation_run_id: str | None = None,
        browser_id: str | None = None,
    ) -> dict[str, object]:
        """Read the newest imported aggregate response for one scenario.

        With a simulation run, that run's shown events are added to the
        imported aggregates, so the response is the base plus this run only.
        """
        try:
            with (
                psycopg.connect(
                    self._database_url, row_factory=psycopg.rows.dict_row
                ) as connection,
                connection.cursor() as cursor,
            ):
                cursor.execute(
                    """SELECT scenario_id, fixture_version, source_class, enrichment_version, baseline_version, overlay_version, start_date, end_date, event_time_precision
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
                if simulation_run_id is not None:
                    self._require_owned_run(
                        cursor, simulation_run_id, browser_id, dataset
                    )
                    cursor.execute(
                        # A Mixed run's payments from other scenarios are left out.
                        """SELECT event_date, amount_minor, direction, category_bucket
                    FROM sandbox_simulation_events WHERE run_id = %s AND appended_at IS NOT NULL
                      AND (source_scenario_id IS NULL OR (source_scenario_id = %s AND source_fixture_version = %s))""",
                        (
                            simulation_run_id,
                            dataset["scenario_id"],
                            dataset["fixture_version"],
                        ),
                    )
                    aggregates = _overlay_shown_events(aggregates, cursor.fetchall())
        except (ScenarioDatasetNotFound, ScenarioSimulationNotFound):
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error
        return {
            "contract_version": "1.0",
            "scenario_id": dataset["scenario_id"],
            "fixture_version": dataset["fixture_version"],
            "source_class": dataset["source_class"],
            "enrichment_version": dataset["enrichment_version"],
            "baseline_version": dataset["baseline_version"] or "fixture-only",
            "overlay_version": dataset["overlay_version"] or "fixture-only",
            "time_boundary": {
                "start_date": dataset["start_date"].isoformat(),
                "end_date": dataset["end_date"].isoformat(),
                "event_time_precision": dataset["event_time_precision"],
            },
            "daily_aggregates": [
                {
                    "date": item["aggregate_date"].isoformat(),
                    "transaction_count": item["transaction_count"],
                    "outbound_amount_minor": item["outbound_amount_minor"],
                    "category_counts": item["category_counts"],
                }
                for item in aggregates
            ],
        }

    def read_decisions(
        self,
        scenario_id: str,
        simulation_run_id: str | None = None,
        browser_id: str | None = None,
    ) -> dict[str, object]:
        """Count PASS, CHALLENGE and HOLD per day for one scenario (spec 0004).

        Every imported outbound payment is decided by the scenario's rule, so
        the base assigns each day's outbound count to that one recommendation.
        With a simulation run, that run's revealed, decided payments are added.
        Inbound credits are never counted.

        Raises:
            ScenarioNotDecided: For S06 to S08, which have no decision rule.
            ScenarioDatasetNotFound: If the scenario was never imported.
            ScenarioSimulationNotFound: As for ``read_analytics``.
            SandboxDataUnavailable: If the store cannot be read.
        """
        decision = feed_decision(scenario_id)
        if decision is None and scenario_id in SCENARIO_IDS:
            raise ScenarioNotDecided(scenario_id)
        try:
            with (
                psycopg.connect(
                    self._database_url, row_factory=psycopg.rows.dict_row
                ) as connection,
                connection.cursor() as cursor,
            ):
                cursor.execute(
                    """SELECT scenario_id, fixture_version, start_date, end_date
                FROM sandbox_datasets WHERE scenario_id = %s ORDER BY imported_at DESC LIMIT 1""",
                    (scenario_id,),
                )
                dataset = cursor.fetchone()
                if dataset is None or decision is None:
                    raise ScenarioDatasetNotFound(scenario_id)
                cursor.execute(
                    """SELECT event_date, count(*) AS payments FROM sandbox_transactions
                WHERE scenario_id = %s AND fixture_version = %s AND direction = 'outbound'
                GROUP BY event_date""",
                    (scenario_id, dataset["fixture_version"]),
                )
                imported = cursor.fetchall()
                revealed: list[dict[str, Any]] = []
                if simulation_run_id is not None:
                    self._require_owned_run(
                        cursor, simulation_run_id, browser_id, dataset
                    )
                    # Rows from before migration 0006 have no decision and are skipped.
                    cursor.execute(
                        """SELECT event_date, recommendation, count(*) AS payments
                    FROM sandbox_simulation_events
                    WHERE run_id = %s AND appended_at IS NOT NULL AND direction = 'outbound'
                      AND recommendation IS NOT NULL
                      AND (source_scenario_id IS NULL OR (source_scenario_id = %s AND source_fixture_version = %s))
                    GROUP BY event_date, recommendation""",
                        (
                            simulation_run_id,
                            dataset["scenario_id"],
                            dataset["fixture_version"],
                        ),
                    )
                    revealed = cursor.fetchall()
        except (ScenarioDatasetNotFound, ScenarioSimulationNotFound):
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error
        return {
            "contract_version": "0",
            "scenario_id": dataset["scenario_id"],
            "fixture_version": dataset["fixture_version"],
            **_decision_days(
                dataset["start_date"],
                dataset["end_date"],
                decision.recommendation,
                imported,
                revealed,
            ),
        }


def _decision_days(
    start_date: date,
    end_date: date,
    rule_recommendation: str,
    imported: list[dict[str, Any]],
    revealed: list[dict[str, Any]],
) -> dict[str, object]:
    """Count decided outbound payments per calendar day, zero days included.

    Args:
        start_date: The dataset's first day.
        end_date: The dataset's last day.
        rule_recommendation: The scenario rule's recommendation, which every
            imported outbound payment receives.
        imported: ``{event_date, payments}`` rows of imported outbound payments.
        revealed: ``{event_date, recommendation, payments}`` rows of one run's
            revealed, decided payments.

    Returns:
        ``days`` (one PASS, CHALLENGE and HOLD count per day) and ``totals``.
    """
    days = {
        day: dict.fromkeys(("PASS", "CHALLENGE", "HOLD"), 0)
        for day in _calendar_days(start_date, end_date)
    }
    for row in imported:
        if row["event_date"] in days:
            days[row["event_date"]][rule_recommendation] += row["payments"]
    # A payment outside the dataset's boundary is never invented into a new day.
    for row in revealed:
        if row["event_date"] in days:
            days[row["event_date"]][row["recommendation"]] += row["payments"]
    totals = dict.fromkeys(("PASS", "CHALLENGE", "HOLD"), 0)
    for counts in days.values():
        for recommendation, count in counts.items():
            totals[recommendation] += count
    return {
        "days": [{"date": day.isoformat(), **counts} for day, counts in days.items()],
        "totals": totals,
    }


def _overlay_shown_events(
    aggregates: list[dict[str, Any]], events: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Add shown simulation events to daily aggregates, as build_dataset counts them."""
    by_date = {
        item["aggregate_date"]: {
            **item,
            "category_counts": dict(item["category_counts"]),
        }
        for item in aggregates
    }
    for event in events:
        day = by_date.get(event["event_date"])
        if day is None:
            continue
        day["transaction_count"] += 1
        if event["direction"] == "outbound":
            day["outbound_amount_minor"] += event["amount_minor"]
        counts = day["category_counts"]
        counts[event["category_bucket"]] = counts.get(event["category_bucket"], 0) + 1
        day["category_counts"] = dict(sorted(counts.items()))
    return [by_date[item["aggregate_date"]] for item in aggregates]


def load_sandbox_analytics(
    scenario_id: str,
    simulation_run_id: str | None = None,
    browser_id: str | None = None,
) -> dict[str, object]:
    """Load one scenario's prepared chart data, optionally with one run's feed added."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).read_analytics(
        scenario_id, simulation_run_id, browser_id
    )


def load_sandbox_decisions(
    scenario_id: str,
    simulation_run_id: str | None = None,
    browser_id: str | None = None,
) -> dict[str, object]:
    """Load one scenario's decided payment counts per day, optionally with one run's feed."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).read_decisions(
        scenario_id, simulation_run_id, browser_id
    )


def start_sandbox_simulation(scenario_id: str, browser_id: str) -> dict[str, object]:
    """Create one durable deterministic run for the latest selected dataset.

    Args:
        scenario_id: Scenario whose latest isolated dataset seeds the run.
        browser_id: The anonymous showcase browser that owns the run.

    Returns:
        Dashboard-safe run state with no transaction-level information.

    Raises:
        SandboxDataUnavailable: If the optional Neon store is unavailable.
        ScenarioDatasetNotFound: If the selected scenario was not imported.
        SimulationBusy: If the site is at its live run cap.
        SimulationRateLimited: If this browser started too many runs this minute.
    """
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    repository = PsycopgScenarioRepository(database_url)
    from server.sandbox_data.simulation import (
        build_mixed_schedule,
        build_scenario_schedule,
    )

    run_id = str(uuid.uuid4())
    if scenario_id == MIXED_FEED_ID:
        # Each source's payments land on that source dataset's latest day.
        latest_days: dict[str, date] = {}
        for source in MIXED_FEED_SOURCES:
            try:
                source_analytics = repository.read_analytics(source)
            except ScenarioDatasetNotFound as error:
                raise ScenarioDatasetNotFound(scenario_id) from error
            latest_days[source] = date.fromisoformat(
                str(source_analytics["time_boundary"]["end_date"])
            )
        return repository.create_simulation_run(
            scenario_id,
            run_id,
            "sandbox-simulation-v1",
            build_mixed_schedule(latest_days, run_id),
            browser_id,
        )
    analytics = repository.read_analytics(scenario_id)
    # Feed payments land on the dataset's latest day, inside its time boundary.
    latest_day = date.fromisoformat(str(analytics["time_boundary"]["end_date"]))
    schedule = build_scenario_schedule(scenario_id, latest_day, run_id)
    return repository.create_simulation_run(
        scenario_id, run_id, "sandbox-simulation-v1", schedule, browser_id
    )


def load_sandbox_simulation_run(run_id: str, browser_id: str) -> dict[str, object]:
    """Load safe state for one of this browser's Sandbox simulation runs."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).read_simulation_run(
        run_id, browser_id
    )


def cancel_sandbox_simulation(run_id: str, browser_id: str) -> dict[str, object]:
    """Stop one of this browser's Sandbox simulation runs."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).cancel_simulation_run(
        run_id, browser_id
    )


@functools.lru_cache(maxsize=1)
def _compiled_event_validator(schema_path: Path) -> EventValidator:
    """Compile the accepted event schema once per path, not on every poll."""
    return EventValidator(schema_path)


def _feed_case_validator() -> EventValidator | None:
    """Return the event schema when case storage is on, else None (storage off).

    The same switch as Run showcase cases: ``SHOWCASE_CASES_ENABLED`` plus a
    database. An unreadable schema leaves storage off, as it does for the API.
    """
    settings = load_case_settings()
    if not settings.ready:
        return None
    try:
        return _compiled_event_validator(settings.event_schema_path)
    except (OSError, ValueError):
        return None


def advance_sandbox_simulation_events() -> int:
    """Reveal due scheduled events without contacting Plaid or a browser.

    Side effects:
        Marks due payments as shown and, with case storage on, saves one feed
        case per revealed non PASS payment (spec 0004).
    """
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).advance_due_simulation_events(
        case_validator=_feed_case_validator()
    )


def sweep_sandbox_simulation_runs() -> int:
    """Delete finished feed runs older than 7 days, with their events."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).sweep_finished_simulation_runs()


def sweep_expired_showcase_cases() -> int:
    """Delete expired saved cases through the case repository.

    Returns:
        Number of expired cases removed; their stored event rows cascade.

    Raises:
        SandboxDataUnavailable: If no optional store is configured or it cannot
            be reached.

    Side effects:
        Deletes only expired durable showcase cases and never logs identifiers.
    """
    settings = load_case_settings()
    if not settings.ready or not settings.database_url:
        return 0
    try:
        return PsycopgCaseRepository(settings.database_url).sweep_expired_cases()
    except CasesUnavailable as error:
        raise SandboxDataUnavailable("case storage is unavailable") from error
