-- Durable, scenario-scoped deterministic simulation runs. The tables store
-- only sanitised scheduled values and never provider payloads or identifiers.

CREATE TABLE IF NOT EXISTS sandbox_simulation_runs (
    run_id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    fixture_version TEXT NOT NULL,
    seed TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    scheduled_event_count INTEGER NOT NULL CHECK (scheduled_event_count >= 0),
    appended_event_count INTEGER NOT NULL DEFAULT 0 CHECK (appended_event_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_reason TEXT,
    FOREIGN KEY (scenario_id, fixture_version)
      REFERENCES sandbox_datasets (scenario_id, fixture_version),
    CHECK (appended_event_count <= scheduled_event_count)
);

CREATE TABLE IF NOT EXISTS sandbox_simulation_events (
    run_id TEXT NOT NULL REFERENCES sandbox_simulation_runs (run_id),
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    event_id TEXT NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    event_date DATE NOT NULL,
    available_date DATE NOT NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
    currency CHAR(3) NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    category_bucket TEXT NOT NULL,
    payee_reference TEXT NOT NULL,
    payment_channel TEXT,
    appended_at TIMESTAMPTZ,
    PRIMARY KEY (run_id, sequence),
    UNIQUE (run_id, event_id),
    CHECK (available_date >= event_date)
);

CREATE INDEX IF NOT EXISTS sandbox_simulation_events_due_idx
  ON sandbox_simulation_events (due_at)
  WHERE appended_at IS NULL;
