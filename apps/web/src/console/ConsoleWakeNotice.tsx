import { LoaderCircle } from "lucide-react"

import type { ServerWarmup } from "@/lib/useServerWarmup"

type ConsoleWakeNoticeProps = {
  state: ServerWarmup
}

/**
 * Says why the first load is slow: the hosted demo API sleeps when nobody
 * is using it and takes a while to start. Shown only while that start is
 * visibly in progress; it never claims the data is ready or broken.
 */
export function ConsoleWakeNotice({ state }: ConsoleWakeNoticeProps) {
  return (
    <div className="console-wake-notice" role="status" aria-live="polite">
      {state === "waking" ? (
        <div className="console-wake-notice-inner">
          <LoaderCircle aria-hidden="true" className="console-wake-spinner" />
          <span>
            <strong>Starting the demo server…</strong> It sleeps when nobody is using it, so the first load can take
            about 30 seconds.
          </span>
        </div>
      ) : null}
    </div>
  )
}
