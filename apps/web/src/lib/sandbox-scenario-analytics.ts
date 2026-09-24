import { addDays, format, parseISO } from "date-fns"

import type { DateWindow } from "@/lib/scenario-date-window"

export type SandboxDailyAggregate = {
  date: string
  transaction_count: number
  outbound_amount_minor: number
  category_counts: Record<string, number>
}

export type SandboxScenarioAnalytics = {
  contract_version: "1.0"
  scenario_id: string
  fixture_version: string
  source_class: "sanitised_sandbox"
  enrichment_version: "s04-enrichment-v1" | "sandbox-enrichment-v2"
  /** Common Sandbox baseline the dataset was built from ("fixture-only" for a fixture import). */
  baseline_version: string
  /** Scenario overlay applied on top of the baseline ("fixture-only" when none). */
  overlay_version: string
  time_boundary: {
    start_date: string
    end_date: string
    event_time_precision: "date" | "minute" | "second"
  }
  daily_aggregates: SandboxDailyAggregate[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8010"

/**
 * Fetch read only, sanitised daily scenario aggregates for chart rendering.
 * With a live feed run, the aggregates are the imported base plus that run's
 * payments so far.
 */
export async function fetchSandboxScenarioAnalytics(
  scenarioId: string,
  simulationRunId?: string | null,
): Promise<SandboxScenarioAnalytics> {
  const query = simulationRunId ? `?simulation_run_id=${encodeURIComponent(simulationRunId)}` : ""
  const response = await fetch(`${API_BASE_URL}/sandbox/scenarios/${encodeURIComponent(scenarioId)}/analytics${query}`)
  if (!response.ok) throw new Error("Sandbox scenario activity is unavailable")
  return response.json() as Promise<SandboxScenarioAnalytics>
}

/** One calendar day of scenario activity, shaped for the Radar activity chart. */
export type SandboxActivityDatum = {
  date: string
  label: string
  longLabel: string
  transactionCount: number
  outboundAmountMinor: number
}

/**
 * Expand the aggregates to one entry per calendar day in the dataset's
 * time boundary, so the chart's x-axis spaces days honestly. The importer
 * already writes a zero-activity aggregate for every calendar day in that
 * boundary (build_dataset in apps/api/server/sandbox_data/service.py), so a
 * day missing inside it can only mean no activity -- it is filled with the
 * same zero the importer would write, never with invented activity.
 */
export function sandboxDailyActivitySeries(analytics: SandboxScenarioAnalytics, window?: DateWindow): SandboxActivityDatum[] {
  const byDate = new Map(analytics.daily_aggregates.map((aggregate) => [aggregate.date, aggregate]))
  // Dates are calendar days (event_time_precision "date"), so they are
  // parsed as local dates with no time-of-day, and never shift by timezone.
  const end = parseISO(analytics.time_boundary.end_date)
  const days: SandboxActivityDatum[] = []
  for (let day = parseISO(analytics.time_boundary.start_date); day <= end; day = addDays(day, 1)) {
    if (window && (day < window.start || day > window.end)) continue
    const date = format(day, "yyyy-MM-dd")
    const aggregate = byDate.get(date)
    days.push({
      date,
      // Same "d MMM" labels as the mock recommendation history chart.
      label: format(day, "d MMM"),
      longLabel: format(day, "d MMM yyyy"),
      transactionCount: aggregate?.transaction_count ?? 0,
      outboundAmountMinor: aggregate?.outbound_amount_minor ?? 0,
    })
  }
  return days
}

export type SandboxActivitySummary = {
  transactionCount: number
  outboundAmountMinor: number
  activeDays: number
  totalDays: number
  largestDay: SandboxActivityDatum | null
}

/** Totals for the Scenario tab's stat cards, over the days already selected. */
export function summariseSandboxActivity(days: readonly SandboxActivityDatum[]): SandboxActivitySummary {
  let largestDay: SandboxActivityDatum | null = null
  for (const day of days) {
    if (day.outboundAmountMinor > 0 && (!largestDay || day.outboundAmountMinor > largestDay.outboundAmountMinor)) largestDay = day
  }
  return {
    transactionCount: days.reduce((sum, day) => sum + day.transactionCount, 0),
    outboundAmountMinor: days.reduce((sum, day) => sum + day.outboundAmountMinor, 0),
    activeDays: days.filter((day) => day.transactionCount > 0).length,
    totalDays: days.length,
    largestDay,
  }
}
