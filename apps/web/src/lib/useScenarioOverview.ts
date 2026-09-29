import { useCallback, useRef, useState } from "react"

import {
  fetchSandboxOverview,
  sameOverviewSnapshot,
  type OverviewSnapshot,
  type SandboxOverview,
} from "@/lib/sandbox-overview"

export type ScenarioOverviewState =
  | { status: "idle" | "writing" | "unavailable" }
  | { status: "shown"; overview: SandboxOverview; outOfDate: boolean }

type Result =
  | { status: "idle" | "writing" | "unavailable" }
  | { status: "shown"; overview: SandboxOverview; snapshot: OverviewSnapshot }

/**
 * The Scenario tab's overview card state (spec 0011). Nothing is requested
 * until the viewer presses the button; the page's figures at that moment are
 * recorded, and when they change the overview says it is out of date (AC-9)
 * without asking again. It lives in the page, not the card, so it survives the
 * inactive Scenario tab unmounting.
 */
export function useScenarioOverview(current: OverviewSnapshot): {
  state: ScenarioOverviewState
  write: () => void
} {
  const [result, setResult] = useState<Result>({ status: "idle" })
  // Only the newest request's answer is shown.
  const request = useRef(0)

  const write = useCallback(() => {
    const snapshot = current
    const id = ++request.current
    setResult({ status: "writing" })
    fetchSandboxOverview(snapshot.scenarioId, snapshot.range, snapshot.runId).then(
      (overview) => {
        if (request.current === id) setResult({ status: "shown", overview, snapshot })
      },
      () => {
        if (request.current === id) setResult({ status: "unavailable" })
      },
    )
  }, [current])

  if (result.status !== "shown") return { state: result, write }
  return {
    state: { status: "shown", overview: result.overview, outOfDate: !sameOverviewSnapshot(result.snapshot, current) },
    write,
  }
}
