"""Run the deterministic simulation worker inside the API process (local only).

The same server owned loop as ``scripts/run_sandbox_simulation_worker.py``,
started by the API when ``SIMULATION_WORKER_ENABLED`` is set, so a local demo
needs no second terminal. The browser still only starts, follows and stops a
run; it never advances the clock. The script stays for a separate job later.
"""

import asyncio

from server.sandbox_data.service import (
    SandboxDataUnavailable,
    advance_sandbox_simulation_events,
)

POLL_SECONDS = 1.0


async def run_simulation_worker(
    stop: asyncio.Event, poll_seconds: float = POLL_SECONDS
) -> None:
    """Advance due feed events every poll until ``stop`` is set.

    Args:
        stop: Set on API shutdown to end the loop.
        poll_seconds: Seconds between polls of the durable schedule.

    Side effects:
        Marks due scheduled events as shown in Neon. An unavailable store is
        retried on the next poll rather than stopping the API.
    """
    while not stop.is_set():
        try:
            # psycopg is synchronous, so each poll runs off the event loop.
            await asyncio.to_thread(advance_sandbox_simulation_events)
        except SandboxDataUnavailable:
            pass
        try:
            await asyncio.wait_for(stop.wait(), timeout=poll_seconds)
        except TimeoutError:
            continue
