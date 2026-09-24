/**
 * The local live feed (spec 0003): a server owned, bounded simulation run
 * that the worker advances. The browser only starts, follows and stops a run;
 * it never sends payment data or advances the clock.
 */

export type SandboxSimulationRun = {
  run_id: string
  scenario_id: string
  fixture_version: string
  seed: string
  state: "pending" | "running" | "completed" | "failed" | "cancelled"
  scheduled_event_count: number
  appended_event_count: number
  next_due_at: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8010"

/** Scenarios with a payment schedule; S06 to S08 are workflow scenarios. */
export const FEED_SCENARIOS: readonly string[] = ["S01", "S02", "S03", "S04", "S05"]

export function isFinishedRun(run: SandboxSimulationRun): boolean {
  return run.state === "completed" || run.state === "failed" || run.state === "cancelled"
}

async function postRun(path: string): Promise<SandboxSimulationRun> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "POST" })
  if (!response.ok) throw new Error("The live feed is unavailable")
  return response.json() as Promise<SandboxSimulationRun>
}

/** Start a new feed run; it replaces any run still going for the scenario. */
export function startSandboxSimulation(scenarioId: string): Promise<SandboxSimulationRun> {
  return postRun(`/sandbox/scenarios/${encodeURIComponent(scenarioId)}/simulation-runs`)
}

/** Stop a feed run; payments already added stay on the dashboard. */
export function cancelSandboxSimulation(runId: string): Promise<SandboxSimulationRun> {
  return postRun(`/sandbox/simulation-runs/${encodeURIComponent(runId)}/cancel`)
}

/**
 * Follow one run's progress stream. EventSource reconnects by itself when the
 * server ends a long stream, so it is closed here once the run has finished.
 * Returns a function that stops following.
 */
export function followSandboxSimulation(runId: string, onState: (run: SandboxSimulationRun) => void): () => void {
  const source = new EventSource(`${API_BASE_URL}/sandbox/simulation-runs/${encodeURIComponent(runId)}/events`)
  source.addEventListener("simulation_state", (event) => {
    const run = JSON.parse((event as MessageEvent<string>).data) as SandboxSimulationRun
    onState(run)
    if (isFinishedRun(run)) source.close()
  })
  return () => source.close()
}
