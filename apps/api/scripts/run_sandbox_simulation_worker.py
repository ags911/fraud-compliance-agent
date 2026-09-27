"""Advance due deterministic Sandbox simulation events from a durable schedule."""

import argparse
import time

from server.sandbox_data.service import (
    advance_sandbox_simulation_events,
    sweep_sandbox_simulation_runs,
)

SWEEP_SECONDS = 3600


def main() -> None:
    """Poll Neon and advance due events without contacting Plaid.

    Side effects:
        Marks due scheduled events as shown (the imported datasets are never
        changed) and deletes finished runs older than 7 days once an hour. The
        command runs until interrupted.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--poll-seconds", type=int, default=1)
    arguments = parser.parse_args()
    if arguments.poll_seconds < 1 or arguments.poll_seconds > 60:
        raise SystemExit("--poll-seconds must be between 1 and 60")
    last_sweep: float | None = None
    while True:
        advanced = advance_sandbox_simulation_events()
        if advanced:
            print(f"advanced={advanced}", flush=True)
        if last_sweep is None or time.monotonic() - last_sweep >= SWEEP_SECONDS:
            swept = sweep_sandbox_simulation_runs()
            if swept:
                print(f"swept={swept}", flush=True)
            last_sweep = time.monotonic()
        time.sleep(arguments.poll_seconds)


if __name__ == "__main__":
    main()
