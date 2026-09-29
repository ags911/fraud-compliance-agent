import { useEffect, useState } from "react"

/**
 * Whether the demo API is awake. The hosted API scales to zero when idle
 * (Azure Container Apps, `minReplicas: 0`), so the first visit after a quiet
 * spell waits 20 to 30 seconds while it starts. `/health` needs no database,
 * so its answer says only that the server is up.
 *
 * - `checking`: asked, no answer yet, and not long enough to mention.
 * - `waking`: still no answer after `WAKE_NOTICE_DELAY_MS`: say it is starting.
 * - `ready`: the API answered.
 * - `unreachable`: it failed or timed out; the page's own "unavailable"
 *   messages explain the rest.
 */
export type ServerWarmup = "checking" | "waking" | "ready" | "unreachable"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8010"
// A warm API answers in well under a second, so a warm load never flashes the notice.
export const WAKE_NOTICE_DELAY_MS = 1_500
// Longer than a cold start (about 25 seconds), so a slow start is not called a failure.
const WAKE_TIMEOUT_MS = 60_000

/** Ask the API whether it is awake once, when the page opens. */
export function useServerWarmup(): ServerWarmup {
  const [state, setState] = useState<ServerWarmup>("checking")

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const notice = window.setTimeout(() => {
      if (active) setState((current) => (current === "checking" ? "waking" : current))
    }, WAKE_NOTICE_DELAY_MS)
    const timeout = window.setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS)
    fetch(`${API_BASE_URL}/health`, { cache: "no-store", signal: controller.signal })
      .then(
        (response) => {
          if (active) setState(response.ok ? "ready" : "unreachable")
        },
        () => {
          if (active) setState("unreachable")
        },
      )
      .finally(() => {
        window.clearTimeout(notice)
        window.clearTimeout(timeout)
      })
    return () => {
      active = false
      window.clearTimeout(notice)
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  return state
}
