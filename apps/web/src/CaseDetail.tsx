import type { ReactNode } from "react"
import { format } from "date-fns"
import { useParams } from "react-router-dom"

import { OutcomeBadge } from "@/components/console/OutcomeBadge"
import { ShowcaseModeLabel } from "@/components/console/ShowcaseTrace"
import {
  PaymentsButton,
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsPanel,
  PaymentsStatePanel,
  PaymentsTablePanel,
  PaymentsTopBar,
} from "@/components/payments-ui"
import type { ShowcaseCaseDetail } from "@/lib/showcase-cases"
import type { ShowcaseRunStartedEvent } from "@/lib/showcase-types"
import { useShowcaseCase } from "@/lib/useShowcaseCase"

/**
 * /transactions/:caseId: one durable showcase case (spec 0002, slice 1).
 *
 * This first slice shows the outcome summary and the stored events as a plain
 * list; the grouped Route / Evidence / Outcome stages, evidence and claim
 * links, and the failure banner arrive in slice 3.
 */

// Same "d MMM" style as the Radar charts (Intl en-GB would print "Sept").
function formatTime(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, HH:mm:ss")
}

const INVESTIGATION_LABELS = {
  skipped: "Not needed (deterministic route)",
  complete: "Completed",
  incomplete: "Incomplete",
} as const

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
  // The stored run_started event is exactly the accepted payload the live trace
  // renders, so the same mode label (recorded vs live, fallback reason) is reused.
  const runStarted = detail.events.find((event) => event.event_type === "run_started")
    ?.payload as ShowcaseRunStartedEvent | undefined

  return (
    <>
      <PaymentsPageHeading
        title={`${summary.scenario_id} · ${summary.recommendation}`}
        description={`Saved case ${summary.case_id}. Synthetic data: no payment was executed and no runtime model score was used.`}
        actions={<BackToRadar />}
      />
      <div className="grid gap-4">
        <PaymentsPanel title="Outcome" description="The final recommendation and how it was reached.">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Recommendation">
              <OutcomeBadge outcome={summary.recommendation} />
            </Field>
            <Field label="Deterministic route">{summary.deterministic_route}</Field>
            <Field label="Investigation">{INVESTIGATION_LABELS[summary.investigation_status]}</Field>
            <Field label="Mode">
              {runStarted ? <ShowcaseModeLabel runStarted={runStarted} /> : summary.execution_mode}
            </Field>
            <Field label="Started">{formatTime(summary.started_at)}</Field>
            <Field label="Completed">{formatTime(summary.completed_at)}</Field>
          </dl>
        </PaymentsPanel>

        <PaymentsPanel
          title="Audit trail"
          description={`Every stored event for this run, in order (${summary.event_count}).`}
        >
          <PaymentsTablePanel>
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
                {detail.events.map((event) => (
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
        </PaymentsPanel>
      </div>
    </>
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
