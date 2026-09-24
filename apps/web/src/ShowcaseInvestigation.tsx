import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleHelp, CirclePlay, ShieldCheck } from 'lucide-react'

import { ExplainDecision } from '@/components/console/ExplainDecision'
import { Badge } from '@/components/ui/badge'
import {
  ShowcaseEvidenceTrace,
  ShowcaseModeLabel,
  ShowcaseOutcome,
  ShowcaseSkippedTrace,
} from '@/components/console/ShowcaseTrace'
import {
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsPanel,
  PaymentsStatePanel,
  PaymentsTopBar,
} from '@/components/payments-ui'
import { SectionTabs } from '@/components/section-tabs'
import { showcaseScenarios, toRunnableShowcaseScenario } from '@/lib/showcase-scenarios'
import type { ShowcaseExecutionMode, ShowcaseScenarioId } from '@/lib/showcase-types'
import { useCaseSavedStatus } from '@/lib/useCaseSavedStatus'
import { useShowcaseInvestigation } from '@/lib/useShowcaseInvestigation'
import { useShowcaseInvestigationTour } from '@/lib/useShowcaseInvestigationTour'

/**
 * A bounded, synthetic-only demonstration of the public showcase investigation.
 *
 * It consumes the accepted `POST /showcase/investigations` contract and shows
 * the execution mode, any skipped investigation, the S04 evidence trace, and
 * the S05 failure path. It never approves, releases or executes a payment, and
 * it is a separate surface from the legacy demo workspace.
 */
