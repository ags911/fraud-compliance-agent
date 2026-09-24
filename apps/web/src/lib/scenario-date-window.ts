import { differenceInCalendarDays, format, max, parseISO, subDays } from "date-fns"

/** The Scenario tab's shared date range: the last 7 or 30 days, or everything. */
export type ScenarioRange = 7 | 30 | "all"

export const scenarioRangeOptions: ReadonlyArray<{ value: ScenarioRange; label: string }> = [
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: "all", label: "All" },
]

export type DateWindow = { start: Date; end: Date }

// Used only while the Sandbox dataset's own boundary is unknown (API not
// reachable): the same 29 Jun - 23 Sep 2026 span the imported datasets cover.
const FALLBACK_BOUNDARY = { start_date: "2026-06-29", end_date: "2026-09-23" }

/**
 * Resolve a range against a dataset's time boundary, so every Scenario chart
 * shows the same days and never reaches past the data that actually exists.
 * Dates are calendar days, parsed without a time of day.
 */
export function scenarioDateWindow(
  range: ScenarioRange,
  boundary: { start_date: string; end_date: string } | null,
): DateWindow {
  const { start_date, end_date } = boundary ?? FALLBACK_BOUNDARY
  const boundaryStart = parseISO(start_date)
  const end = parseISO(end_date)
  const start = range === "all" ? boundaryStart : max([boundaryStart, subDays(end, range - 1)])
  return { start, end }
}

export function windowDayCount({ start, end }: DateWindow): number {
  return differenceInCalendarDays(end, start) + 1
}

/** "25 Aug – 23 Sep 2026" */
export function formatDateWindow({ start, end }: DateWindow): string {
  const sameYear = start.getFullYear() === end.getFullYear()
  return `${format(start, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`
}
