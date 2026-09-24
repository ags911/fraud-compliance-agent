import type { ReactNode } from "react"
import { format } from "date-fns"
import { CircleAlert } from "lucide-react"
import { useParams } from "react-router-dom"

import { OutcomeBadge } from "@/components/console/OutcomeBadge"
import {
  ShowcaseEvidenceTrace,
  ShowcaseModeLabel,
  ShowcaseOutcome,
  ShowcaseSkippedTrace,
} from "@/components/console/ShowcaseTrace"
import {
  PaymentsButton,
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsPanel,
  PaymentsStatePanel,
  PaymentsTablePanel,
  PaymentsTonePill,
  PaymentsTopBar,
} from "@/components/payments-ui"
import type { ShowcaseCaseDetail, ShowcaseStoredEvent } from "@/lib/showcase-cases"
import {
  ELIGIBILITY_LABELS,
  FAILURE_REASON_LABELS,
  FEED_CARRIED_ROUTE_COPY,
  FEED_SOURCE_LABEL,
  INVESTIGATION_LABELS,
  MODEL_SIGNAL_NOTE,
  MODEL_SIGNAL_UNSCORED,
} from "@/lib/showcase-labels"
import { readShowcaseCase } from "@/lib/showcase-case-view"
import { useShowcaseCase } from "@/lib/useShowcaseCase"

/**
 * /transactions/:caseId: one durable showcase case (spec 0002).
 *
 * A summary header, a failure banner for incomplete investigations, then the
 * Route, Evidence and Outcome stages, each expandable to its stored events.
 */

// Same "d MMM" style as the Radar charts (Intl en-GB would print "Sept").
function formatTime(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, HH:mm:ss")
}


function BackToRadar() {
  return (
    <a className="payments-button inline-flex" href="/radar">
      Back to Radar
    </a>
  )
}

export function CaseDetailPage() {
  const { caseId } = useParams()
  const { state, retry } = useShowcaseCase(caseId)

  return (
    <>
      <PaymentsTopBar demoSession={false} showSidebarTrigger={false} />
      <PaymentsPageMain>
        {state.status === "found" ? (
          <CaseDetailView detail={state.detail} />
        ) : (
          <>
            <PaymentsPageHeading
              title="Case"
              description="A saved synthetic showcase run from this browser."
              actions={<BackToRadar />}
            />
            {state.status === "loading" ? (
              <PaymentsStatePanel aria-live="polite" title="Loading case" description="Reading the saved run." />
            ) : state.status === "not_found" ? (
              <PaymentsStatePanel
                title="Case not found"
                description="This case doesn't exist, has expired, or was saved in a different browser. Saved cases stay in the browser that ran them for 30 days."
              />
            ) : state.status === "unavailable" ? (
              <PaymentsStatePanel
                title="Case history is off"
                description="Saved cases aren't available in this environment, so this page can't show one."
              />
            ) : (
              <div className="grid gap-3">
                <PaymentsStatePanel
                  tone="danger"
                  role="alert"
                  title="The case couldn't be loaded"
                  description="Something went wrong reading this case. Try again in a moment."
                />
                <PaymentsButton className="w-fit" onClick={retry}>
                  Try again
                </PaymentsButton>
              </div>
            )}
          </>
        )}
      </PaymentsPageMain>
    </>
  )
}

