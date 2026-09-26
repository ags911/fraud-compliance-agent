import { fetchSandboxScenarioAnalytics, type SandboxDailyAggregate, type SandboxScenarioAnalytics } from "@/lib/sandbox-scenario-analytics"
import { fetchSandboxScenarioDecisions, type SandboxDecisionCounts, type SandboxScenarioDecisions } from "@/lib/sandbox-scenario-decisions"

/**
 * The Mixed feed (spec 0008): one run whose payments come from S01 to S05,
 * each decided by its own scenario's rule. It has no dataset of its own, so
 * its Scenario tab is the sum of the five scenarios' existing reads, each
 * with the Mixed run added (the server adds only that scenario's payments).
 */
export const MIXED_FEED_ID = "MIX"
export const MIXED_FEED_SOURCES = ["S01", "S02", "S03", "S04", "S05"] as const
export const MIXED_FEED_LABEL = "Mixed feed"
export const MIXED_FEED_DETAIL = "S01 to S05"

const emptyCounts = (): SandboxDecisionCounts => ({ PASS: 0, CHALLENGE: 0, HOLD: 0 })

/** Sum daily aggregates by date; category counts are merged by bucket. */
export function combineAnalytics(parts: readonly SandboxScenarioAnalytics[]): SandboxScenarioAnalytics {
  const byDate = new Map<string, SandboxDailyAggregate>()
  for (const part of parts) {
    for (const day of part.daily_aggregates) {
      const total = byDate.get(day.date) ?? { date: day.date, transaction_count: 0, outbound_amount_minor: 0, category_counts: {} }
      total.transaction_count += day.transaction_count
      total.outbound_amount_minor += day.outbound_amount_minor
      for (const [bucket, count] of Object.entries(day.category_counts)) {
        total.category_counts[bucket] = (total.category_counts[bucket] ?? 0) + count
      }
      byDate.set(day.date, total)
    }
  }
  const [first] = parts
  return {
    ...first,
    scenario_id: MIXED_FEED_ID,
    // A display composite, not a dataset: it names every source's version.
    fixture_version: parts.map((part) => `${part.scenario_id}:${part.fixture_version}`).join(" "),
    time_boundary: {
      ...first.time_boundary,
      start_date: parts.map((part) => part.time_boundary.start_date).sort()[0],
      end_date: parts.map((part) => part.time_boundary.end_date).sort().at(-1) ?? first.time_boundary.end_date,
    },
    daily_aggregates: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}

/** Sum decided payments by date and in total. */
export function combineDecisions(parts: readonly SandboxScenarioDecisions[]): SandboxScenarioDecisions {
  const byDate = new Map<string, { date: string } & SandboxDecisionCounts>()
  const totals = emptyCounts()
  for (const part of parts) {
    for (const day of part.days) {
      const total = byDate.get(day.date) ?? { date: day.date, ...emptyCounts() }
      total.PASS += day.PASS
      total.CHALLENGE += day.CHALLENGE
      total.HOLD += day.HOLD
      byDate.set(day.date, total)
    }
    totals.PASS += part.totals.PASS
    totals.CHALLENGE += part.totals.CHALLENGE
    totals.HOLD += part.totals.HOLD
  }
  return {
    contract_version: "0",
    scenario_id: MIXED_FEED_ID,
    fixture_version: parts.map((part) => `${part.scenario_id}:${part.fixture_version}`).join(" "),
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    totals,
  }
}

/** The Scenario tab's activity for a scenario, or for S01 to S05 combined. */
export async function fetchScenarioAnalytics(scenarioId: string, simulationRunId?: string | null): Promise<SandboxScenarioAnalytics> {
  if (scenarioId !== MIXED_FEED_ID) return fetchSandboxScenarioAnalytics(scenarioId, simulationRunId)
  return combineAnalytics(await Promise.all(MIXED_FEED_SOURCES.map((source) => fetchSandboxScenarioAnalytics(source, simulationRunId))))
}

/** The Scenario tab's decided payments for a scenario, or for S01 to S05 combined. */
export async function fetchScenarioDecisions(scenarioId: string, simulationRunId?: string | null): Promise<SandboxScenarioDecisions> {
  if (scenarioId !== MIXED_FEED_ID) return fetchSandboxScenarioDecisions(scenarioId, simulationRunId)
  return combineDecisions(await Promise.all(MIXED_FEED_SOURCES.map((source) => fetchSandboxScenarioDecisions(source, simulationRunId))))
}