export function ShowcaseInvestigationPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  // A `?scenario=` link, such as the Overview header's, selects that scenario.
  const [scenarioId, setScenarioId] = useState<ShowcaseScenarioId>(
    () => toRunnableShowcaseScenario(searchParams.get('scenario')) ?? 'S04',
  )
  const [executionMode, setExecutionMode] = useState<ShowcaseExecutionMode>('recorded')
  const investigation = useShowcaseInvestigation()
  const savedStatus = useCaseSavedStatus(
    investigation.status === 'done' ? (investigation.runStarted?.run_id ?? null) : null,
  )

  // The Overview's Run hands off here with `autoRun` in navigation state. It
  // always runs as recorded playback, and the state is cleared at once so a
  // reload or Back does not start another run. A repeat before the clear lands
  // (React's development double-mount) aborts and replaces the first run, so
  // only one result is ever shown.
  const { start } = investigation
  useEffect(() => {
    const autoRun = (location.state as { autoRun?: unknown } | null)?.autoRun === true
    if (!autoRun) return
    void start(scenarioId, 'recorded')
    navigate({ search: location.search }, { replace: true, state: null })
  }, [location.search, location.state, navigate, scenarioId, start])
  const tour = useShowcaseInvestigationTour()
  const running = investigation.status === 'running'

  return (
    <>
      <PaymentsTopBar demoSession={false} searchPlaceholder="Search is unavailable while running a demo scenario" showSidebarTrigger={false} />
      <PaymentsPageMain>
        <PaymentsPageHeading
          title="Showcase investigation"
          description="Run one bounded synthetic scenario and inspect how evidence, recommendation and oversight stay separate."
          actions={
            <button className="payments-button" type="button" onClick={tour.start}>
              <CircleHelp aria-hidden="true" size={16} strokeWidth={1.6} />
              Tour this workspace
            </button>
          }
        />
        <SectionTabs />

        <section
          className="mt-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4"
          aria-label="Synthetic investigation boundary"
        >
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-primary" aria-hidden="true" size={18} strokeWidth={1.6} />
            <div>
              <strong className="payments-type-section-title">Synthetic investigation</strong>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Every scenario, evidence item and recommendation is synthetic fixture data. The agent can recommend; it
                cannot decide authority, approve, release or execute a payment.
              </p>
            </div>
          </div>
          <span className="payments-type-support whitespace-nowrap text-muted-foreground">Demo data only</span>
        </section>

        <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <PaymentsPanel
            id="showcase-scenario-controls"
            title="Scenario"
            description="Pick a synthetic path, then run it."
            labelledBy="showcase-scenario-heading"
          >
            <fieldset className="grid gap-2 border-0 p-0">
              <legend className="payments-type-support mb-1 text-muted-foreground">Synthetic scenario</legend>
              {showcaseScenarios.map((scenario) => (
                <label
                  key={scenario.id}
                  className="flex cursor-pointer gap-3 rounded-xl border border-border px-4 py-3 has-[:checked]:border-primary"
                >
                  <input
                    type="radio"
                    name="showcase-scenario"
                    value={scenario.id}
                    checked={scenarioId === scenario.id}
                    onChange={() => setScenarioId(scenario.id)}
                    className="mt-1 shrink-0"
                  />
                  <span>
                    <strong className="payments-type-section-title">{scenario.label}</strong>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{scenario.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="mt-4 grid gap-2 border-0 p-0">
              <legend className="payments-type-support mb-1 text-muted-foreground">Execution mode</legend>
              {/* Requesting live never guarantees live: the server falls back to
                  clearly labelled recorded playback whenever its controls say so. */}
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="showcase-mode"
                  value="recorded"
                  checked={executionMode === 'recorded'}
                  onChange={() => setExecutionMode('recorded')}
                />
                Recorded playback
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="showcase-mode"
                  value="live"
                  checked={executionMode === 'live'}
                  onChange={() => setExecutionMode('live')}
                />
                Request live run
              </label>
              <p className="payments-type-support text-muted-foreground">
                Live mode is off by default. When it is unavailable, the run falls back to recorded playback and says so.
              </p>
            </fieldset>

            <div className="mt-4 flex gap-2">
              <button
                className="payments-button"
                data-emphasis="primary"
                type="button"
                onClick={() => void investigation.start(scenarioId, executionMode)}
                disabled={running}
              >
                <CirclePlay aria-hidden="true" size={16} strokeWidth={1.6} />
                {running ? 'Running…' : 'Run investigation'}
              </button>
              {running ? (
                <button className="payments-button" type="button" onClick={investigation.cancel}>
                  Cancel
                </button>
              ) : null}
            </div>
          </PaymentsPanel>

          <PaymentsPanel
            id="showcase-trace"
            title="Investigation trace"
            description="Execution mode, evidence and recommendation for the selected scenario."
            labelledBy="showcase-trace-heading"
          >
            <div aria-live="polite" className="grid gap-4">
              {investigation.status === 'idle' ? (
                <PaymentsStatePanel
                  title="No investigation has run"
                  description="Choose a synthetic scenario and run it to see its trace."
                />
              ) : null}

              {investigation.status === 'error' && investigation.error ? (
                <PaymentsStatePanel
                  title="The investigation could not run"
                  description={investigation.error}
                  tone="danger"
                />
              ) : null}

              {investigation.status === 'cancelled' ? (
                <PaymentsStatePanel
                  title="Investigation cancelled"
                  description="The run was stopped before it finished. No outcome is being reported."
                />
              ) : null}

              {investigation.runStarted ? <ShowcaseModeLabel runStarted={investigation.runStarted} /> : null}
              {investigation.skipped ? <ShowcaseSkippedTrace skipped={investigation.skipped} /> : null}
              <ShowcaseEvidenceTrace
                toolCalls={investigation.toolCalls}
                toolResults={investigation.toolResults}
              />
              {investigation.investigation ? (
                <ShowcaseOutcome investigation={investigation.investigation} />
              ) : null}

              {/* A deterministic bypass has no investigation_result event, so the
                  run_result is what carries its recommendation. */}
              {investigation.runResult && !investigation.investigation ? (
                <p className="text-sm" data-testid="showcase-run-result">
                  Deterministic recommendation: <strong>{investigation.runResult.recommendation}</strong>. Authority not
                  evaluated, no simulated action.
                </p>
              ) : null}

              {/* Whether this finished run was saved as a durable case (spec 0002). */}
              {savedStatus && savedStatus !== 'checking' && investigation.runStarted ? (
                <p className="text-sm text-muted-foreground" data-testid="showcase-case-saved">
                  {savedStatus === 'saved' ? (
                    <>
                      Saved ·{' '}
                      <a className="underline underline-offset-4" href={`/transactions/${investigation.runStarted.run_id}`}>
                        Open case
                      </a>
                    </>
                  ) : savedStatus === 'not_saved' ? (
                    'Not saved.'
                  ) : (
                    'Not saved: case history is off in this environment.'
                  )}
                </p>
              ) : null}
            </div>
          </PaymentsPanel>
        </div>

        <PaymentsPanel
          title="Explain this decision"
          description="A preview that answers only from this run's own events, and names the source of each answer."
          labelledBy="showcase-explain-heading"
          action={<Badge variant="outline">Preview</Badge>}
        >
          <ExplainDecision
            key={investigation.runStarted?.run_id ?? `showcase-${investigation.status}`}
            run={investigation}
          />
        </PaymentsPanel>
      </PaymentsPageMain>
    </>
  )
}
