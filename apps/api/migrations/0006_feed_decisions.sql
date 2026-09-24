-- Spec 0004: every outbound live feed payment is decided at run start by its
-- scenario's deterministic rule, and a revealed non PASS payment becomes one
-- feed case. Rerunnable: the migration runner applies every file on every run.

-- The decision, written at run start. Null only for rows created before 0006.
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS deterministic_route TEXT
    CHECK (deterministic_route IN ('PASS', 'HOLD', 'INVESTIGATE'));
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS recommendation TEXT
    CHECK (recommendation IN ('PASS', 'CHALLENGE', 'HOLD'));
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS recommendation_basis TEXT
    CHECK (recommendation_basis IN ('deterministic', 'evidence_grounded', 'fail_safe'));

-- A display only model score (spec 0004 slice 3). Null until an ADR approves
-- it, and it never feeds a route, a recommendation or the case rule.
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS model_score NUMERIC(6, 5)
    CHECK (model_score >= 0 AND model_score <= 1);
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS model_version TEXT;
-- SHA256 of the feature vector, so a shown score can be audited.
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS model_input_sha256 TEXT;

-- A historical pointer to the payment's feed case, with no foreign key: the
-- case may later be trimmed by the cap or expire.
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS case_id TEXT UNIQUE;
-- Null for a PASS payment or one not yet revealed.
ALTER TABLE sandbox_simulation_events
  ADD COLUMN IF NOT EXISTS case_status TEXT
    CHECK (case_status IN ('saved', 'invalid', 'storage_off'));

-- Which path saved a case. Existing rows are Run showcase cases.
ALTER TABLE showcase_cases
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'showcase'
    CHECK (origin IN ('showcase', 'feed'));
ALTER TABLE showcase_cases
  ADD COLUMN IF NOT EXISTS model_score NUMERIC(6, 5)
    CHECK (model_score >= 0 AND model_score <= 1);
ALTER TABLE showcase_cases
  ADD COLUMN IF NOT EXISTS model_version TEXT;

-- Only a feed case may carry a model score.
ALTER TABLE showcase_cases
  DROP CONSTRAINT IF EXISTS showcase_cases_model_score_feed_only;
ALTER TABLE showcase_cases
  ADD CONSTRAINT showcase_cases_model_score_feed_only
  CHECK (origin = 'feed' OR (model_score IS NULL AND model_version IS NULL));

-- The per origin caps (20 feed, 50 showcase) trim newest first within one
-- browser and origin. The existing per browser paging index stays.
CREATE INDEX IF NOT EXISTS showcase_cases_browser_origin_idx
  ON showcase_cases (browser_id, origin, completed_at DESC, case_id DESC);
