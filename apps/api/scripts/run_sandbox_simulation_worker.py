"""Advance due deterministic Sandbox simulation events from a durable schedule."""

import argparse
import time

from server.sandbox_data.service import advance_sandbox_simulation_events


def main() -> None:
    """Poll Neon and advance due events without contacting Plaid.

    Side effects:
        Appends only due events from stored scenario schedules and updates their
        isolated aggregate timelines. The command runs until interrupted.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--poll-seconds", type=int, default=1)
    arguments = parser.parse_args()
    if arguments.poll_seconds < 1 or arguments.poll_seconds > 60:
        raise SystemExit("--poll-seconds must be between 1 and 60")
    while True:
        advanced = advance_sandbox_simulation_events()
        if advanced:
            print(f"advanced={advanced}", flush=True)
        time.sleep(arguments.poll_seconds)


if __name__ == "__main__":
    main()
