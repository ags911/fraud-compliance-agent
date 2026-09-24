"""Store and read showcase cases through parameterised PostgreSQL queries."""

import base64
import binascii
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from server.showcase_cases.capture import (
    CONTRACT_VERSION,
    MAX_CASES_BY_ORIGIN,
    CaseRecord,
)

PAGE_SIZE = 20
_TIMEOUT_SECONDS = 3
_SCENARIOS = tuple(f"S0{number}" for number in range(1, 9))
_RECOMMENDATIONS = ("PASS", "CHALLENGE", "HOLD")
_CURSOR = re.compile(r"^[A-Za-z0-9_-]+$")

_SUMMARY_COLUMNS = (
    "case_id",
    "scenario_id",
    "requested_mode",
    "execution_mode",
    "fallback_reason",
    "provider",
    "model_id",
    "deterministic_route",
    "investigation_status",
    "recommendation",
    "recommendation_basis",
    "failure_reason",
    "authority_status",
    "tool_call_count",
    "evidence_count",
    "event_count",
    "fixture_version",
    "started_at",
    "completed_at",
    "expires_at",
    "contract_version",
    "origin",
    "model_score",
    "model_version",
)
# Column lists are composed from these fixed identifiers, never from input.
_SELECT_SUMMARY = sql.SQL(", ").join(map(sql.Identifier, _SUMMARY_COLUMNS))
# A case ID already present (a retried feed reveal) inserts nothing.
_INSERT_CASE = sql.SQL(
    "INSERT INTO showcase_cases (browser_id, {columns}) VALUES ({values}) "
    "ON CONFLICT (case_id) DO NOTHING RETURNING case_id"
).format(
    columns=_SELECT_SUMMARY,
    values=sql.SQL(", ").join(sql.Placeholder() * (len(_SUMMARY_COLUMNS) + 1)),
)
_SELECT_ONE_CASE = sql.SQL(
    "SELECT {columns} FROM showcase_cases WHERE case_id = %s AND browser_id = %s AND expires_at > now()"
).format(columns=_SELECT_SUMMARY)


class CasesUnavailable(RuntimeError):
    """Signal that the case store is disabled, unreachable, or failing."""


class CaseNotFound(LookupError):
    """Signal a case that is missing, expired, or owned by another browser."""


class InvalidCursor(ValueError):
    """Signal a paging cursor that does not decode to a valid position."""


@dataclass(frozen=True)
class CasePage:
    """One newest first page of a browser's cases plus tab wide totals."""

    items: list[dict[str, Any]]
    next_cursor: str | None
    totals: dict[str, Any]


