-- Durable showcase investigation cases (spec 0002, proposed, internal only).
-- A case is one completed run: a summary row derived once from its accepted
-- public-showcase-events.v1 payloads, plus those payloads as an append only
-- audit trail. Rerunnable: every statement is IF NOT EXISTS, because the
-- migration runner applies every file on every run.
CREATE TABLE IF NOT EXISTS showcase_cases (
    case_id TEXT PRIMARY KEY,
    browser_id UUID NOT NULL,
    scenario_id TEXT NOT NULL CHECK (scenario_id ~ '^S0[1-8]$'),
    requested_mode TEXT NOT NULL CHECK (requested_mode IN ('recorded', 'live')),
    execution_mode TEXT NOT NULL CHECK (execution_mode IN ('recorded', 'live')),
    fallback_reason TEXT CHECK (fallback_reason IN ('live_disabled', 'admission_limited', 'provider_unavailable')),
    provider TEXT CHECK (provider IN ('groq')),
    model_id TEXT,
    deterministic_route TEXT NOT NULL CHECK (deterministic_route IN ('PASS', 'HOLD', 'INVESTIGATE')),
    investigation_status TEXT NOT NULL CHECK (investigation_status IN ('skipped', 'complete', 'incomplete')),
    recommendation TEXT NOT NULL CHECK (recommendation IN ('PASS', 'CHALLENGE', 'HOLD')),
    recommendation_basis TEXT NOT NULL CHECK (recommendation_basis IN ('deterministic', 'evidence_grounded', 'fail_safe')),
    failure_reason TEXT CHECK (failure_reason IN ('provider_unavailable', 'tool_failed', 'invalid_output', 'timeout', 'tool_budget_exhausted')),
    authority_status TEXT NOT NULL CHECK (authority_status = 'not_evaluated'),
    tool_call_count INTEGER NOT NULL CHECK (tool_call_count >= 0),
    evidence_count INTEGER NOT NULL CHECK (evidence_count >= 0),
    event_count INTEGER NOT NULL CHECK (event_count >= 1),
    fixture_version TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    contract_version TEXT NOT NULL CHECK (contract_version = '1.0'),
    CHECK (completed_at >= started_at),
    CHECK (expires_at > completed_at),
    -- An incomplete investigation always records why it failed.
    CHECK ((investigation_status = 'incomplete') = (failure_reason IS NOT NULL))
);

-- Newest first paging within one browser.
CREATE INDEX IF NOT EXISTS showcase_cases_browser_page_idx
  ON showcase_cases (browser_id, completed_at DESC, case_id DESC);

CREATE INDEX IF NOT EXISTS showcase_cases_expiry_idx
  ON showcase_cases (expires_at);

CREATE TABLE IF NOT EXISTS showcase_case_events (
    case_id TEXT NOT NULL REFERENCES showcase_cases (case_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (case_id, sequence),
    -- Event IDs share a run derived prefix, so they are unique per case only.
    UNIQUE (case_id, event_id)
);
