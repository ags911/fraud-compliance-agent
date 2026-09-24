import { useEffect, useRef, type MouseEvent, type ReactNode } from "react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { ShowcaseStoredEvent } from "@/lib/showcase-cases"
import { readShowcaseCase } from "@/lib/showcase-case-view"
import {
  ELIGIBILITY_LABELS,
  EVIDENCE_CATEGORY_LABELS,
  evidenceAnchorId,
  FAILURE_REASON_LABELS,
  FALLBACK_REASON_LABELS,
  FEED_CARRIED_ROUTE_COPY,
  FEED_SOURCE_LABEL,
  INVESTIGATION_LABELS,
  MODEL_SIGNAL_NOTE,
  MODEL_SIGNAL_UNSCORED,
  SKIP_REASON_LABELS,
  TOOL_LABELS,
} from "@/lib/showcase-labels"
import type { ShowcaseCaseState } from "@/lib/useShowcaseCase"

import { recommendationPillClass } from "./radar-pills"

type RadarCaseDrawerProps = {
  /** The case in `?case=`; null keeps the drawer closed. */
  caseId: string | null
  state: ShowcaseCaseState
  onRetry: () => void
  onClose: () => void
}

function formatTime(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, HH:mm:ss")
}

/**
 * Radar's case drawer (spec 0002): one saved case over the Cases tab, so the
 * table, filters and totals stay in place behind it. Built on shadcn's Sheet
 * (Radix Dialog), which traps focus and closes on Escape; on phones it fills
 * the screen. Closing returns focus to the case's Run ID link in the table.
 */
