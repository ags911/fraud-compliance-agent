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

// A live run whose tab stays hidden this long is stopped (spec 0009), so a
// background tab stops holding one of the site's live runs.
export const HIDDEN_STOP_MS = 120_000

const tabHidden = () => document.visibilityState === "hidden"

// The feed is on by default (spec 0005); switching Live off is remembered for
// this browser. Blocked storage falls back to on.
const LIVE_PREFERENCE_KEY = "radar-live-feed"

function liveSwitchedOff(): boolean {
  try {
    return window.localStorage.getItem(LIVE_PREFERENCE_KEY) === "off"
  } catch {
    return false
  }
}

function rememberLiveOff(off: boolean) {
  try {
    if (off) window.localStorage.setItem(LIVE_PREFERENCE_KEY, "off")
    else window.localStorage.removeItem(LIVE_PREFERENCE_KEY)
  } catch {
    // A display preference only; without storage the default applies.
  }
}

export type SandboxFeedState =
  | { status: "unsupported" }
  | { status: "idle" }
  | { status: "starting" }
  | { status: "live"; run: SandboxSimulationRun; waitingForWorker: boolean }
  | { status: "finished"; run: SandboxSimulationRun }
  // `auto`: the page started it, not the viewer, so a failure stays quiet.
  | { status: "busy"; auto: boolean }
  | { status: "unavailable"; auto: boolean }

type Feed =
  | { scenarioId: string; status: "starting" }
  | { scenarioId: string; status: "busy" | "unavailable"; auto: boolean }
  | { scenarioId: string; status: "run"; run: SandboxSimulationRun; waitingForWorker: boolean }

/**
 * The Scenario tab's live feed for the selected scenario. It starts by itself
 * on load and on each scenario change unless the viewer switched it off
 * (spec 0005). Changing scenario stops a running feed, so a hidden run never
 * keeps counting. `runId` is the run whose payments the dashboard should add
 * to the imported base, and `revision` changes each time that run adds a
 * payment. `start` and `stop` are the viewer's own actions.
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

  // Starts go to the server one at a time, and only the latest one counts.
  // The server cancels a browser's other live run when a new one starts, so
  // an older start landing late would otherwise stop the run on screen.
  const startQueue = useRef<Promise<unknown>>(Promise.resolve())
  const latestStart = useRef(0)
  const startRun = useCallback(
    (auto: boolean) => {
      if (!FEED_SCENARIOS.includes(scenarioId)) return
      const attempt = ++latestStart.current
      const request = startQueue.current.then(() => {
        // Already replaced by a newer start: don't spend a start on it.
        if (attempt !== latestStart.current) return null
        // Set from the queued step, not synchronously, so an automatic start
        // from an effect doesn't render twice.
        setFeed({ scenarioId, status: "starting" })
        return startSandboxSimulation(scenarioId)
      })
      startQueue.current = request.catch(() => undefined)
      request.then(
        (run) => {
          if (!run) return
          if (attempt !== latestStart.current) {
            void cancelSandboxSimulation(run.run_id).catch(() => undefined)
            return
          }
          setFeed({ scenarioId, status: "run", run, waitingForWorker: false })
        },
        // At a limit (site cap or starts per minute) reads as busy, not broken.
        (error: unknown) => {
          if (attempt !== latestStart.current) return
          const status = error instanceof SandboxFeedError && error.reason === "busy" ? "busy" : "unavailable"
          setFeed({ scenarioId, status, auto })
        },
      )
    },
    [scenarioId],
  )

  // On by default: start once per load and per scenario change, unless the
  // viewer switched Live off. A hidden tab waits until it is first shown, so
  // a background tab never starts a run (spec 0009). The ref is set only when
  // a start happens, which stops React's development double run from
  // starting twice without losing a start that is still waiting.
  const autoStartedFor = useRef<string | null>(null)
  useEffect(() => {
    if (autoStartedFor.current === scenarioId || liveSwitchedOff()) return
    const begin = () => {
      autoStartedFor.current = scenarioId
      startRun(true)
    }
    if (!tabHidden()) {
      begin()
      return
    }
    const onVisible = () => {
      if (tabHidden()) return
      document.removeEventListener("visibilitychange", onVisible)
      begin()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [scenarioId, startRun])

  // Stop a run and show its final count; nothing is remembered.
  const cancelRun = useCallback((runId: string) => {
    cancelSandboxSimulation(runId).then(
      (run) => setFeed((previous) => (previous?.status === "run" && previous.run.run_id === run.run_id ? { ...previous, run } : previous)),
      () => undefined,
    )
  }, [])

  // A tab hidden for HIDDEN_STOP_MS stops its run. Coming back does not
  // restart it, which would silently reset the figures; the viewer sees the
  // stopped count and can press Live. Their "off" preference is not saved.
  useEffect(() => {
    if (!liveRunId) return
    let timer: number | undefined
    const watch = () => {
      window.clearTimeout(timer)
      if (tabHidden()) timer = window.setTimeout(() => cancelRun(liveRunId), HIDDEN_STOP_MS)
    }
    watch()
    document.addEventListener("visibilitychange", watch)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", watch)
    }
  }, [liveRunId, cancelRun])

  // A closing tab cancels its run with a request that outlives the page.
  useEffect(() => {
    if (!liveRunId) return
    const onPageHide = () => void cancelSandboxSimulation(liveRunId, { keepalive: true }).catch(() => undefined)
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [liveRunId])

  const start = useCallback(() => {
    rememberLiveOff(false)
    startRun(false)
  }, [startRun])

  const stop = useCallback(() => {
    rememberLiveOff(true)
    if (liveRunId) cancelRun(liveRunId)
  }, [liveRunId, cancelRun])

  let state: SandboxFeedState
  if (!FEED_SCENARIOS.includes(scenarioId)) state = { status: "unsupported" }
  else if (!current) state = { status: "idle" }
  else if (current.status === "starting") state = { status: "starting" }
  else if (current.status !== "run") state = { status: current.status, auto: current.auto }
  else if (isFinishedRun(current.run)) state = { status: "finished", run: current.run }
  else state = { status: "live", run: current.run, waitingForWorker: current.waitingForWorker }

  const run = current?.status === "run" ? current.run : null
  return { state, runId: run?.run_id ?? null, revision: run?.appended_event_count ?? 0, start, stop }
}
