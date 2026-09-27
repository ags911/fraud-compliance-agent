"""Load opt-in, process-local guards for the proposed public showcase database."""

import os
import time
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass
from threading import Lock
from typing import Any


def _positive_int_env(name: str, default: int) -> int:
    """Read one positive integer public-database safeguard from the environment.

    Args:
        name: Environment-variable name used for the operator setting.
        default: Safe value used when the setting is absent.

    Returns:
        The configured positive integer.

    Raises:
        RuntimeError: If the configured value is not a positive integer.

    Side effects:
        Reads one process environment variable.
    """
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as error:
        raise RuntimeError(f"{name} must be a positive integer") from error
    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer")
    return value


def _explicit_boolean(name: str, default: bool = False) -> bool:
    """Read one explicit public-database feature switch.

    Args:
        name: Environment-variable name used for the feature switch.
        default: Safe value used when the setting is absent.

    Returns:
        Parsed boolean value.

    Raises:
        RuntimeError: If a configured value is not an explicit boolean.

    Side effects:
        Reads one process environment variable.
    """
    raw = os.getenv(name, str(default)).strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be true or false")


@dataclass(frozen=True)
class PublicDatabaseGuardSettings:
    """Hold the proposed public database limits without opening a connection."""

    enabled: bool
    client_feed_starts_per_minute: int
    client_case_reads_per_minute: int
    case_row_ceiling: int
    simulation_run_row_ceiling: int
    simulation_event_row_ceiling: int


def load_public_database_guard_settings() -> PublicDatabaseGuardSettings:
    """Load the opt-in public database safeguards and their safe defaults.

    Returns:
        Settings for process-local limits and durable row ceilings.

    Raises:
        RuntimeError: If an operator supplied an invalid setting.

    Side effects:
        Reads six process environment variables. The safeguards remain inert
        until ``PUBLIC_DATABASE_GUARDS_ENABLED`` is explicitly true.
    """
    return PublicDatabaseGuardSettings(
        enabled=_explicit_boolean("PUBLIC_DATABASE_GUARDS_ENABLED"),
        client_feed_starts_per_minute=_positive_int_env(
            "SHOWCASE_CLIENT_FEED_STARTS_PER_MINUTE", 20
        ),
        client_case_reads_per_minute=_positive_int_env(
            "SHOWCASE_CLIENT_CASE_READS_PER_MINUTE", 60
        ),
        case_row_ceiling=_positive_int_env("SHOWCASE_CASE_ROW_CEILING", 20_000),
        simulation_run_row_ceiling=_positive_int_env(
            "SHOWCASE_SIMULATION_RUN_ROW_CEILING", 2_000
        ),
        simulation_event_row_ceiling=_positive_int_env(
            "SHOWCASE_SIMULATION_EVENT_ROW_CEILING", 400_000
        ),
    )


class ClientWindowLimiter:
    """Enforce one thread-safe, in-memory rolling limit for server-derived clients."""

    def __init__(
        self, maximum: int, *, clock: Callable[[], float] = time.monotonic
    ) -> None:
        """Create a one-minute counter.

        Args:
            maximum: Maximum requests permitted for one client in the window.
            clock: Monotonic clock injectable for deterministic tests.

        Side effects:
            Allocates process-local request timestamps; no identity is persisted
            or logged.
        """
        self._maximum = maximum
        self._clock = clock
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()
        self._last_sweep = clock()

    def allow(self, client_identity: str) -> bool:
        """Record a client request and return whether it fits the rolling minute.

        Args:
            client_identity: Server-derived address held only in this process.

        Returns:
            True when the request is within the configured limit, otherwise
            False without storing or logging the identity durably.

        Side effects:
            Updates in-memory timestamps, which disappear on process restart.
        """
        now = self._clock()
        with self._lock:
            requests = self._requests[client_identity]
            cutoff = now - 60.0
            while requests and requests[0] <= cutoff:
                requests.popleft()
            if len(requests) >= self._maximum:
                return False
            requests.append(now)
            # At most once a minute, drop every client whose window has fully
            # expired, so one-off addresses cannot grow the map without bound.
            if now - self._last_sweep >= 60.0:
                self._last_sweep = now
                for key in [
                    k for k, stamps in self._requests.items() if stamps[-1] <= cutoff
                ]:
                    del self._requests[key]
            return True


_ROW_ESTIMATE_SECONDS = 60.0
_row_estimates: dict[str, tuple[float, int]] = {}
_row_estimates_lock = Lock()


def table_has_capacity(
    cursor: Any, relation: str, ceiling: int, required_rows: int = 1
) -> bool:
    """Return whether an estimated PostgreSQL relation size can accept rows.

    Args:
        cursor: Open repository cursor used only with a fixed relation name.
        relation: Fixed showcase table name, never caller input.
        ceiling: Maximum permitted estimated row count for the relation.
        required_rows: Rows the pending operation would add.

    Returns:
        False when the cached-or-fresh estimated count plus pending rows reaches
        the ceiling; True otherwise.

    Side effects:
        Reads PostgreSQL ``pg_class`` at most once per relation per process
        minute and retains only a numeric estimate in memory.
    """
    now = time.monotonic()
    with _row_estimates_lock:
        cached = _row_estimates.get(relation)
        if cached is not None and now - cached[0] < _ROW_ESTIMATE_SECONDS:
            estimated_rows = cached[1]
        else:
            # ``relation`` is a module-owned fixed table name; parameterisation
            # keeps it separate from SQL text even at this repository boundary.
            cursor.execute(
                "SELECT GREATEST(reltuples, 0)::bigint AS estimated_rows "
                "FROM pg_class WHERE oid = %s::regclass",
                (relation,),
            )
            row = cursor.fetchone()
            # Callers use both tuple and dict row factories; read either shape.
            value = (
                row["estimated_rows"]
                if isinstance(row, dict)
                else (row[0] if row else 0)
            )
            estimated_rows = int(value or 0)
            _row_estimates[relation] = (now, estimated_rows)
    return estimated_rows + required_rows <= ceiling