function CaseDetailView({ detail }: { detail: ShowcaseCaseDetail }) {
  const summary = detail.case
  const { runStarted, route, skipped, toolCalls, toolResults, investigation, stageEvents } = readShowcaseCase(detail)
  const incomplete = summary.investigation_status === "incomplete"
  const isFeed = summary.origin === "feed"

  return (
    <>
      <PaymentsPageHeading
        title={`${summary.scenario_id} · ${summary.recommendation}`}
        description={`Saved case ${summary.case_id}. Synthetic data: no payment was executed and no runtime model score was used.`}
        actions={<BackToRadar />}
      />
      <div className="grid gap-4">
        {incomplete ? (
          // Never worded or styled as a completed investigation (AC-12).
          <div
            className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3"
            data-testid="case-failure-banner"
            role="alert"
          >
            <CircleAlert className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" size={18} strokeWidth={1.6} />
            <div>
              <strong className="payments-type-section-title text-destructive">
                Investigation incomplete: fail safe HOLD
              </strong>
              <p className="mt-1 text-sm">
                {summary.failure_reason ? `${FAILURE_REASON_LABELS[summary.failure_reason]} ` : null}
                {investigation?.summary}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The recommendation defaults to HOLD. Authority was not evaluated and no action was simulated.
              </p>
            </div>
          </div>
        ) : null}

        <PaymentsPanel title="Summary" description="The final recommendation and how it was reached.">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Recommendation">
              <OutcomeBadge outcome={summary.recommendation} />
            </Field>
            <Field label="Deterministic route">{summary.deterministic_route}</Field>
            <Field label="Investigation">{INVESTIGATION_LABELS[summary.investigation_status]}</Field>
            <Field label="Mode">
              {isFeed ? (
                // A live feed payment decided by its scenario's rule (spec 0004).
                <div className="flex flex-wrap items-center gap-2" data-testid="showcase-mode">
                  <PaymentsTonePill tone="neutral">{FEED_SOURCE_LABEL}</PaymentsTonePill>
                  <PaymentsTonePill tone="neutral">Synthetic data</PaymentsTonePill>
                </div>
              ) : runStarted ? (
                <ShowcaseModeLabel runStarted={runStarted} />
              ) : (
                summary.execution_mode
              )}
            </Field>
            <Field label="Started">{formatTime(summary.started_at)}</Field>
            <Field label="Completed">{formatTime(summary.completed_at)}</Field>
          </dl>
        </PaymentsPanel>

        <PaymentsPanel title="Route" description="The deterministic controls, before any agent runs.">
          <div className="grid gap-3" data-testid="case-stage-route">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Field label="Deterministic route">{route?.deterministic_route ?? summary.deterministic_route}</Field>
              <Field label="Investigation eligibility">
                {route ? ELIGIBILITY_LABELS[route.investigation_eligibility] : "Not recorded"}
              </Field>
            </dl>
            {skipped ? (
              <ShowcaseSkippedTrace
                message={isFeed && skipped.reason === "existing_recorded_recommendation" ? FEED_CARRIED_ROUTE_COPY : undefined}
                skipped={skipped}
              />
            ) : null}
            <StoredEvents events={stageEvents.route} />
          </div>
        </PaymentsPanel>

        <PaymentsPanel title="Evidence" description="Each allowlisted tool call and the evidence it returned.">
          <div className="grid gap-3" data-testid="case-stage-evidence">
            {isFeed ? (
              <dl data-testid="case-model-signal">
                <Field label="Model signal">
                  {summary.model_score === null ? (
                    MODEL_SIGNAL_UNSCORED
                  ) : (
                    <>
                      {summary.model_score.toFixed(3)}
                      {summary.model_version ? ` · ${summary.model_version}` : null}
                      <span className="block text-sm text-muted-foreground">{MODEL_SIGNAL_NOTE}</span>
                    </>
                  )}
                </Field>
              </dl>
            ) : null}
            {skipped ? (
              <p className="text-sm text-muted-foreground">No evidence was gathered, because the investigation was skipped.</p>
            ) : toolCalls.length ? (
              <ShowcaseEvidenceTrace showProvenance toolCalls={toolCalls} toolResults={toolResults} />
            ) : (
              <p className="text-sm text-muted-foreground">No evidence tool was called.</p>
            )}
            <StoredEvents events={stageEvents.evidence} />
          </div>
        </PaymentsPanel>

        <PaymentsPanel title="Outcome" description="The recommendation, the claims behind it, and what was not decided.">
          <div className="grid gap-3" data-testid="case-stage-outcome">
            {investigation ? (
              <ShowcaseOutcome investigation={investigation} linkEvidence showFailurePanel={false} />
            ) : (
              // A deterministic bypass has no investigation_result; run_result carries it.
              <p className="text-sm">
                Deterministic recommendation: <strong>{summary.recommendation}</strong>. Authority not evaluated, no
                simulated action.
              </p>
            )}
            <StoredEvents events={stageEvents.outcome} />
          </div>
        </PaymentsPanel>
      </div>
    </>
  )
}

/** One stage's exact stored events, collapsed by default (AC-11). */
function StoredEvents({ events }: { events: readonly ShowcaseStoredEvent[] }) {
  if (!events.length) return null
  return (
    <details className="group">
      <summary className="payments-type-support cursor-pointer text-muted-foreground">
        Stored events ({events.length})
      </summary>
      <PaymentsTablePanel className="mt-2">
        <table className="w-full payments-type-data">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Event ID</th>
              <th className="px-3 py-2 font-medium">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr className="border-t border-border" key={event.event_id}>
                <td className="px-3 py-2 tabular-nums">{event.sequence}</td>
                <td className="px-3 py-2">{event.event_type}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{event.event_id}</td>
                <td className="px-3 py-2 tabular-nums">{formatTime(event.recorded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PaymentsTablePanel>
    </details>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="payments-type-metric-label text-muted-foreground">{label}</dt>
      <dd className="payments-type-body">{children}</dd>
    </div>
  )
}
