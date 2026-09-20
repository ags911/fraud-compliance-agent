"""Process-local admission control for bounded live demonstration windows."""

import asyncio
import time
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass

from server.showcase_investigation.settings import LiveLimits


@dataclass(frozen=True)
class AdmissionDecision:
    """Report whether a live run acquired one process-local slot."""

    allowed: bool
    reason: str | None = None


class LiveAdmissionController:
    """Enforce accepted live-run limits within one API process.

    The controller intentionally provides no durable or distributed quota.
    Restarting the process resets every counter, as disclosed by ADR-014.
    """

    def __init__(
        self,
        limits: LiveLimits,
        *,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        """Create a window starting at process construction time.

        Args:
            limits: Accepted concurrency, client, total, duration and timeout
                limits loaded from versioned configuration.
            clock: Monotonic clock injectable for deterministic tests.

        Side effects:
            Creates in-memory counters and an asynchronous lock.
        """
        self._limits = limits
        self._clock = clock
        self._enabled_at = clock()
        self._active = 0
        self._total = 0
        self._client_runs: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def acquire(self, client_key: str) -> AdmissionDecision:
        """Attempt to reserve one live run without waiting for capacity.

        Args:
            client_key: Server-derived connection identity. Caller-controlled
                forwarding headers must not be passed here.

        Returns:
            An allowed decision or the stable ``admission_limited`` reason.

        Side effects:
            On success, increments process-local active, total and client
            counters until ``release`` is called for the active slot.
        """
        now = self._clock()
        async with self._lock:
            recent = self._client_runs[client_key]
            cutoff = now - self._limits.per_client_window_seconds
            while recent and recent[0] <= cutoff:
                recent.popleft()
            if (
                now - self._enabled_at >= self._limits.maximum_window_seconds
                or self._active >= self._limits.maximum_concurrent
                or self._total >= self._limits.maximum_per_process_window
                or len(recent) >= self._limits.maximum_per_client
            ):
                return AdmissionDecision(False, "admission_limited")
            self._active += 1
            self._total += 1
            recent.append(now)
            return AdmissionDecision(True)

    async def release(self) -> None:
        """Release one previously acquired concurrent slot.

        Side effects:
            Decrements only the active count; rate and window totals remain.
        """
        async with self._lock:
            if self._active > 0:
                self._active -= 1
