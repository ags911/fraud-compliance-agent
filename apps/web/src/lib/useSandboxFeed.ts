import { useCallback, useEffect, useRef, useState } from "react"

import {
  cancelSandboxSimulation,
  FEED_SCENARIOS,
  followSandboxSimulation,
  isFinishedRun,
  SandboxFeedError,
  startSandboxSimulation,
  type SandboxSimulationRun,
} from "@/lib/sandbox-simulation"

// With the worker running, the first payment lands at once; a run still at
// zero after this long means the worker is not running.
const WORKER_WAIT_MS = 6000

export type SandboxFeedState =
  | { status: "unsupported" }
  | { status: "idle" }
  | { status: "starting" }
  | { status: "live"; run: SandboxSimulationRun; waitingForWorker: boolean }
  | { status: "finished"; run: SandboxSimulationRun }
  | { status: "busy" }
  | { status: "unavailable" }

type Feed =
  | { scenarioId: string; status: "starting" | "busy" | "unavailable" }
  | { scenarioId: string; status: "run"; run: SandboxSimulationRun; waitingForWorker: boolean }

/**
 * The Scenario tab's live feed for the selected scenario. Changing scenario
 * stops a running feed, so a hidden run never keeps counting. `runId` is the
 * run whose payments the dashboard should add to the imported base, and
 * `revision` changes each time that run adds a payment.
 */
export function useSandboxFeed(scenarioId: string): {
  state: SandboxFeedState
  runId: string | null
  revision: number
  start: () => void
  stop: () => void
} {
  const [feed, setFeed] = useState<Feed | null>(null)
  const current = feed?.scenarioId === scenarioId ? feed : null
  const liveRunId = current?.status === "run" && !isFinishedRun(current.run) ? current.run.run_id : null

  // Follow the live run's progress stream.
  useEffect(() => {
    if (!liveRunId) return
    const stopFollowing = followSandboxSimulation(liveRunId, (run) =>
      setFeed((previous) =>
        previous?.status === "run" && previous.run.run_id === run.run_id
          ? { ...previous, run, waitingForWorker: previous.waitingForWorker && run.appended_event_count === 0 }
          : previous,
      ),
    )
    const timer = window.setTimeout(
      () =>
        setFeed((previous) =>
          previous?.status === "run" && previous.run.run_id === liveRunId && previous.run.appended_event_count === 0
            ? { ...previous, waitingForWorker: true }
            : previous,
        ),
      WORKER_WAIT_MS,
    )
    return () => {
      stopFollowing()
      window.clearTimeout(timer)
    }
  }, [liveRunId])

  // Stop a running feed when the viewer moves to another scenario or leaves.
  const liveRef = useRef<string | null>(null)
  useEffect(() => {
    liveRef.current = liveRunId
  }, [liveRunId])
  useEffect(
    () => () => {
      if (liveRef.current) void cancelSandboxSimulation(liveRef.current).catch(() => undefined)
    },
    [scenarioId],
  )

  const start = useCallback(() => {
    if (!FEED_SCENARIOS.includes(scenarioId)) return
    setFeed({ scenarioId, status: "starting" })
    startSandboxSimulation(scenarioId).then(
      (run) => setFeed({ scenarioId, status: "run", run, waitingForWorker: false }),
      // At a limit (site cap or starts per minute) reads as busy, not broken.
      (error: unknown) =>
        setFeed({ scenarioId, status: error instanceof SandboxFeedError && error.reason === "busy" ? "busy" : "unavailable" }),
    )
  }, [scenarioId])

  const stop = useCallback(() => {
    if (!liveRunId) return
    cancelSandboxSimulation(liveRunId).then(
      (run) => setFeed((previous) => (previous?.status === "run" && previous.run.run_id === run.run_id ? { ...previous, run } : previous)),
      () => undefined,
    )
  }, [liveRunId])

  let state: SandboxFeedState
  if (!FEED_SCENARIOS.includes(scenarioId)) state = { status: "unsupported" }
  else if (!current) state = { status: "idle" }
  else if (current.status !== "run") state = { status: current.status }
  else if (isFinishedRun(current.run)) state = { status: "finished", run: current.run }
  else state = { status: "live", run: current.run, waitingForWorker: current.waitingForWorker }

  const run = current?.status === "run" ? current.run : null
  return { state, runId: run?.run_id ?? null, revision: run?.appended_event_count ?? 0, start, stop }
}
