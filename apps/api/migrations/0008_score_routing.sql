-- ADR-025 / spec 0010: score routing can only escalate a rule PASS.
-- This migration is rerunnable because the development runner applies it on
-- every invocation and records no migration history.

ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS rule_recommendation TEXT;
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS routed_by TEXT;
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS routing_policy_version TEXT;
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS synthetic_outlier BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sandbox_simulation_events
  DROP CONSTRAINT IF EXISTS sandbox_simulation_events_recommendation_basis_check;
ALTER TABLE sandbox_simulation_events
  ADD CONSTRAINT sandbox_simulation_events_recommendation_basis_check
  CHECK (recommendation_basis IN ('deterministic', 'evidence_grounded', 'fail_safe', 'model_threshold'));
ALTER TABLE sandbox_simulation_events
  DROP CONSTRAINT IF EXISTS sandbox_simulation_events_rule_recommendation_check;
ALTER TABLE sandbox_simulation_events
  ADD CONSTRAINT sandbox_simulation_events_rule_recommendation_check
  CHECK (rule_recommendation IS NULL OR rule_recommendation IN ('PASS', 'CHALLENGE', 'HOLD'));
ALTER TABLE sandbox_simulation_events
  DROP CONSTRAINT IF EXISTS sandbox_simulation_events_routed_by_check;
ALTER TABLE sandbox_simulation_events
  ADD CONSTRAINT sandbox_simulation_events_routed_by_check
  CHECK (routed_by IS NULL OR routed_by IN ('rule', 'model'));
ALTER TABLE sandbox_simulation_events
  DROP CONSTRAINT IF EXISTS score_routing_escalates_only;
ALTER TABLE sandbox_simulation_events
  ADD CONSTRAINT score_routing_escalates_only CHECK (
    routed_by <> 'model' OR (rule_recommendation = 'PASS' AND model_score IS NOT NULL
      AND recommendation IN ('CHALLENGE', 'HOLD'))
  );

ALTER TABLE showcase_cases ADD COLUMN IF NOT EXISTS routed_by TEXT;
ALTER TABLE showcase_cases ADD COLUMN IF NOT EXISTS event_contract_version TEXT NOT NULL DEFAULT '1';
ALTER TABLE showcase_cases
  DROP CONSTRAINT IF EXISTS showcase_cases_recommendation_basis_check;
ALTER TABLE showcase_cases
  ADD CONSTRAINT showcase_cases_recommendation_basis_check
  CHECK (recommendation_basis IS NULL OR recommendation_basis IN ('deterministic', 'evidence_grounded', 'fail_safe', 'model_threshold'));
ALTER TABLE showcase_cases
  DROP CONSTRAINT IF EXISTS showcase_cases_routed_by_check;
ALTER TABLE showcase_cases
  ADD CONSTRAINT showcase_cases_routed_by_check CHECK (routed_by IS NULL OR (origin = 'feed' AND routed_by IN ('rule', 'model')));
ALTER TABLE showcase_cases
  DROP CONSTRAINT IF EXISTS showcase_cases_event_contract_version_check;
ALTER TABLE showcase_cases
  ADD CONSTRAINT showcase_cases_event_contract_version_check CHECK (event_contract_version IN ('1', '2'));