def encode_cursor(completed_at: datetime, case_id: str) -> str:
    """Encode a paging position as base64url of ``<ISO time>|<case_id>``."""
    raw = f"{completed_at.isoformat(timespec='microseconds')}|{case_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    """Decode a paging cursor, raising InvalidCursor when it is malformed."""
    # The default decoder silently drops unknown characters, so check the
    # alphabet first and decode strictly.
    if not _CURSOR.fullmatch(cursor):
        raise InvalidCursor("the paging cursor is not valid")
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.b64decode(padded, altchars=b"-_", validate=True).decode("utf-8")
        timestamp, case_id = raw.split("|", 1)
        position = datetime.fromisoformat(timestamp)
    except (binascii.Error, UnicodeError, ValueError) as error:
        raise InvalidCursor("the paging cursor is not valid") from error
    if position.tzinfo is None or not case_id:
        raise InvalidCursor("the paging cursor is not valid")
    return position, case_id


def _summary(row: dict[str, Any]) -> dict[str, Any]:
    """Shape one database row as the proposed case summary (no browser ID)."""
    summary = {column: row[column] for column in _SUMMARY_COLUMNS}
    for column in ("started_at", "completed_at", "expires_at"):
        summary[column] = summary[column].isoformat()
    # NUMERIC reads back as Decimal; the summary carries a plain number.
    if summary["model_score"] is not None:
        summary["model_score"] = float(summary["model_score"])
    return summary


def empty_totals() -> dict[str, Any]:
    """Return zero totals, with every scenario present for the breakdown chart."""
    return {
        "total": 0,
        "by_recommendation": dict.fromkeys(_RECOMMENDATIONS, 0),
        "by_scenario": {
            scenario: dict.fromkeys(_RECOMMENDATIONS, 0) for scenario in _SCENARIOS
        },
        "deterministic_passes": 0,
        "fail_safe_holds": 0,
        "completed_investigations": 0,
    }


class PsycopgCaseRepository:
    """Persist and read cases in Neon PostgreSQL, scoped to one browser."""

    def __init__(self, database_url: str) -> None:
        """Store the PostgreSQL URL without opening a connection."""
        if not database_url.startswith(("postgresql://", "postgres://")):
            raise CasesUnavailable("DATABASE_URL must be a PostgreSQL URL")
        self._database_url = database_url

    def _connect(self, **options: Any) -> psycopg.Connection[Any]:
        """Open a connection that gives up quickly rather than delay a stream."""
        return psycopg.connect(
            self._database_url, connect_timeout=_TIMEOUT_SECONDS, **options
        )

    @staticmethod
    def _limit_statements(cursor: psycopg.Cursor[Any]) -> None:
        """Bound every statement in this transaction (safe on Neon's pooler)."""
        cursor.execute(
            sql.SQL("SET LOCAL statement_timeout = {}").format(
                sql.Literal(f"{_TIMEOUT_SECONDS}s")
            )
        )

    @staticmethod
    def insert_case(
        cursor: psycopg.Cursor[Any], record: CaseRecord, browser_id: str
    ) -> bool:
        """Insert one case and its events, then apply retention, in the caller's transaction.

        Args:
            cursor: A cursor inside the transaction that must hold the case.
            record: The validated case to store.
            browser_id: The anonymous browser that owns the case.

        Returns:
            True when the case was inserted; False when its ID already existed,
            in which case nothing is written.

        Raises:
            psycopg.Error: If the database rejects the write.

        Side effects:
            Takes this browser's advisory lock for the rest of the transaction,
            inserts the case and its events, then deletes this browser's
            expired cases and any of the record's origin beyond that origin's
            newest cap (50 showcase, 20 feed). Other origins are untouched.
        """
        # Serialise writes per browser so parallel writers cannot overshoot a cap.
        cursor.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (browser_id,)
        )
        cursor.execute(
            _INSERT_CASE,
            (browser_id, *(getattr(record, column) for column in _SUMMARY_COLUMNS)),
        )
        if cursor.fetchone() is None:
            return False
        cursor.executemany(
            """INSERT INTO showcase_case_events (case_id, sequence, event_id, event_type, payload, recorded_at)
            VALUES (%s, %s, %s, %s, %s, %s)""",
            [
                (
                    record.case_id,
                    event.sequence,
                    event.payload["event_id"],
                    event.payload["event"],
                    Jsonb(event.payload),
                    event.recorded_at,
                )
                for event in record.events
            ],
        )
        cursor.execute(
            "DELETE FROM showcase_cases WHERE browser_id = %s AND expires_at <= now()",
            (browser_id,),
        )
        cursor.execute(
            """DELETE FROM showcase_cases WHERE browser_id = %s AND origin = %s AND case_id NOT IN (
                SELECT case_id FROM showcase_cases WHERE browser_id = %s AND origin = %s
                ORDER BY completed_at DESC, case_id DESC LIMIT %s)""",
            (
                browser_id,
                record.origin,
                browser_id,
                record.origin,
                MAX_CASES_BY_ORIGIN[record.origin],
            ),
        )
        return True

    def save_case(self, record: CaseRecord, browser_id: str) -> None:
        """Insert one case and its events, then apply retention, atomically.

        Raises:
            psycopg.Error: If the database rejects or times out the write; the
                transaction is rolled back, so no partial case remains.

        Side effects:
            As ``insert_case``, in a transaction of its own with every
            statement bounded to a few seconds.
        """
        with self._connect() as connection, connection.cursor() as cursor:
            self._limit_statements(cursor)
            self.insert_case(cursor, record, browser_id)

    def list_cases(
        self,
        browser_id: str,
        *,
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
        scenario_id: str | None = None,
        recommendation: str | None = None,
    ) -> CasePage:
        """Return one newest first page of this browser's unexpired cases.

        Totals cover all of this browser's unexpired cases and ignore filters.

        Raises:
            InvalidCursor: If ``cursor`` does not decode.
            CasesUnavailable: If the database cannot be read.
        """
        position = decode_cursor(cursor) if cursor else None
        # Every clause is a fixed string; only values are passed as parameters.
        clauses = ["browser_id = %s", "expires_at > now()"]
        parameters: list[Any] = [browser_id]
        if scenario_id:
            clauses.append("scenario_id = %s")
            parameters.append(scenario_id)
        if recommendation:
            clauses.append("recommendation = %s")
            parameters.append(recommendation)
        if position:
            clauses.append("(completed_at, case_id) < (%s, %s)")
            parameters.extend(position)
        try:
            with (
                self._connect(row_factory=dict_row) as connection,
                connection.cursor() as db,
            ):
                self._limit_statements(db)
                db.execute(
                    sql.SQL(
                        "SELECT {columns} FROM showcase_cases WHERE {where} "
                        "ORDER BY completed_at DESC, case_id DESC LIMIT %s"
                    ).format(
                        columns=_SELECT_SUMMARY,
                        where=sql.SQL(" AND ").join(
                            sql.SQL(clause) for clause in clauses
                        ),
                    ),
                    (*parameters, limit + 1),
                )
                rows = db.fetchall()
                db.execute(
                    """SELECT scenario_id, recommendation, deterministic_route,
                        recommendation_basis, investigation_status, count(*) AS cases
                    FROM showcase_cases WHERE browser_id = %s AND expires_at > now()
                    GROUP BY scenario_id, recommendation, deterministic_route,
                        recommendation_basis, investigation_status""",
                    (browser_id,),
                )
                groups = db.fetchall()
        except psycopg.Error as error:
            raise CasesUnavailable("cases are unavailable") from error

        totals = empty_totals()
        for group in groups:
            count = group["cases"]
            totals["total"] += count
            totals["by_recommendation"][group["recommendation"]] += count
            totals["by_scenario"][group["scenario_id"]][group["recommendation"]] += (
                count
            )
            if group["deterministic_route"] == "PASS":
                totals["deterministic_passes"] += count
            if group["recommendation_basis"] == "fail_safe":
                totals["fail_safe_holds"] += count
            if group["investigation_status"] == "complete":
                totals["completed_investigations"] += count

        page = rows[:limit]
        next_cursor = (
            encode_cursor(page[-1]["completed_at"], page[-1]["case_id"])
            if len(rows) > limit
            else None
        )
        return CasePage([_summary(row) for row in page], next_cursor, totals)

    def get_case(self, browser_id: str, case_id: str) -> dict[str, Any]:
        """Return one case with its events, or raise CaseNotFound.

        A case that does not exist, has expired, or belongs to another browser
        raises the same CaseNotFound, so IDs reveal nothing.

        Raises:
            CaseNotFound: As above.
            CasesUnavailable: If the database cannot be read.
        """
        try:
            with (
                self._connect(row_factory=dict_row) as connection,
                connection.cursor() as db,
            ):
                self._limit_statements(db)
                db.execute(_SELECT_ONE_CASE, (case_id, browser_id))
                row = db.fetchone()
                if row is None:
                    raise CaseNotFound(case_id)
                db.execute(
                    """SELECT sequence, event_id, event_type, recorded_at, payload
                    FROM showcase_case_events WHERE case_id = %s ORDER BY sequence""",
                    (case_id,),
                )
                events = db.fetchall()
        except psycopg.Error as error:
            raise CasesUnavailable("cases are unavailable") from error
        return {
            "contract_version": CONTRACT_VERSION,
            "case": _summary(row),
            "events": [
                {**event, "recorded_at": event["recorded_at"].isoformat()}
                for event in events
            ],
        }
