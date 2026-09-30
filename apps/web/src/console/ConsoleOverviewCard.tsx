import { Button } from "@/components/ui/button"
import {
  OVERVIEW_FALLBACK_LABELS,
  OVERVIEW_LIVE_LABEL,
  OVERVIEW_OUT_OF_DATE,
  OVERVIEW_TEMPLATE_LABEL,
  OVERVIEW_UNAVAILABLE,
  overviewNotIncluded,
} from "@/lib/showcase-labels"
import type { ScenarioOverviewState } from "@/lib/useScenarioOverview"

type ConsoleOverviewCardProps = {
  state: ScenarioOverviewState
  /** Set for S06 to S08, which have no payment decisions (AC-1). */
  disabledReason: string | null
  onWrite: () => void
}

/**
 * The Scenario tab's Overview card (spec 0011): a button that asks for a short
 * summary of the figures below, and the result, always labelled with who wrote
 * it. Presentational: the state and the request live in useScenarioOverview.
 */
export function ConsoleOverviewCard({ state, disabledReason, onWrite }: ConsoleOverviewCardProps) {
  const writing = state.status === "writing"
  const outOfDate = state.status === "shown" && state.outOfDate
  const overview = state.status === "shown" ? state.overview : null
  const reason = overview?.fallback_reason ? OVERVIEW_FALLBACK_LABELS[overview.fallback_reason] : null
  const notIncluded = overview ? overviewNotIncluded(overview.included) : null

  return (
    <section aria-labelledby="console-overview-title" className="console-overview" id="console-overview">
      <div className="console-overview-header">
        <div>
          <h2 className="card-title" id="console-overview-title">Overview</h2>
          <p className="card-copy">A short plain summary of the figures on this tab. It never decides or changes anything.</p>
        </div>
        <Button
          className="console-overview-button"
          disabled={writing || disabledReason !== null}
          onClick={onWrite}
          size="sm"
          title={disabledReason ?? undefined}
          variant="outline"
        >
          {writing ? "Writing…" : outOfDate ? "Write again" : "Write overview"}
        </Button>
      </div>
      {/* Polite, so a finished overview is announced without interrupting. */}
      <div aria-live="polite" className="console-overview-body" role="status">
        {disabledReason ? <p className="console-overview-note">{disabledReason}</p> : null}
        {state.status === "unavailable" ? <p className="console-overview-note">{OVERVIEW_UNAVAILABLE}</p> : null}
        {overview ? (
          <>
            {outOfDate ? <p className="console-overview-stale">{OVERVIEW_OUT_OF_DATE}</p> : null}
            <p className="console-overview-headline">{overview.headline}</p>
            <ul className="console-overview-points">
              {overview.points.map((point, index) => <li key={index}>{point}</li>)}
            </ul>
            <p className="console-overview-label">
              {overview.source === "live" && overview.model_id ? OVERVIEW_LIVE_LABEL(overview.model_id) : OVERVIEW_TEMPLATE_LABEL}
            </p>
            {reason ? <p className="console-overview-note">{reason}</p> : null}
            {notIncluded ? <p className="console-overview-note">{notIncluded}</p> : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
