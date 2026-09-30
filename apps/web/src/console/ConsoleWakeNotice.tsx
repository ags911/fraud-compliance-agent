import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"

import type { ServerWarmup } from "@/lib/useServerWarmup"

type ConsoleWakeNoticeProps = {
  state: ServerWarmup
}

// Measured cold starts of the hosted API on 2026-09-30: 15.5, 16.9, 17.4 and 22.4
// seconds to a healthy answer. Past the slowest of these, the notice says the
// start is taking longer than usual rather than promising a finish.
const SLOW_WAKE_SECONDS = 25
// The bar's time constant: it reaches about 85% at 18 seconds and never fills
// before the API answers, so it cannot claim a finish it has not seen.
const WAKE_PROGRESS_SECONDS = 8
const WAKE_PROGRESS_CEILING = 0.95

/** How far along the bar is after `seconds`, from 0 up to just under 1. */
function wakeProgress(seconds: number): number {
  return WAKE_PROGRESS_CEILING * (1 - Math.exp(-Math.max(0, seconds) / WAKE_PROGRESS_SECONDS))
}

/** Seconds since the page started loading, updated a few times a second. */
function usePageSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(() => performance.now() / 1000)
  useEffect(() => {
    if (!active) return
    const tick = window.setInterval(() => setSeconds(performance.now() / 1000), 250)
    return () => window.clearInterval(tick)
  }, [active])
  return seconds
}

/**
 * Says why the first load is slow: the hosted demo API sleeps when nobody
 * is using it and takes a while to start. While that start is visibly in
 * progress it shows the seconds so far and an estimated progress bar timed
 * from measured cold starts; it never claims the data is ready or broken.
 *
 * Only the sentence is a live region, so a screen reader hears it once and
 * again only if the start runs long, never a count of seconds.
 */
export function ConsoleWakeNotice({ state }: ConsoleWakeNoticeProps) {
  const waking = state === "waking"
  const seconds = usePageSeconds(waking)
  const slow = seconds >= SLOW_WAKE_SECONDS
  const percent = Math.round(wakeProgress(seconds) * 100)

  return (
    <div className="console-wake-notice">
      <div role="status" aria-live="polite">
        {waking ? (
          <div className="console-wake-notice-inner">
            <LoaderCircle aria-hidden="true" className="console-wake-spinner" />
            {slow ? (
              <span>
                <strong>Taking longer than usual, nearly there…</strong> The demo server is still starting.
              </span>
            ) : (
              <span>
                <strong>Starting the demo server…</strong> It sleeps when nobody is using it, so the first load takes
                about 15 to 25 seconds.
              </span>
            )}
          </div>
        ) : null}
      </div>
      {waking ? (
        <div className="console-wake-progress">
          <div
            aria-label="Demo server start, estimated"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="console-wake-track"
            role="progressbar"
          >
            <div className="console-wake-fill" style={{ width: `${percent}%` }} />
          </div>
          <span aria-hidden="true" className="console-wake-seconds">
            {Math.floor(seconds)}s
          </span>
        </div>
      ) : null}
    </div>
  )
}
