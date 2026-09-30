import type { ScenarioRange } from "@/lib/scenario-date-window"
import { showcaseBrowserHeaders } from "@/lib/showcase-browser-id"

/**
 * The Scenario tab's overview (spec 0011, `sandbox-overview.v1`, ADR-026): a
 * headline and 3 to 5 points about the figures on the page, written either by
 * the allowlisted AI model (every figure fact checked by the server) or by
 * fixed template rules. The browser sends no figures; the server builds them.
 */
export type SandboxOverviewFallbackReason =
  | "live_disabled"
  | "admission_limited"
  | "provider_unavailable"
  | "timeout"
  | "invalid_output"
  | "ungrounded"

export type SandboxOverview = {
  contract_version: "1.0"
  scenario_id: "S01" | "S02" | "S03" | "S04" | "S05" | "MIX"
  range: "7" | "30" | "all"
  window: { start: string; end: string; days: number }
  source: "live" | "template"
  model_id: string | null
  headline: string
  points: string[]
  fallback_reason: SandboxOverviewFallbackReason | null
  included: { feed: boolean; cases: boolean }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8010"

/**
 * Ask the API for one scenario's overview. The run ID travels in the body,
 * never the URL, so it stays out of access logs; the browser ID header lets
 * the server include this viewer's own feed and saved cases.
 */
export async function fetchSandboxOverview(
  scenarioId: string,
  range: ScenarioRange,
  simulationRunId: string | null,
): Promise<SandboxOverview> {
  const body: { range: string; simulation_run_id?: string } = { range: String(range) }
  if (simulationRunId) body.simulation_run_id = simulationRunId
  const response = await fetch(`${API_BASE_URL}/sandbox/scenarios/${encodeURIComponent(scenarioId)}/overview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...showcaseBrowserHeaders() },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error("The overview is unavailable")
  return response.json() as Promise<SandboxOverview>
}

/**
 * What the page had on screen when it asked for an overview (AC-9). When any
 * of it changes afterwards, the overview is out of date.
 */
export type OverviewSnapshot = {
  scenarioId: string
  range: ScenarioRange
  runId: string | null
  feedState: string
  feedShown: number
  cases: { PASS: number; CHALLENGE: number; HOLD: number } | null
}

export function sameOverviewSnapshot(a: OverviewSnapshot, b: OverviewSnapshot): boolean {
  return (
    a.scenarioId === b.scenarioId &&
    a.range === b.range &&
    a.runId === b.runId &&
    a.feedState === b.feedState &&
    a.feedShown === b.feedShown &&
    a.cases?.PASS === b.cases?.PASS &&
    a.cases?.CHALLENGE === b.cases?.CHALLENGE &&
    a.cases?.HOLD === b.cases?.HOLD
  )
}

/** Workflow scenarios have no payment decisions, so there is nothing to summarise (AC-1). */
export function overviewUnavailableReason(scenarioId: string): string | null {
  return /^S0[6-8]$/.test(scenarioId) ? "Workflow scenarios have no payment decisions to summarise." : null
}
