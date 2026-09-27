import type {
  ShowcaseEvent,
  ShowcaseEvidenceItem,
} from '@/lib/showcase-types'

const SCENARIOS = new Set(['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08'])
const MODES = new Set(['recorded', 'live'])
const TOOLS = new Set([
  'get_payee_evidence',
  'get_account_activity_evidence',
  'get_device_session_evidence',
])
const EVIDENCE_CATEGORIES = new Set([
  'payee_relationship',
  'payee_name_match',
  'account_balance_impact',
  'payment_velocity',
  'recent_credit_context',
  'device_familiarity',
  'session_change',
  'location_channel_context',
])
const FAILURE_REASONS = new Set([
  'provider_unavailable',
  'tool_failed',
  'invalid_output',
  'timeout',
  'tool_budget_exhausted',
])

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringWithin(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum
}

function hasExactKeys(value: JsonObject, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function isIdentity(value: JsonObject): boolean {
  return (
    value.schema_version === '1.0' &&
    typeof value.event_id === 'string' &&
    /^evt_[a-z0-9_]{3,64}$/.test(value.event_id) &&
    typeof value.run_id === 'string' &&
    /^run_[a-z0-9_]{3,64}$/.test(value.run_id) &&
    typeof value.scenario_id === 'string' &&
    SCENARIOS.has(value.scenario_id) &&
    Number.isInteger(value.sequence) &&
    Number(value.sequence) >= 1 &&
    Number(value.sequence) <= 32
  )
}

function isEvidenceItem(value: unknown): value is ShowcaseEvidenceItem {
  if (!isObject(value)) return false
  return (
    hasExactKeys(value, ['evidence_id', 'category', 'display_value', 'source_class', 'fixture_version']) &&
    typeof value.evidence_id === 'string' &&
    /^ev_[a-z0-9_]{3,48}$/.test(value.evidence_id) &&
    typeof value.category === 'string' &&
    EVIDENCE_CATEGORIES.has(value.category) &&
    isStringWithin(value.display_value, 1, 160) &&
    (value.source_class === 'synthetic_fixture' || value.source_class === 'plaid_sandbox_derived') &&
    isStringWithin(value.fixture_version, 1, 64)
  )
}

function isClaims(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > 6) return false
  return value.every((claim) => {
    if (!isObject(claim) || !hasExactKeys(claim, ['claim_id', 'text', 'evidence_ids'])) return false
    return (
      typeof claim.claim_id === 'string' &&
      /^claim_[a-z0-9_]{3,48}$/.test(claim.claim_id) &&
      isStringWithin(claim.text, 1, 200) &&
      Array.isArray(claim.evidence_ids) &&
      claim.evidence_ids.length >= 1 &&
      claim.evidence_ids.length <= 6 &&
      claim.evidence_ids.every((id) => typeof id === 'string' && /^ev_[a-z0-9_]{3,48}$/.test(id)) &&
      new Set(claim.evidence_ids).size === claim.evidence_ids.length
    )
  })
}

function isInvestigationResult(value: JsonObject): boolean {
  const claims = value.claims
  const claimCount = Array.isArray(claims) ? claims.length : -1
  const uncertainties = value.uncertainties
  if (
    !hasExactKeys(value, [
      'schema_version', 'event_id', 'run_id', 'scenario_id', 'sequence', 'event',
      'investigation_status', 'recommendation', 'recommendation_basis', 'summary',
      'claims', 'uncertainties', 'authority_status', 'simulated_action', 'failure_reason',
    ]) ||
    !['S04', 'S05'].includes(String(value.scenario_id)) ||
    !['complete', 'incomplete'].includes(String(value.investigation_status)) ||
    !['PASS', 'CHALLENGE', 'HOLD'].includes(String(value.recommendation)) ||
    !['evidence_grounded', 'fail_safe'].includes(String(value.recommendation_basis)) ||
    !isStringWithin(value.summary, 1, 280) ||
    !isClaims(claims) ||
    !Array.isArray(uncertainties) ||
    uncertainties.length > 6 ||
    !uncertainties.every((item) => isStringWithin(item, 1, 160)) ||
    new Set(uncertainties).size !== uncertainties.length ||
    value.authority_status !== 'not_evaluated' ||
    value.simulated_action !== 'none'
  ) return false

  if (value.investigation_status === 'complete') {
    return value.recommendation_basis === 'evidence_grounded' && claimCount >= 1 && value.failure_reason === null
  }
  return (
    value.recommendation === 'HOLD' &&
    value.recommendation_basis === 'fail_safe' &&
    claimCount === 0 &&
    typeof value.failure_reason === 'string' &&
    FAILURE_REASONS.has(value.failure_reason)
  )
}

