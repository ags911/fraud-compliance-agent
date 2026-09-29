import type {
  ShowcaseEvidenceCategory,
  ShowcaseFailureReason,
  ShowcaseSkipReason,
  ShowcaseToolName,
} from '@/lib/showcase-types'

// Plain wording for showcase events, shared by the live trace, the case page
// and Risk Console's case drawer, so each says the same thing.

export const FAILURE_REASON_LABELS: Record<ShowcaseFailureReason, string> = {
  provider_unavailable: 'The provider was unavailable.',
  tool_failed: 'An evidence tool returned no accepted result.',
  invalid_output: 'The agent returned output that failed validation.',
  timeout: 'The investigation passed its time limit.',
  tool_budget_exhausted: 'The investigation exhausted its tool budget.',
}

/** Anchor ID for one evidence item, so a claim can link to what it cites. */
export function evidenceAnchorId(evidenceId: string): string {
  return `evidence-${evidenceId}`
}

export const TOOL_LABELS: Record<ShowcaseToolName, string> = {
  get_payee_evidence: 'Payee evidence',
  get_account_activity_evidence: 'Account activity evidence',
  get_device_session_evidence: 'Device session evidence',
}

export const EVIDENCE_CATEGORY_LABELS: Record<ShowcaseEvidenceCategory, string> = {
  payee_relationship: 'Payee relationship',
  payee_name_match: 'Payee name match',
  account_balance_impact: 'Account balance impact',
  payment_velocity: 'Payment velocity',
  recent_credit_context: 'Recent credit context',
  device_familiarity: 'Device familiarity',
  session_change: 'Session change',
  location_channel_context: 'Location and channel context',
}

export const SKIP_REASON_LABELS: Record<ShowcaseSkipReason, string> = {
  deterministic_clear_route: 'A deterministic clear route resolved this payment, so no agent ran.',
  hard_deterministic_control: 'A hard deterministic control resolved this payment, so no agent ran.',
  hard_app_control: 'A hard authorised-push-payment control resolved this payment, so no agent ran.',
  existing_recorded_recommendation: 'An existing recorded recommendation applies, so no agent ran.',
  non_investigation_scenario: 'This scenario is not an investigation path, so no agent ran.',
}

export const FALLBACK_REASON_LABELS = {
  live_disabled: 'Live mode is switched off, so this is recorded playback.',
  admission_limited: 'The live demonstration limit was reached, so this is recorded playback.',
  provider_unavailable: 'The live provider was unavailable, so this is recorded playback.',
} as const

export const ELIGIBILITY_LABELS = {
  skipped: 'Not eligible: resolved by the deterministic route',
  eligible: 'Eligible for investigation',
  eligible_failure_test: 'Eligible (failure test path)',
} as const

export const INVESTIGATION_LABELS = {
  skipped: 'Not needed (deterministic route)',
  complete: 'Completed',
  incomplete: 'Incomplete',
} as const

// Live feed cases (spec 0004): a payment decided by its scenario's rule, with
// no agent run and no investigation of its own.
export const FEED_SOURCE_LABEL = 'Live feed'

/** Route stage copy for an S04 or S05 feed payment, which carries a recorded run's recommendation. */
export const FEED_CARRIED_ROUTE_COPY =
  "Carried from the scenario's recorded investigation; no agent ran for this payment."

export const MODEL_SIGNAL_UNSCORED = 'Not scored yet'

export const MODEL_SIGNAL_NOTE =
  'Trained on Sparkov synthetic data. A mechanics demo, not a fraud probability. It does not decide.'

// Score routing (spec 0010): the model may raise a payment its rule cleared.
export const FEED_MODEL_SOURCE_LABEL = 'Live feed · raised by model'

/** The Route stage story for a model raised case, with that case's values. */
export function modelRouteCopy(routing: {
  score: number
  challenge: number
  hold: number
  policy_version: string
}, recommendation: 'CHALLENGE' | 'HOLD'): string {
  const threshold = recommendation === 'HOLD' ? routing.hold : routing.challenge
  return `The rules cleared this payment. Its model score, ${routing.score.toFixed(3)}, is at or above the ${recommendation} threshold of ${threshold.toFixed(3)} (policy ${routing.policy_version}), so it was raised to ${recommendation}.`
}

/** The Model signal label on a case the model raised, where "It does not decide" would be untrue. */
export const MODEL_SIGNAL_ROUTED_NOTE =
  'Trained on Sparkov synthetic data. A mechanics demo, not a fraud probability. It raised this payment the rules cleared; it can never lower a rule decision.'

export const SYNTHETIC_OUTLIER_NOTE =
  "A synthetic outlier added to S01's feed to show the model catching what the rules cleared."
