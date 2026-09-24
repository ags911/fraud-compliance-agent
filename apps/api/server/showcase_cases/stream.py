"""Record a showcase run as a case while passing its stream through unchanged."""

import asyncio
import json
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime
from typing import Protocol

import psycopg

from server.showcase_cases.capture import (
    CapturedEvent,
    CaseCaptureError,
    CaseRecord,
    EventValidator,
    build_case,
)

_DATA_PREFIX = "data: "
_DONE_PREFIX = "event: done"


class CaseStore(Protocol):
    """The one write the stream needs: save a whole case atomically."""

    def save_case(self, record: CaseRecord, browser_id: str) -> None:
        """Persist the case and its events in one transaction, or nothing."""


class CaseRecorder:
    """Build and save a case from captured events without ever raising."""

    def __init__(
        self,
        store: CaseStore,
        validator: EventValidator,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        """Hold the store, the compiled event schema, and the server clock."""
        self._store = store
        self._validator = validator
        self.clock = clock

    async def save_quietly(self, events: list[CapturedEvent], browser_id: str) -> bool:
        """Try to save one run as a case.

        Returns:
            True when the case was committed; False when the run did not form
            a complete case or storage failed (the web app then shows it as
            "Not saved"). Nothing is raised, so the stream is never affected.

        Side effects:
            One database transaction, run in a worker thread that is shielded
            from stream cancellation so a started commit always finishes or
            rolls back cleanly.
        """
        try:
            record = build_case(events, self._validator)
        except (CaseCaptureError, KeyError, TypeError, ValueError):
            # No run_result (the run raised or was cut short) or an event that
            # does not match the contract: nothing is stored.
            return False
        try:
            await asyncio.shield(
                asyncio.to_thread(self._store.save_case, record, browser_id)
            )
        except (psycopg.Error, OSError, RuntimeError):
            # Storage must never break or alter the investigation stream: a
            # database error, a network failure or timeout (OSError), or a
            # store that is unavailable (RuntimeError) all mean "not saved".
            # Server side logging is a separate, still open decision (spec 0002
            # follow-up), so the failure is surfaced only as "Not saved".
            return False
        return True


async def record_case_stream(
    frames: AsyncIterator[str],
    *,
    browser_id: str | None,
    recorder: CaseRecorder | None,
) -> AsyncIterator[str]:
    """Pass SSE frames through unchanged, saving the run when it completes.

    Args:
        frames: The runtime's SSE output: ``data: {json}`` frames, then one
            ``event: done`` frame.
        browser_id: A validated browser scoping key, or None to skip storage.
        recorder: The case recorder, or None when storage is disabled.

    Yields:
        Exactly the input frames, in order. The case is committed on the
        ``done`` frame, before it is yielded, so a read after ``done`` finds it.
    """
    if recorder is None or browser_id is None:
        async for frame in frames:
            yield frame
        return

    captured: list[CapturedEvent] = []
    async for frame in frames:
        if frame.startswith(_DONE_PREFIX):
            await recorder.save_quietly(captured, browser_id)
        elif frame.startswith(_DATA_PREFIX):
            try:
                payload = json.loads(frame[len(_DATA_PREFIX) :])
            except ValueError:
                payload = None
            if isinstance(payload, dict) and "event_id" in payload:
                captured.append(
                    CapturedEvent(payload=payload, recorded_at=recorder.clock())
                )
        yield frame
