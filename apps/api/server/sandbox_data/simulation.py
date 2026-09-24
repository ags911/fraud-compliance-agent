"""Define safe, deterministic schedules for transaction-shaped demo scenarios."""

from dataclasses import dataclass
from datetime import date

from server.sandbox_data.service import SanitisedEvent


@dataclass(frozen=True)
class ScheduledSimulationEvent:
    """Describe one ordered simulated event without a provider data dependency.

    Args:
        sequence: One based immutable order within a simulation run.
        delay_seconds: Offset from a run start used only to pace the display.
        event: Sanitised event that will be appended to the selected scenario.
    """

    sequence: int
    delay_seconds: int
    event: SanitisedEvent


def build_scenario_schedule(
    scenario_id: str, start_date: date, run_id: str
) -> tuple[ScheduledSimulationEvent, ...]:
    """Return the reviewed transaction-shaped schedule for one scenario.

    Args:
        scenario_id: Selected S01 through S08 scenario identifier.
        start_date: First date after the selected dataset's current boundary.
        run_id: Opaque run identifier used only to make each append event unique.

    Returns:
        Ordered, deterministic sanitised events. Workflow-only scenarios return
        an empty schedule.
    """
    definitions: dict[str, tuple[tuple[int, int, str, str, int], ...]] = {
        "S01": ((1, 0, "recurring_payment", "payee_s01_recurring", 4200),),
        "S02": (
            (1, 0, "high_velocity", "payee_s02_velocity", 140000),
            (2, 3, "high_velocity", "payee_s02_velocity", 140000),
            (3, 6, "high_velocity", "payee_s02_velocity", 140000),
        ),
        "S03": ((1, 0, "new_payee", "payee_s03_new", 180000),),
        "S04": ((1, 0, "ambiguous_context", "payee_s04_context", 26500),),
        "S05": ((1, 0, "dependency_outage", "payee_s05_outage", 72500),),
    }
    schedule: list[ScheduledSimulationEvent] = []
    for sequence, delay_seconds, category, payee, amount_minor in definitions.get(
        scenario_id, ()
    ):
        event = SanitisedEvent(
            event_date=start_date,
            available_date=start_date,
            amount_minor=amount_minor,
            currency="GBP",
            direction="outbound",
            category_bucket=category,
            payee_reference=payee,
            payment_channel="simulated",
            event_id=f"simulation_{run_id}_{sequence}",
        )
        schedule.append(ScheduledSimulationEvent(sequence, delay_seconds, event))
    return tuple(schedule)
