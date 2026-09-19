export type SimAResult = {
  score: number
  outcome: 'HOLD' | 'PASS'
  signal_breakdown: Record<string, number>
  cold_start: boolean
  policy_version: string
  record_id: string
}

export type SimBResult = {
  outcome: 'HOLD' | 'CHALLENGE' | 'PASS'
  stage1_triggered: boolean
  stage1_rule: string | null
  typology_assessed: string | null
  model_provider: string | null
  model_version: string | null
  llm_likelihood: number | null
  llm_rationale: string | null
  llm_error: string | null
  cop_match_status: string
  policy_version: string
  counterfactual_summary: string
  record_id: string
}

export type CounterfactualResult = {
  original_outcome: string
  counterfactual_outcome: string
  explanation: string
  gdpr_article_22_compliant: boolean
  record_id: string
}

export type TransactionFeatures = {
  transaction_id: string
  account_id: string
  amount: number
  currency: string
  payment_channel: string
  country: string | null
  personal_finance_category: string
  avg_30d: number | null
  cold_start: boolean
  velocity_6h: number
  first_seen_payee: boolean
  account_balance: number
  account_balance_pct_remaining: number
  inbound_credit_within_2h: boolean
}

export type PolicyReferenceEntry = {
  policy_id: string
  version: string
  section: string | null
}

/** Display-safe metadata for a signed record; verification is not implied. */
export type SignedRecordSummary = {
  record_id: string
  agent_id: string
  action_type: string
  policy_reference: PolicyReferenceEntry[]
  human_oversight_status: string
  record_hash: string
  schema_version: string
  signature_present: boolean
  verification_status: 'not_performed'
}

export type NodeName = 'data_ingest' | 'sim_a' | 'sim_b' | 'counterfactual' | 'evidence_pack'

export type NodeResultMap = {
  data_ingest: { transaction: TransactionFeatures }
  sim_a: { sim_a: SimAResult }
  sim_b: { sim_b: SimBResult }
  counterfactual: { counterfactual: CounterfactualResult }
  evidence_pack: { evidence_pack_path: string | null }
}

export type StreamEvent = {
  node: NodeName | 'error'
  result?: Record<string, unknown>
  record?: SignedRecordSummary | null
  error?: string
}

export type NodeStatus = 'pending' | 'running' | 'done' | 'skipped'

export const NODE_ORDER: NodeName[] = [
  'data_ingest',
  'sim_a',
  'sim_b',
  'counterfactual',
  'evidence_pack',
]

export type Scenario = { id: string; label: string }

export type RunFormState = {
  amount: number
  payment_channel: 'online' | 'in store' | 'other'
  country: string
  personal_finance_category: string
  velocity_6h: number
  first_seen_payee: boolean
  account_balance: number
  account_balance_pct_remaining: number
  inbound_credit_within_2h: boolean
  /** Declared synthetic history used only to calculate the demo baseline. */
  history: { amount: number }[]
  simulate_llm_outage: boolean
}
