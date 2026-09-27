/**
 * Browser-side types for the accepted public-showcase SSE contract.
 *
 * These mirror `docs/contracts/public-showcase-events.v1.schema.json` and
 * `docs/contracts/public-showcase-api.v1.openapi.json`. They are the only
 * shape the console consumes: no API internal ever crosses this boundary.
 */

export type ShowcaseScenarioId = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08'

export type ShowcaseExecutionMode = 'recorded' | 'live'

export type ShowcaseToolName =
  | 'get_payee_evidence'
  | 'get_account_activity_evidence'
  | 'get_device_session_evidence'

export type ShowcaseFailureReason =
  | 'provider_unavailable'
  | 'tool_failed'
  | 'invalid_output'
  | 'timeout'
  | 'tool_budget_exhausted'

export type ShowcaseFallbackReason = 'live_disabled' | 'admission_limited' | 'provider_unavailable'

export type ShowcaseSkipReason =
  | 'deterministic_clear_route'
  | 'hard_deterministic_control'
  | 'hard_app_control'
  | 'existing_recorded_recommendation'
  | 'non_investigation_scenario'

export type ShowcaseEvidenceCategory =
  | 'payee_relationship'
  | 'payee_name_match'
  | 'account_balance_impact'
  | 'payment_velocity'
  | 'recent_credit_context'
  | 'device_familiarity'
  | 'session_change'
  | 'location_channel_context'

export interface ShowcaseEvidenceItem {
  evidence_id: string
  category: ShowcaseEvidenceCategory
  display_value: string
  /** Both values are accepted, non-live fixture provenance; neither is a live provider call. */
  source_class: 'synthetic_fixture' | 'plaid_sandbox_derived'
  fixture_version: string
}

export interface ShowcaseClaim {
  claim_id: string
  text: string
  evidence_ids: string[]
}

interface ShowcaseEventIdentity {
  schema_version: '1.0'
  event_id: string
  run_id: string
  scenario_id: ShowcaseScenarioId
  sequence: number
}

export interface ShowcaseRunStartedEvent extends ShowcaseEventIdentity {
  event: 'run_started'
  requested_mode: ShowcaseExecutionMode
  execution_mode: ShowcaseExecutionMode
  fallback_reason: ShowcaseFallbackReason | null
  provider: 'groq' | null
  model_id: string | null
  data_label: 'synthetic'
}

export interface ShowcaseRouteResolvedEvent extends ShowcaseEventIdentity {
  event: 'route_resolved'
  deterministic_route: 'PASS' | 'HOLD' | 'INVESTIGATE'
  investigation_eligibility: 'skipped' | 'eligible' | 'eligible_failure_test'
}

export interface ShowcaseInvestigationSkippedEvent extends ShowcaseEventIdentity {
  event: 'investigation_skipped'
  reason: ShowcaseSkipReason
}

export interface ShowcaseToolCallEvent extends ShowcaseEventIdentity {
  event: 'tool_call'
  call_index: number
  tool_name: ShowcaseToolName
}

export interface ShowcaseToolResultEvent extends ShowcaseEventIdentity {
  event: 'tool_result'
  call_index: number
  tool_name: ShowcaseToolName
  evidence: ShowcaseEvidenceItem[]
}

export interface ShowcaseInvestigationResultEvent extends ShowcaseEventIdentity {
  event: 'investigation_result'
  investigation_status: 'complete' | 'incomplete'
  recommendation: 'PASS' | 'CHALLENGE' | 'HOLD'
  recommendation_basis: 'evidence_grounded' | 'fail_safe'
  summary: string
  claims: ShowcaseClaim[]
  uncertainties: string[]
  /** The contract forbids the agent from evaluating authority. */
  authority_status: 'not_evaluated'
  simulated_action: 'none'
  failure_reason: ShowcaseFailureReason | null
}

export interface ShowcaseRunResultEvent extends ShowcaseEventIdentity {
  event: 'run_result'
  investigation_status: 'skipped' | 'complete' | 'incomplete'
  recommendation: 'PASS' | 'CHALLENGE' | 'HOLD'
  recommendation_basis: 'deterministic' | 'evidence_grounded' | 'fail_safe'
  authority_status: 'not_evaluated'
  simulated_action: 'none'
  execution_mode: ShowcaseExecutionMode
  data_label: 'synthetic'
}

export type ShowcaseEvent =
  | ShowcaseRunStartedEvent
  | ShowcaseRouteResolvedEvent
  | ShowcaseInvestigationSkippedEvent
  | ShowcaseToolCallEvent
  | ShowcaseToolResultEvent
  | ShowcaseInvestigationResultEvent
  | ShowcaseRunResultEvent
