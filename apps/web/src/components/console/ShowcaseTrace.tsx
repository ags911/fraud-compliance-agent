import { CircleAlert, Database, SkipForward } from 'lucide-react'

import { OutcomeBadge } from '@/components/console/OutcomeBadge'
import { PaymentsStatePanel, PaymentsTonePill } from '@/components/payments-ui'
import type {
  ShowcaseEvidenceItem,
  ShowcaseInvestigationResultEvent,
  ShowcaseInvestigationSkippedEvent,
  ShowcaseRunStartedEvent,
  ShowcaseToolCallEvent,
  ShowcaseToolResultEvent,
} from '@/lib/showcase-types'
import {
  evidenceAnchorId,
  EVIDENCE_CATEGORY_LABELS,
  FAILURE_REASON_LABELS,
  FALLBACK_REASON_LABELS,
  SKIP_REASON_LABELS,
  TOOL_LABELS,
} from '@/lib/showcase-labels'

/**
 * State the execution mode plainly, because a recorded replay and a live model
 * run must never be mistaken for one another. The label always pairs with the
 * reason the requested mode was not used.
 */
export function ShowcaseModeLabel({ runStarted }: { runStarted: ShowcaseRunStartedEvent }) {
  const isLive = runStarted.execution_mode === 'live'
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="showcase-mode">
      <PaymentsTonePill tone={isLive ? 'warning' : 'neutral'}>
        {isLive ? 'Live model run' : 'Recorded playback'}
      </PaymentsTonePill>
      <PaymentsTonePill tone="neutral">Synthetic data</PaymentsTonePill>
      {isLive && runStarted.provider ? (
        <span className="payments-type-support text-muted-foreground">
          {runStarted.provider}
          {runStarted.model_id ? ` · ${runStarted.model_id}` : ''}
        </span>
      ) : null}
      {runStarted.fallback_reason ? (
        <span className="payments-type-support text-muted-foreground">
          {FALLBACK_REASON_LABELS[runStarted.fallback_reason]}
        </span>
      ) : null}
    </div>
  )
}

/** Make a bypassed investigation explicit rather than silently showing nothing. */
export function ShowcaseSkippedTrace({
  skipped,
  message,
}: {
  skipped: ShowcaseInvestigationSkippedEvent
  /** Replaces the skip reason's standard wording, e.g. for a live feed payment. */
  message?: string
}) {
  return (
    <div
      className="flex gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3"
      data-testid="showcase-skipped"
    >
      <SkipForward className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" size={18} strokeWidth={1.6} />
      <div>
        <strong className="payments-type-section-title">Investigation skipped</strong>
        <p className="mt-1 text-sm text-muted-foreground">{message ?? SKIP_REASON_LABELS[skipped.reason]}</p>
      </div>
    </div>
  )
}

function EvidenceRow({ item, showProvenance }: { item: ShowcaseEvidenceItem; showProvenance: boolean }) {
  return (
    <li
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-2 last:border-b-0 target:bg-muted/60"
      id={showProvenance ? evidenceAnchorId(item.evidence_id) : undefined}
    >
      <span className="payments-type-support text-muted-foreground">
        {EVIDENCE_CATEGORY_LABELS[item.category]}
      </span>
      <span className="text-sm">{item.display_value}</span>
      {/* Plaid-derived evidence is scripted Sandbox test data, never a live
          call, but its origin differs from a hand-written synthetic fact and
          is named here rather than left implicit. */}
      {item.source_class === 'plaid_sandbox_derived' ? (
        <PaymentsTonePill tone="neutral">Plaid Sandbox test data</PaymentsTonePill>
      ) : showProvenance ? (
        <PaymentsTonePill tone="neutral">Synthetic fixture</PaymentsTonePill>
      ) : null}
      {/* A saved case records which fixture version produced each item. */}
      {showProvenance ? (
        <span className="payments-type-support text-muted-foreground">Fixture {item.fixture_version}</span>
      ) : null}
      {/* The evidence ID is what claims cite, so it stays visible and checkable. */}
      <code className="payments-type-support text-muted-foreground">{item.evidence_id}</code>
    </li>
  )
}

/**
 * Show each allowlisted tool call with the evidence it returned. Tool calls
 * without a result are shown as called but unanswered, never as evidence.
 */
