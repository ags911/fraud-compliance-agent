import { CircleAlert, Database, SkipForward } from 'lucide-react'

import { OutcomeBadge } from '@/components/console/OutcomeBadge'
import { PaymentsStatePanel, PaymentsTonePill } from '@/components/payments-ui'
import type {
  ShowcaseEvidenceCategory,
  ShowcaseEvidenceItem,
  ShowcaseFailureReason,
  ShowcaseInvestigationResultEvent,
  ShowcaseInvestigationSkippedEvent,
  ShowcaseRunStartedEvent,
  ShowcaseSkipReason,
  ShowcaseToolCallEvent,
  ShowcaseToolName,
  ShowcaseToolResultEvent,
} from '@/lib/showcase-types'

const TOOL_LABELS: Record<ShowcaseToolName, string> = {
  get_payee_evidence: 'Payee evidence',
  get_account_activity_evidence: 'Account activity evidence',
  get_device_session_evidence: 'Device session evidence',
}

const EVIDENCE_CATEGORY_LABELS: Record<ShowcaseEvidenceCategory, string> = {
  payee_relationship: 'Payee relationship',
  payee_name_match: 'Payee name match',
  account_balance_impact: 'Account balance impact',
  payment_velocity: 'Payment velocity',
  recent_credit_context: 'Recent credit context',
  device_familiarity: 'Device familiarity',
  session_change: 'Session change',
  location_channel_context: 'Location and channel context',
}

const SKIP_REASON_LABELS: Record<ShowcaseSkipReason, string> = {
  deterministic_clear_route: 'A deterministic clear route resolved this payment, so no agent ran.',
  hard_deterministic_control: 'A hard deterministic control resolved this payment, so no agent ran.',
  hard_app_control: 'A hard authorised-push-payment control resolved this payment, so no agent ran.',
  existing_recorded_recommendation: 'An existing recorded recommendation applies, so no agent ran.',
  non_investigation_scenario: 'This scenario is not an investigation path, so no agent ran.',
}

const FAILURE_REASON_LABELS: Record<ShowcaseFailureReason, string> = {
  provider_unavailable: 'The provider was unavailable.',
  tool_failed: 'An evidence tool returned no accepted result.',
  invalid_output: 'The agent returned output that failed validation.',
  timeout: 'The investigation passed its time limit.',
  tool_budget_exhausted: 'The investigation exhausted its tool budget.',
}

const FALLBACK_REASON_LABELS = {
  live_disabled: 'Live mode is switched off, so this is recorded playback.',
  admission_limited: 'The live demonstration limit was reached, so this is recorded playback.',
  provider_unavailable: 'The live provider was unavailable, so this is recorded playback.',
} as const

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
}: {
  skipped: ShowcaseInvestigationSkippedEvent
}) {
  return (
    <div
      className="flex gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3"
      data-testid="showcase-skipped"
    >
      <SkipForward className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" size={18} strokeWidth={1.6} />
      <div>
        <strong className="payments-type-section-title">Investigation skipped</strong>
        <p className="mt-1 text-sm text-muted-foreground">{SKIP_REASON_LABELS[skipped.reason]}</p>
      </div>
    </div>
  )
}

function EvidenceRow({ item }: { item: ShowcaseEvidenceItem }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-2 last:border-b-0">
      <span className="payments-type-support text-muted-foreground">
        {EVIDENCE_CATEGORY_LABELS[item.category]}
      </span>
      <span className="text-sm">{item.display_value}</span>
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
}: {
  toolCalls: ShowcaseToolCallEvent[]
  toolResults: ShowcaseToolResultEvent[]
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
                  <EvidenceRow key={item.evidence_id} item={item} />
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
}: {
  investigation: ShowcaseInvestigationResultEvent
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

      {incomplete && investigation.failure_reason ? (
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
                  Cites {claim.evidence_ids.join(', ')}
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
