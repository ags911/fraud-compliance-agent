"""Run the deterministic simulation worker inside the API process (local only).

The same server owned loop as ``scripts/run_sandbox_simulation_worker.py``,
started by the API when ``SIMULATION_WORKER_ENABLED`` is set, so a local demo
needs no second terminal. The browser still only starts, follows and stops a
run; it never advances the clock. The script stays for a separate job later.
"""

import asyncio
import logging
import time

from server.sandbox_data.service import (
    SandboxDataUnavailable,
    advance_sandbox_simulation_events,
    sweep_expired_showcase_cases,
    sweep_sandbox_simulation_runs,
)

logger = logging.getLogger(__name__)

POLL_SECONDS = 1.0
# Finished runs older than 7 days are deleted at most this often (spec 0003).
SWEEP_SECONDS = 3600.0


async def run_simulation_worker(
    stop: asyncio.Event, poll_seconds: float = POLL_SECONDS
) -> None:
    """Advance due feed events every poll until ``stop`` is set.

    Args:
        stop: Set on API shutdown to end the loop.
        poll_seconds: Seconds between polls of the durable schedule.

    Side effects:
        Marks due scheduled events as shown in Neon, and sweeps finished runs
        plus expired showcase cases once an hour. An unavailable store is
        retried on the next poll rather than stopping the API. Logs each sweep's
        count, and a store outage once when it starts and once when it ends.
    """
    last_sweep: float | None = None
    store_down = False
    while not stop.is_set():
        try:
            # psycopg is synchronous, so each poll runs off the event loop.
            await asyncio.to_thread(advance_sandbox_simulation_events)
            if store_down:
                logger.info("simulation_worker_store_recovered")
                store_down = False
            if last_sweep is None or time.monotonic() - last_sweep >= SWEEP_SECONDS:
                swept = await asyncio.to_thread(sweep_sandbox_simulation_runs)
                logger.info("simulation_runs_swept count=%d", swept)
                swept_cases = await asyncio.to_thread(sweep_expired_showcase_cases)
                logger.info("showcase_cases_swept count=%d", swept_cases)
                last_sweep = time.monotonic()
        except SandboxDataUnavailable:
            # Log only the change, not every one second poll of an outage.
            if not store_down:
                logger.warning("simulation_worker_store_unavailable")
                store_down = True
        try:
            await asyncio.wait_for(stop.wait(), timeout=poll_seconds)
        except TimeoutError:
            continue
