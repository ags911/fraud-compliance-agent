import { API_HEALTH_LABELS, useApiHealth } from "@/lib/useApiHealth"
import { cn } from "@/lib/utils"

const HEALTH_DOT_COLOURS = {
  checking: "bg-muted-foreground/40",
  waking: "bg-[#f5a500]",
  ready: "bg-[#00bd6c]",
  unavailable: "bg-[#ee343b]",
} as const

/**
 * Report the demo API's observed status, never an assumed one.
 *
 * The demo API runs on scale-to-zero compute, so a wake-up is shown as a
 * wake-up rather than as an outage or as health nobody has checked. This is
 * the same status/retry pair `AppSidebar`'s footer shows on the frozen
 * reference pages, extracted so it can sit in the top bar instead, now that
 * the live Payments pages have no sidebar to hold it.
 */
export function ApiHealthStatus() {
  const health = useApiHealth()
  return (
    <div className="flex items-center gap-2 text-sm">
      <p
        className="flex items-center gap-[7px] text-muted-foreground"
        data-testid="api-health"
        data-status={health.status}
      >
        <span
          className={cn("size-[7px] shrink-0 rounded-full", HEALTH_DOT_COLOURS[health.status])}
          aria-hidden="true"
        />
        {/* The status is text as well as colour, so it survives without colour. */}
        <span>{API_HEALTH_LABELS[health.status]}</span>
      </p>
      {health.status === "unavailable" ? (
        <button
          type="button"
          className="text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={health.recheck}
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
