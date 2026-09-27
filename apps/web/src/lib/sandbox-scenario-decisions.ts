import { addDays, format, parseISO } from "date-fns"

import type { DateWindow } from "@/lib/scenario-date-window"
import { showcaseBrowserHeaders } from "@/lib/showcase-browser-id"

export type SandboxDecisionCounts = { PASS: number; CHALLENGE: number; HOLD: number }

/**
 * Decided outbound payments per day for one scenario (spec 0004, internal,
 * contract version "0"). Every payment is decided by the scenario's
 * deterministic rule alone; no model score contributes.
 */
export type SandboxScenarioDecisions = {
  contract_version: "0"
  scenario_id: string
  fixture_version: string
  days: Array<{ date: string } & SandboxDecisionCounts>
  totals: SandboxDecisionCounts
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8010"

/**
 * Fetch one scenario's decided payment counts. With a live feed run, the
 * counts are the imported payments plus that run's revealed payments so far.
 */
export async function fetchSandboxScenarioDecisions(
  scenarioId: string,
  simulationRunId?: string | null,
): Promise<SandboxScenarioDecisions> {
  const query = simulationRunId ? `?simulation_run_id=${encodeURIComponent(simulationRunId)}` : ""
  // A run overlay is scoped to the browser that owns the run (spec 0003).
  const headers = simulationRunId ? showcaseBrowserHeaders() : undefined
  const response = await fetch(`${API_BASE_URL}/sandbox/scenarios/${encodeURIComponent(scenarioId)}/decisions${query}`, { headers })
  if (!response.ok) throw new Error("Scenario decisions are unavailable")
  return response.json() as Promise<SandboxScenarioDecisions>
}

/** One calendar day of decided payments, shaped for the recommendations chart. */
export type SandboxDecisionDatum = { date: string; label: string } & SandboxDecisionCounts

/**
 * One entry per calendar day in the selected window. The API already returns
 * every day in the dataset's boundary, zero days included, so a missing day
 * can only mean no payments and is filled with zero, never invented.
 */
export function sandboxDecisionSeries(decisions: SandboxScenarioDecisions, window: DateWindow): SandboxDecisionDatum[] {
  const byDate = new Map(decisions.days.map((day) => [day.date, day]))
  const days: SandboxDecisionDatum[] = []
  // Calendar dates, parsed as local dates so they never shift by timezone.
  for (let day = window.start; day <= window.end; day = addDays(day, 1)) {
    const date = format(day, "yyyy-MM-dd")
    const counts = byDate.get(date)
    if (!counts && decisions.days.length && (date < decisions.days[0].date || date > decisions.days[decisions.days.length - 1].date)) continue
    days.push({
      date,
      label: format(parseISO(date), "d MMM"),
      PASS: counts?.PASS ?? 0,
      CHALLENGE: counts?.CHALLENGE ?? 0,
      HOLD: counts?.HOLD ?? 0,
    })
  }
  return days
}
