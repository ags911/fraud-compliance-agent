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
  enrichment_version: "s04-enrichment-v1"
  time_boundary: {
    start_date: string
    end_date: string
    event_time_precision: "date" | "minute" | "second"
  }
  daily_aggregates: SandboxDailyAggregate[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8010"

/** Fetch read only, sanitised daily scenario aggregates for chart rendering. */
export async function fetchSandboxScenarioAnalytics(scenarioId: string): Promise<SandboxScenarioAnalytics> {
  const response = await fetch(`${API_BASE_URL}/sandbox/scenarios/${encodeURIComponent(scenarioId)}/analytics`)
  if (!response.ok) throw new Error("Sandbox scenario activity is unavailable")
  return response.json() as Promise<SandboxScenarioAnalytics>
}