export function RadarCaseDrawer({ caseId, state, onRetry, onClose }: RadarCaseDrawerProps) {
  // The last opened case, so focus can return to its row after it closes.
  const lastCaseId = useRef<string | null>(null)
  useEffect(() => {
    if (caseId) lastCaseId.current = caseId
  }, [caseId])

  return (
    <Sheet open={caseId !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent
        className="radar-case-drawer"
        side="right"
        onCloseAutoFocus={(event) => {
          const link = document.querySelector<HTMLElement>(`[data-case-link="${lastCaseId.current}"]`)
          if (link) {
            event.preventDefault()
            link.focus()
          }
        }}
      >
        {state.status === "found" ? (
          <CaseBody state={state} />
        ) : (
          <>
            <SheetHeader className="case-drawer-header">
              <SheetTitle className="case-drawer-title">Case</SheetTitle>
              <SheetDescription className="case-drawer-sub">{caseId}</SheetDescription>
            </SheetHeader>
            <div className="case-drawer-body" aria-live="polite">
              {state.status === "loading" ? (
                <DrawerState title="Loading case" copy="Reading the saved run." />
              ) : state.status === "not_found" ? (
                <DrawerState
                  title="Case not found"
                  copy="This case doesn't exist, has expired, or was saved in a different browser. Saved cases stay in the browser that ran them for 30 days."
                />
              ) : state.status === "unavailable" ? (
                <DrawerState title="Case history is off" copy="Saved cases aren't available in this environment." />
              ) : (
                <DrawerState title="The case couldn't be loaded" copy="Something went wrong reading this case. Try again in a moment." alert>
                  <Button size="sm" onClick={onRetry}>Try again</Button>
                </DrawerState>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DrawerState({ title, copy, alert, children }: { title: string; copy: string; alert?: boolean; children?: ReactNode }) {
  return (
    <section className="empty-card" role={alert ? "alert" : undefined}>
      <div className="card-title">{title}</div>
      <p className="card-copy">{copy}</p>
      {children}
    </section>
  )
}

function CaseBody({ state }: { state: Extract<ShowcaseCaseState, { status: "found" }> }) {
  const { detail } = state
  const summary = detail.case
  const view = readShowcaseCase(detail)
  const { runStarted, route, skipped, toolCalls, toolResults, investigation } = view
  const incomplete = summary.investigation_status === "incomplete"
  const isFeed = summary.origin === "feed"

  return (
    <>
      <SheetHeader className="case-drawer-header">
        <SheetTitle className="case-drawer-title">
          {summary.scenario_id} · <span className={`risk-pill ${recommendationPillClass(summary.recommendation)}`}>{summary.recommendation}</span>
        </SheetTitle>
        <SheetDescription className="case-drawer-sub">
          <span className="td-mono">{summary.case_id}</span> · Synthetic data: no payment was executed and no runtime model score was used.
        </SheetDescription>
      </SheetHeader>

      <div className="case-drawer-body">
        {incomplete ? (
          // Never worded or styled as a completed investigation (AC-12).
          <section className="case-banner" data-testid="case-failure-banner" role="alert">
            <div className="case-banner-title">Investigation incomplete: fail safe HOLD</div>
            <p>
              {summary.failure_reason ? `${FAILURE_REASON_LABELS[summary.failure_reason]} ` : null}
              {investigation?.summary}
            </p>
            <p className="td-secondary">The recommendation defaults to HOLD. Authority was not evaluated and no action was simulated.</p>
          </section>
        ) : null}

        <dl className="case-facts">
          <Fact label="Deterministic route">{summary.deterministic_route}</Fact>
          <Fact label="Investigation">{INVESTIGATION_LABELS[summary.investigation_status]}</Fact>
          <Fact label="Mode">
            <span className="case-pills">
              <span className="radar-source-pill">
                {isFeed ? FEED_SOURCE_LABEL : summary.execution_mode === "live" ? "Live model run" : "Recorded playback"}
              </span>
              <span className="radar-source-pill">Synthetic data</span>
            </span>
            {summary.execution_mode === "live" && summary.provider ? (
              <span className="td-secondary"> {summary.provider}{summary.model_id ? ` · ${summary.model_id}` : ""}</span>
            ) : null}
            {runStarted?.fallback_reason ? (
              <span className="case-fact-note">{FALLBACK_REASON_LABELS[runStarted.fallback_reason]}</span>
            ) : null}
          </Fact>
          <Fact label="Started">{formatTime(summary.started_at)}</Fact>
          <Fact label="Completed">{formatTime(summary.completed_at)}</Fact>
        </dl>

        <Stage title="Route" sub="The deterministic controls, before any agent runs." testId="case-stage-route" events={view.stageEvents.route}>
          <dl className="case-facts">
            <Fact label="Deterministic route">{route?.deterministic_route ?? summary.deterministic_route}</Fact>
            <Fact label="Investigation eligibility">{route ? ELIGIBILITY_LABELS[route.investigation_eligibility] : "Not recorded"}</Fact>
          </dl>
          {skipped ? (
            <p className="card-copy">
              {/* An S04 or S05 feed payment carries its scenario's recorded outcome (spec 0004). */}
              {isFeed && skipped.reason === "existing_recorded_recommendation"
                ? FEED_CARRIED_ROUTE_COPY
                : `Investigation skipped. ${SKIP_REASON_LABELS[skipped.reason]}`}
            </p>
          ) : null}
        </Stage>

        <Stage title="Evidence" sub="Each allowlisted tool call and the evidence it returned." testId="case-stage-evidence" events={view.stageEvents.evidence}>
          {isFeed ? (
            <dl className="case-facts" data-testid="case-model-signal">
              <Fact label="Model signal">
                {summary.model_score === null ? (
                  MODEL_SIGNAL_UNSCORED
                ) : (
                  <>
                    {summary.model_score.toFixed(3)}
                    {summary.model_version ? <span className="td-secondary"> · {summary.model_version}</span> : null}
                    <span className="case-fact-note">{MODEL_SIGNAL_NOTE}</span>
                  </>
                )}
              </Fact>
            </dl>
          ) : null}
          {skipped ? (
            <p className="card-copy">No evidence was gathered, because the investigation was skipped.</p>
          ) : toolCalls.length ? (
            <ol className="case-evidence">
              {toolCalls.map((call) => {
                const result = toolResults.find((item) => item.call_index === call.call_index)
                return (
                  <li key={call.event_id}>
                    <div className="case-evidence-tool">{call.call_index}. {TOOL_LABELS[call.tool_name]}</div>
                    {result ? (
                      <ul>
                        {result.evidence.map((item) => (
                          <li className="case-evidence-item" id={evidenceAnchorId(item.evidence_id)} key={item.evidence_id} tabIndex={-1}>
                            <span className="td-secondary">{EVIDENCE_CATEGORY_LABELS[item.category]}</span>
                            <span>{item.display_value}</span>
                            <span className="case-pills">
                              <span className="radar-source-pill">
                                {item.source_class === "plaid_sandbox_derived" ? "Plaid Sandbox test data" : "Synthetic fixture"}
                              </span>
                              <span className="td-tertiary">Fixture {item.fixture_version}</span>
                              <code className="td-mono">{item.evidence_id}</code>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="card-copy">No evidence was returned for this call.</p>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="card-copy">No evidence tool was called.</p>
          )}
        </Stage>

        <Stage title="Outcome" sub="The recommendation, the claims behind it, and what was not decided." testId="case-stage-outcome" events={view.stageEvents.outcome}>
          {investigation ? (
            <>
              <div className="case-pills">
                <span className={`risk-pill ${recommendationPillClass(investigation.recommendation)}`}>{investigation.recommendation}</span>
                <span className="radar-source-pill">{incomplete ? "Investigation incomplete" : "Investigation complete"}</span>
                <span className="radar-source-pill">{investigation.recommendation_basis === "fail_safe" ? "Fail-safe" : "Evidence-grounded"}</span>
              </div>
              <p className="card-copy">{investigation.summary}</p>
              {investigation.claims.length ? (
                <ul className="case-claims">
                  {investigation.claims.map((claim) => (
                    <li key={claim.claim_id}>
                      <p>{claim.text}</p>
                      <p className="td-tertiary">
                        Cites{" "}
                        {claim.evidence_ids.map((evidenceId, index) => (
                          <span key={evidenceId}>
                            {index ? ", " : null}
                            <a className="case-link" href={`#${evidenceAnchorId(evidenceId)}`} onClick={jumpToEvidence(evidenceId)}>
                              {evidenceId}
                            </a>
                          </span>
                        ))}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {investigation.uncertainties.length ? (
                <ul className="case-uncertainties">
                  {investigation.uncertainties.map((uncertainty) => <li key={uncertainty}>{uncertainty}</li>)}
                </ul>
              ) : null}
            </>
          ) : (
            // A deterministic bypass has no investigation_result; run_result carries it.
            <p className="card-copy">Deterministic recommendation: <strong>{summary.recommendation}</strong>.</p>
          )}
          <dl className="case-facts">
            <Fact label="Authority">Not evaluated</Fact>
            <Fact label="Simulated action">None</Fact>
          </dl>
        </Stage>
      </div>
    </>
  )
}

/**
 * Scroll to the cited evidence in the drawer without a hash navigation, which
 * would add a history entry and make Back step through links instead of
 * closing the drawer.
 */
function jumpToEvidence(evidenceId: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(evidenceAnchorId(evidenceId))
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ block: "center", behavior: "smooth" })
    target.focus({ preventScroll: true })
  }
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="case-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Stage({
  title,
  sub,
  testId,
  events,
  children,
}: {
  title: string
  sub: string
  testId: string
  events: readonly ShowcaseStoredEvent[]
  children: ReactNode
}) {
  return (
    <section className="case-stage" data-testid={testId}>
      <div className="case-stage-header">
        <div className="card-title">{title}</div>
        <div className="section-sub">{sub}</div>
      </div>
      <div className="case-stage-body">
        {children}
        {events.length ? (
          <details className="case-events">
            <summary>Stored events ({events.length})</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>#</th><th>Event</th><th>Event ID</th><th>Recorded</th></tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.event_id}>
                      <td className="td-secondary">{event.sequence}</td>
                      <td>{event.event_type}</td>
                      <td className="td-mono">{event.event_id}</td>
                      <td className="td-secondary">{formatTime(event.recorded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  )
}
