import { showcaseBrowserHeaders } from "@/lib/showcase-browser-id"

/**
 * The live feed (spec 0003): a server owned, bounded simulation run that the
 * worker advances. The browser only starts, follows and stops its own run,
 * scoped by the anonymous showcase browser ID; it never sends payment data or
 * advances the clock.
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

/** Why a start or stop was refused: at a limit (429), or not available at all. */
export class SandboxFeedError extends Error {
  readonly reason: "busy" | "unavailable"

  constructor(reason: "busy" | "unavailable") {
    super(reason === "busy" ? "The live feed is busy" : "The live feed is unavailable")
    this.reason = reason
  }
}

/** The browser ID header, or null when this browser has none (storage blocked). */
export function feedHeaders(): Record<string, string> | null {
  const headers = showcaseBrowserHeaders()
  return Object.keys(headers).length ? headers : null
}

async function postRun(path: string): Promise<SandboxSimulationRun> {
  const headers = feedHeaders()
  if (!headers) throw new SandboxFeedError("unavailable")
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "POST", headers })
  // Both limits (site cap, starts per minute) read the same to a viewer: busy.
  if (response.status === 429) throw new SandboxFeedError("busy")
  if (!response.ok) throw new SandboxFeedError("unavailable")
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

const RECONNECT_MS = 1000
const MAX_RECONNECT_MS = 10000

/** Read `simulation_state` frames from one SSE response body. */
async function readStates(response: Response, onState: (run: SandboxSimulationRun) => boolean): Promise<boolean> {
  const reader = response.body?.getReader()
  if (!reader) return false
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) return false
    buffer = (buffer + decoder.decode(value, { stream: true })).replaceAll("\r\n", "\n")
    const frames = buffer.split("\n\n")
    buffer = frames.pop() ?? ""
    for (const frame of frames) {
      const lines = frame.split("\n")
      if (lines.find((line) => line.startsWith("event:"))?.slice(6).trim() !== "simulation_state") continue
      const data = lines.find((line) => line.startsWith("data:"))
      if (!data) continue
      if (onState(JSON.parse(data.slice(5)) as SandboxSimulationRun)) return true
    }
  }
}

/**
 * Follow one of this browser's runs. The stream is read with `fetch`, not
 * EventSource (which cannot send headers), so the browser ID travels in the
 * header and never in a URL. The server ends a long stream after about 11
 * minutes; while the run is still live this reconnects, backing off after a
 * failure. A 400 or 404 (not this browser's run) stops following. Returns a
 * function that stops following.
 */
export function followSandboxSimulation(runId: string, onState: (run: SandboxSimulationRun) => void): () => void {
  const controller = new AbortController()
  const headers = feedHeaders()
  const url = `${API_BASE_URL}/sandbox/simulation-runs/${encodeURIComponent(runId)}/events`
  const deliver = (run: SandboxSimulationRun) => {
    onState(run)
    return isFinishedRun(run)
  }
  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  void (async () => {
    if (!headers) return
    let delay = RECONNECT_MS
    while (!controller.signal.aborted) {
      try {
        const response = await fetch(url, { headers, signal: controller.signal })
        if (response.status === 400 || response.status === 404) return
        if (response.ok) {
          if (await readStates(response, deliver)) return
          delay = RECONNECT_MS
        } else {
          delay = Math.min(delay * 2, MAX_RECONNECT_MS)
        }
      } catch {
        // A dropped connection or a garbled frame: back off and follow again.
        if (controller.signal.aborted) return
        delay = Math.min(delay * 2, MAX_RECONNECT_MS)
      }
      await wait(delay)
    }
  })()

  return () => controller.abort()
}
