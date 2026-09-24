"""Build, persist, and read deterministic, sanitised Sandbox scenario data."""

import hashlib
import json
import os
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

import psycopg
from psycopg.types.json import Jsonb

ENRICHMENT_VERSION = "sandbox-enrichment-v2"
OVERLAY_VERSION = "s01-s08-overlay-v1"
SOURCE_CLASS = "sanitised_sandbox"
SCENARIO_IDS = tuple(f"S0{number}" for number in range(1, 9))


class SandboxDataUnavailable(RuntimeError):
    """Signal that the optional Sandbox data store is not configured or reachable."""


class ScenarioDatasetNotFound(RuntimeError):
    """Signal that a requested scenario has no imported dataset."""


class ScenarioSimulationNotFound(RuntimeError):
    """Signal that a requested deterministic simulation run does not exist."""


class SimulationBusy(RuntimeError):
    """Signal that the site already has the maximum number of live feed runs."""


class SimulationRateLimited(RuntimeError):
    """Signal that one browser started too many feed runs in the last minute."""


# Spec 0003 limits: live runs across the site, starts per browser per rolling
# minute, and how long a finished run is kept before the worker sweeps it.
MAX_LIVE_SIMULATION_RUNS = 20
MAX_SIMULATION_STARTS_PER_MINUTE = 3
SIMULATION_RETENTION = timedelta(days=7)


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

    def replace_dataset(self, dataset: ScenarioDataset) -> None:
        """Replace one fixture version atomically with its derived records."""
        try:
            with (
                psycopg.connect(self._database_url) as connection,
                connection.cursor() as cursor,
            ):
                cursor.execute(
                    "DELETE FROM sandbox_datasets WHERE scenario_id = %s AND fixture_version = %s",
                    (dataset.scenario_id, dataset.fixture_version),
                )
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
                    cursor.execute(
                        "DELETE FROM sandbox_simulated_event_appends WHERE scenario_id = %s AND fixture_version = %s",
                        (dataset.scenario_id, dataset.fixture_version),
                    )
                    cursor.execute(
                        "DELETE FROM sandbox_daily_aggregates WHERE scenario_id = %s AND fixture_version = %s",
                        (dataset.scenario_id, dataset.fixture_version),
                    )
                    cursor.execute(
                        "DELETE FROM sandbox_transactions WHERE scenario_id = %s AND fixture_version = %s",
                        (dataset.scenario_id, dataset.fixture_version),
                    )
                    cursor.execute(
                        "DELETE FROM sandbox_datasets WHERE scenario_id = %s AND fixture_version = %s",
                        (dataset.scenario_id, dataset.fixture_version),
                    )
                    self._insert_dataset(cursor, dataset)
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

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
        """
        if scenario_id not in SCENARIO_IDS or not run_id or not seed or not browser_id:
            raise ValueError("simulation run requires a scenario, run ID, seed and browser ID")
        try:
            with psycopg.connect(self._database_url, row_factory=psycopg.rows.dict_row) as connection, connection.cursor() as cursor:
                cursor.execute("SELECT fixture_version FROM sandbox_datasets WHERE scenario_id = %s ORDER BY imported_at DESC LIMIT 1", (scenario_id,))
                dataset = cursor.fetchone()
                if dataset is None:
                    raise ScenarioDatasetNotFound(scenario_id)
                cursor.execute("SELECT pg_advisory_xact_lock(hashtext('sandbox_simulation_start'))")
                cursor.execute("""SELECT count(*) AS starts FROM sandbox_simulation_runs
                    WHERE browser_id = %s AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'""", (browser_id,))
                if cursor.fetchone()["starts"] >= MAX_SIMULATION_STARTS_PER_MINUTE:
                    raise SimulationRateLimited(browser_id)
                # This browser's own live run is about to be replaced, so it does not count.
                cursor.execute("""SELECT count(*) AS live FROM sandbox_simulation_runs
                    WHERE state IN ('pending', 'running') AND browser_id IS DISTINCT FROM %s""", (browser_id,))
                if cursor.fetchone()["live"] >= MAX_LIVE_SIMULATION_RUNS:
                    raise SimulationBusy()
                cursor.execute("""UPDATE sandbox_simulation_runs SET state = 'cancelled', completed_at = CURRENT_TIMESTAMP
                    WHERE browser_id = %s AND state IN ('pending', 'running')""", (browser_id,))
                cursor.execute("""INSERT INTO sandbox_simulation_runs (run_id, scenario_id, fixture_version, seed, state, scheduled_event_count, browser_id)
                    VALUES (%s, %s, %s, %s, 'pending', %s, %s)""", (run_id, scenario_id, dataset["fixture_version"], seed, len(schedule), browser_id))
                now = datetime.now(UTC)
                # One batched insert: a feed schedules hundreds of events.
                cursor.executemany("""INSERT INTO sandbox_simulation_events (run_id, sequence, event_id, due_at, event_date, available_date, amount_minor, currency, direction, category_bucket, payee_reference, payment_channel)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""", [
                    (run_id, item.sequence, item.event.event_id, now + timedelta(seconds=item.delay_seconds), item.event.event_date, item.event.available_date, item.event.amount_minor, item.event.currency, item.event.direction, item.event.category_bucket, item.event.payee_reference, item.event.payment_channel)
                    for item in schedule
                ])
                return self.read_simulation_run_cursor(cursor, run_id, browser_id)
        except (ScenarioDatasetNotFound, SimulationBusy, SimulationRateLimited):
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    @staticmethod
    def read_simulation_run_cursor(
        cursor: psycopg.Cursor[Any], run_id: str, browser_id: str
    ) -> dict[str, object]:
        """Return safe progress for one of this browser's runs; another's reads as missing."""
        cursor.execute("""SELECT run_id, scenario_id, fixture_version, seed, state, scheduled_event_count, appended_event_count, created_at, started_at, completed_at, failure_reason
            FROM sandbox_simulation_runs WHERE run_id = %s AND browser_id = %s""", (run_id, browser_id))
        run = cursor.fetchone()
        if run is None:
            raise ScenarioSimulationNotFound(run_id)
        cursor.execute("SELECT MIN(due_at) AS next_due_at FROM sandbox_simulation_events WHERE run_id = %s AND appended_at IS NULL", (run_id,))
        next_due = cursor.fetchone()["next_due_at"]
        return {"run_id": run["run_id"], "scenario_id": run["scenario_id"], "fixture_version": run["fixture_version"], "seed": run["seed"], "state": run["state"], "scheduled_event_count": run["scheduled_event_count"], "appended_event_count": run["appended_event_count"], "next_due_at": next_due.isoformat() if next_due else None}

    def read_simulation_run(self, run_id: str, browser_id: str) -> dict[str, object]:
        """Read safe state for one of this browser's simulation runs."""
        try:
            with psycopg.connect(self._database_url, row_factory=psycopg.rows.dict_row) as connection, connection.cursor() as cursor:
                return self.read_simulation_run_cursor(cursor, run_id, browser_id)
        except ScenarioSimulationNotFound:
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    def cancel_simulation_run(self, run_id: str, browser_id: str) -> dict[str, object]:
        """Stop one of this browser's runs; shown payments stay shown, no more are added."""
        try:
            with psycopg.connect(self._database_url, row_factory=psycopg.rows.dict_row) as connection, connection.cursor() as cursor:
                cursor.execute("""UPDATE sandbox_simulation_runs SET state = 'cancelled', completed_at = CURRENT_TIMESTAMP
                    WHERE run_id = %s AND browser_id = %s AND state IN ('pending', 'running')""", (run_id, browser_id))
                return self.read_simulation_run_cursor(cursor, run_id, browser_id)
        except ScenarioSimulationNotFound:
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    def sweep_finished_simulation_runs(self, now: datetime | None = None) -> int:
        """Delete finished runs older than the retention window; events cascade."""
        cutoff = (now or datetime.now(UTC)) - SIMULATION_RETENTION
        try:
            with psycopg.connect(self._database_url) as connection, connection.cursor() as cursor:
                cursor.execute("""DELETE FROM sandbox_simulation_runs
                    WHERE state IN ('completed', 'cancelled', 'failed') AND completed_at < %s""", (cutoff,))
                return cursor.rowcount
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

    def advance_due_simulation_events(self, now: datetime | None = None) -> int:
        """Mark every due event as shown exactly once and return the number advanced.

        The imported scenario dataset is never changed: a run's shown events
        are overlaid on it only when that run's analytics are read, so every
        run starts from the same imported base.
        """
        now = now or datetime.now(UTC)
        advanced = 0
        try:
            with psycopg.connect(self._database_url, row_factory=psycopg.rows.dict_row) as connection, connection.cursor() as cursor:
                cursor.execute("""SELECT event.run_id, event.sequence
                    FROM sandbox_simulation_events AS event JOIN sandbox_simulation_runs AS run USING (run_id)
                    WHERE event.appended_at IS NULL AND event.due_at <= %s AND run.state IN ('pending', 'running')
                    ORDER BY event.due_at, event.run_id, event.sequence FOR UPDATE OF event, run SKIP LOCKED""", (now,))
                # The run row is locked too, so a Stop waits for this batch and
                # then reports its true count; nothing is added after it.
                for row in cursor.fetchall():
                    cursor.execute("UPDATE sandbox_simulation_events SET appended_at = CURRENT_TIMESTAMP WHERE run_id = %s AND sequence = %s AND appended_at IS NULL", (row["run_id"], row["sequence"]))
                    if cursor.rowcount:
                        cursor.execute("UPDATE sandbox_simulation_runs SET state = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), appended_event_count = appended_event_count + 1 WHERE run_id = %s", (row["run_id"],))
                        advanced += 1
                cursor.execute("""UPDATE sandbox_simulation_runs AS run SET state = 'completed', completed_at = CURRENT_TIMESTAMP
                    WHERE state IN ('pending', 'running') AND scheduled_event_count = appended_event_count
                    AND NOT EXISTS (SELECT 1 FROM sandbox_simulation_events AS event WHERE event.run_id = run.run_id AND event.appended_at IS NULL)""")
                return advanced
        except (ScenarioDatasetNotFound, ScenarioSimulationNotFound):
            raise
        except psycopg.Error as error:
            raise SandboxDataUnavailable("Sandbox database is unavailable") from error

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
                    cursor.execute(
                        """SELECT scenario_id, fixture_version FROM sandbox_simulation_runs
                    WHERE run_id = %s AND browser_id = %s""",
                        (simulation_run_id, browser_id),
                    )
                    run = cursor.fetchone()
                    # Another browser's run, another scenario's or an older import's is not this one.
                    if (
                        run is None
                        or run["scenario_id"] != scenario_id
                        or run["fixture_version"] != dataset["fixture_version"]
                    ):
                        raise ScenarioSimulationNotFound(simulation_run_id)
                    cursor.execute(
                        """SELECT event_date, amount_minor, direction, category_bucket
                    FROM sandbox_simulation_events WHERE run_id = %s AND appended_at IS NOT NULL""",
                        (simulation_run_id,),
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


def _overlay_shown_events(
    aggregates: list[dict[str, Any]], events: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Add shown simulation events to daily aggregates, as build_dataset counts them."""
    by_date = {
        item["aggregate_date"]: {**item, "category_counts": dict(item["category_counts"])}
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
    analytics = repository.read_analytics(scenario_id)
    from server.sandbox_data.simulation import build_scenario_schedule

    run_id = str(uuid.uuid4())
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
    return PsycopgScenarioRepository(database_url).read_simulation_run(run_id, browser_id)


def cancel_sandbox_simulation(run_id: str, browser_id: str) -> dict[str, object]:
    """Stop one of this browser's Sandbox simulation runs."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).cancel_simulation_run(run_id, browser_id)


def advance_sandbox_simulation_events() -> int:
    """Advance due scheduled events without contacting Plaid or a browser."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).advance_due_simulation_events()


def sweep_sandbox_simulation_runs() -> int:
    """Delete finished feed runs older than 7 days, with their events."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SandboxDataUnavailable("DATABASE_URL is not configured")
    return PsycopgScenarioRepository(database_url).sweep_finished_simulation_runs()