export function ShowcaseEvidenceTrace({
  toolCalls,
  toolResults,
  showProvenance = false,
}: {
  toolCalls: ShowcaseToolCallEvent[]
  toolResults: ShowcaseToolResultEvent[]
  /** Show every item's source class and fixture version, and anchor it for claim links. */
  showProvenance?: boolean
}) {
  if (toolCalls.length === 0) return null
  return (
    <ol className="grid gap-3" data-testid="showcase-evidence">
      {toolCalls.map((call) => {
        const result = toolResults.find((item) => item.call_index === call.call_index)
        return (
          <li key={call.event_id} className="rounded-xl border border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Database className="shrink-0 text-muted-foreground" aria-hidden="true" size={16} strokeWidth={1.6} />
              <strong className="payments-type-section-title">
                {call.call_index}. {TOOL_LABELS[call.tool_name]}
              </strong>
            </div>
            {result ? (
              <ul className="mt-2">
                {result.evidence.map((item) => (
                  <EvidenceRow key={item.evidence_id} item={item} showProvenance={showProvenance} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No evidence was returned for this call.</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Present the recommendation without ever implying authority or action. An
 * incomplete investigation is shown as incomplete and fail-safe, never as a
 * completed decision.
 */
export function ShowcaseOutcome({
  investigation,
  linkEvidence = false,
  showFailurePanel = true,
}: {
  investigation: ShowcaseInvestigationResultEvent
  /** Link each cited evidence ID to its anchored item (the saved case page). */
  linkEvidence?: boolean
  /** Off where the page already shows its own failure banner. */
  showFailurePanel?: boolean
}) {
  const incomplete = investigation.investigation_status === 'incomplete'
  return (
    <div className="grid gap-3" data-testid="showcase-outcome">
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeBadge outcome={investigation.recommendation} />
        <PaymentsTonePill tone={incomplete ? 'danger' : 'neutral'}>
          {incomplete ? 'Investigation incomplete' : 'Investigation complete'}
        </PaymentsTonePill>
        <PaymentsTonePill tone="neutral">
          {investigation.recommendation_basis === 'fail_safe' ? 'Fail-safe' : 'Evidence-grounded'}
        </PaymentsTonePill>
      </div>
      <p className="text-sm">{investigation.summary}</p>

      {showFailurePanel && incomplete && investigation.failure_reason ? (
        <PaymentsStatePanel
          title="No outcome was decided"
          description={`${FAILURE_REASON_LABELS[investigation.failure_reason]} This is a recommendation to hold, not a completed decision.`}
          tone="danger"
        />
      ) : null}

      {investigation.claims.length > 0 ? (
        <div>
          <strong className="payments-type-section-title">Findings</strong>
          <ul className="mt-2 grid gap-2">
            {investigation.claims.map((claim) => (
              <li key={claim.claim_id} className="rounded-xl border border-border px-4 py-3">
                <p className="text-sm">{claim.text}</p>
                {/* Every visible claim cites evidence returned in this same run. */}
                <p className="payments-type-support mt-1 text-muted-foreground">
                  Cites{' '}
                  {linkEvidence
                    ? claim.evidence_ids.map((evidenceId, index) => (
                        <span key={evidenceId}>
                          {index ? ', ' : null}
                          <a className="underline underline-offset-4" href={`#${evidenceAnchorId(evidenceId)}`}>
                            {evidenceId}
                          </a>
                        </span>
                      ))
                    : claim.evidence_ids.join(', ')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {investigation.uncertainties.length > 0 ? (
        <div>
          <strong className="payments-type-section-title">Uncertainties</strong>
          <ul className="mt-2 grid gap-1">
            {investigation.uncertainties.map((uncertainty) => (
              <li key={uncertainty} className="flex gap-2 text-sm text-muted-foreground">
                <CircleAlert className="mt-0.5 shrink-0" aria-hidden="true" size={15} strokeWidth={1.6} />
                {uncertainty}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="grid gap-1 border-t border-border pt-3">
        <div className="flex justify-between gap-4">
          <dt className="payments-type-support text-muted-foreground">Authority</dt>
          <dd className="payments-type-support">Not evaluated</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="payments-type-support text-muted-foreground">Simulated action</dt>
          <dd className="payments-type-support">None</dd>
        </div>
      </dl>
    </div>
  )
}