/** Decode one untrusted SSE payload against the accepted browser contract. */
export function parseShowcaseEvent(value: unknown): ShowcaseEvent {
  if (!isObject(value) || !isIdentity(value) || typeof value.event !== 'string') {
    throw new Error('The synthetic investigation stream contained an invalid event.')
  }

  const base = ['schema_version', 'event_id', 'run_id', 'scenario_id', 'sequence', 'event'] as const
  let valid = false
  switch (value.event) {
    case 'run_started':
      valid =
        hasExactKeys(value, [...base, 'requested_mode', 'execution_mode', 'fallback_reason', 'provider', 'model_id', 'data_label']) &&
        typeof value.requested_mode === 'string' && MODES.has(value.requested_mode) &&
        typeof value.execution_mode === 'string' && MODES.has(value.execution_mode) &&
        (value.fallback_reason === null || ['live_disabled', 'admission_limited', 'provider_unavailable'].includes(String(value.fallback_reason))) &&
        value.data_label === 'synthetic' &&
        (value.execution_mode === 'live'
          ? value.provider === 'groq' && isStringWithin(value.model_id, 1, 120) && value.fallback_reason === null
          : value.provider === null && value.model_id === null)
      break
    case 'route_resolved':
      valid =
        hasExactKeys(value, [...base, 'deterministic_route', 'investigation_eligibility']) &&
        ['PASS', 'HOLD', 'INVESTIGATE'].includes(String(value.deterministic_route)) &&
        ['skipped', 'eligible', 'eligible_failure_test'].includes(String(value.investigation_eligibility))
      break
    case 'investigation_skipped':
      valid =
        hasExactKeys(value, [...base, 'reason']) &&
        ['deterministic_clear_route', 'hard_deterministic_control', 'hard_app_control', 'existing_recorded_recommendation', 'non_investigation_scenario'].includes(String(value.reason))
      break
    case 'tool_call':
      valid =
        hasExactKeys(value, [...base, 'call_index', 'tool_name']) &&
        value.scenario_id === 'S04' && Number.isInteger(value.call_index) &&
        Number(value.call_index) >= 1 && Number(value.call_index) <= 3 &&
        typeof value.tool_name === 'string' && TOOLS.has(value.tool_name)
      break
    case 'tool_result':
      valid =
        hasExactKeys(value, [...base, 'call_index', 'tool_name', 'evidence']) &&
        value.scenario_id === 'S04' && Number.isInteger(value.call_index) &&
        Number(value.call_index) >= 1 && Number(value.call_index) <= 3 &&
        typeof value.tool_name === 'string' && TOOLS.has(value.tool_name) &&
        Array.isArray(value.evidence) && value.evidence.length >= 1 && value.evidence.length <= 4 &&
        value.evidence.every(isEvidenceItem)
      break
    case 'investigation_result':
      valid = isInvestigationResult(value)
      break
    case 'run_result':
      valid =
        hasExactKeys(value, [...base, 'investigation_status', 'recommendation', 'recommendation_basis', 'authority_status', 'simulated_action', 'execution_mode', 'data_label']) &&
        ['skipped', 'complete', 'incomplete'].includes(String(value.investigation_status)) &&
        ['PASS', 'CHALLENGE', 'HOLD'].includes(String(value.recommendation)) &&
        ['deterministic', 'evidence_grounded', 'fail_safe'].includes(String(value.recommendation_basis)) &&
        value.authority_status === 'not_evaluated' && value.simulated_action === 'none' &&
        typeof value.execution_mode === 'string' && MODES.has(value.execution_mode) &&
        value.data_label === 'synthetic'
      break
  }
  if (!valid) throw new Error('The synthetic investigation stream contained an invalid event.')
  return value as unknown as ShowcaseEvent
}
