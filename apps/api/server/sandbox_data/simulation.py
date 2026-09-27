"""Define safe, deterministic schedules for transaction-shaped demo scenarios."""

import hashlib
from dataclasses import dataclass
from datetime import date

from server.sandbox_data.service import (
    MIXED_FEED_ID,
    MIXED_FEED_SOURCES,
    SanitisedEvent,
)

# A continuous feed: one payment every few seconds for a bounded run, so a run
# is still a fixed, predeclared, idempotent schedule (spec 0003).
FEED_INTERVAL_SECONDS = 3
FEED_DURATION_SECONDS = 600
FEED_EVENT_COUNT = FEED_DURATION_SECONDS // FEED_INTERVAL_SECONDS

# Each scenario's reviewed payment shape: category bucket, payee references it
# rotates through, and a typical amount in minor units. S06 to S08 are
# workflow scenarios and receive no invented payment schedule.
_SCENARIO_SHAPES: dict[str, tuple[str, tuple[str, ...], int]] = {
    "S01": ("recurring_payment", ("payee_s01_recurring", "payee_s01_utility"), 4200),
    "S02": ("high_velocity", ("payee_s02_velocity",), 140000),
    "S03": ("new_payee", ("payee_s03_new", "payee_s03_new_2"), 180000),
    "S04": ("ambiguous_context", ("payee_s04_context", "payee_s04_context_2"), 26500),
    "S05": ("dependency_outage", ("payee_s05_outage",), 72500),
}


@dataclass(frozen=True)
class ScheduledSimulationEvent:
    """Describe one ordered simulated event without a provider data dependency.

    Args:
        sequence: One based immutable order within a simulation run.
        delay_seconds: Offset from a run start used only to pace the display.
        event: Sanitised event that will be shown for the selected scenario.
        source_scenario_id: For a Mixed run (spec 0008), the scenario whose
            shape and decision this payment carries; None for a single
            scenario run, whose scenario is the run's own.
    """

    sequence: int
    delay_seconds: int
    event: SanitisedEvent
    source_scenario_id: str | None = None


def _unit(seed: str, scenario_id: str, sequence: int) -> float:
    """Return a repeatable value in [0, 1) for one scheduled position."""
    digest = hashlib.sha256(f"{seed}:{scenario_id}:{sequence}".encode()).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def build_scenario_schedule(
    scenario_id: str,
    event_date: date,
    run_id: str,
    *,
    seed: str = "sandbox-simulation-v1",
    event_count: int = FEED_EVENT_COUNT,
    interval_seconds: int = FEED_INTERVAL_SECONDS,
) -> tuple[ScheduledSimulationEvent, ...]:
    """Return the reviewed transaction-shaped feed for one scenario.

    Args:
        scenario_id: Selected S01 through S08 scenario identifier.
        event_date: The dataset's latest day; feed payments land on it, so the
            dashboard's date window does not move while a run counts up.
        run_id: Opaque run identifier used only to make each event unique.
        seed: Fixed seed, so the same run position always yields the same payment.
        event_count: How many payments the bounded run schedules.
        interval_seconds: Seconds between consecutive payments.

    Returns:
        Ordered, deterministic sanitised events. Workflow-only scenarios return
        an empty schedule.
    """
    shape = _SCENARIO_SHAPES.get(scenario_id)
    if shape is None:
        return ()
    category, payees, typical_amount = shape
    schedule: list[ScheduledSimulationEvent] = []
    for sequence in range(1, event_count + 1):
        # Amounts vary by up to 30% either side of the scenario's typical amount.
        variation = 0.7 + 0.6 * _unit(seed, scenario_id, sequence)
        event = SanitisedEvent(
            event_date=event_date,
            available_date=event_date,
            amount_minor=round(typical_amount * variation),
            currency="GBP",
            direction="outbound",
            category_bucket=category,
            payee_reference=payees[(sequence - 1) % len(payees)],
            payment_channel="simulated",
            event_id=f"simulation_{run_id}_{sequence}",
        )
        schedule.append(
            ScheduledSimulationEvent(sequence, (sequence - 1) * interval_seconds, event)
        )
    return tuple(schedule)


def build_mixed_schedule(
    latest_days: dict[str, date],
    run_id: str,
    *,
    seed: str = "sandbox-simulation-v1",
    event_count: int = FEED_EVENT_COUNT,
    interval_seconds: int = FEED_INTERVAL_SECONDS,
) -> tuple[ScheduledSimulationEvent, ...]:
    """Return the Mixed feed: S01 to S05 payments interleaved in seeded blocks.

    Each block of five positions holds one payment from each source scenario,
    in an order fixed by the seed and block number, so the mix is even and
    repeatable. Each payment is the one ``build_scenario_schedule`` would give
    its scenario at that position, on that scenario's latest day.

    Args:
        latest_days: Each source scenario's latest imported day.
        run_id: Opaque run identifier used only to make each event unique.
        seed: Fixed seed for the block order and amount variation.
        event_count: How many payments the bounded run schedules.
        interval_seconds: Seconds between consecutive payments.

    Returns:
        Ordered, deterministic events, each naming its source scenario.

    Raises:
        KeyError: If a source scenario has no latest day.
    """
    sources = MIXED_FEED_SOURCES
    by_source = {
        source: build_scenario_schedule(
            source,
            latest_days[source],
            run_id,
            seed=seed,
            event_count=event_count,
            interval_seconds=interval_seconds,
        )
        for source in sources
    }
    schedule: list[ScheduledSimulationEvent] = []
    for sequence in range(1, event_count + 1):
        block, slot = divmod(sequence - 1, len(sources))
        order = sorted(
            sources,
            key=lambda scenario: hashlib.sha256(
                f"{seed}:{MIXED_FEED_ID}:{block}:{scenario}".encode()
            ).digest(),
        )
        source = order[slot]
        item = by_source[source][sequence - 1]
        schedule.append(
            ScheduledSimulationEvent(
                sequence, item.delay_seconds, item.event, source_scenario_id=source
            )
        )
    return tuple(schedule)
