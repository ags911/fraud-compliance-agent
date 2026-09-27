-- Versioned common baselines, scenario overlays, and idempotent simulated
-- event appends. Raw Plaid payloads and identifiers are not stored.

CREATE TABLE IF NOT EXISTS sandbox_baselines (
    baseline_version TEXT PRIMARY KEY,
    creation_revision TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    event_time_precision TEXT NOT NULL CHECK (event_time_precision = 'date'),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (start_date <= end_date)
);

CREATE TABLE IF NOT EXISTS sandbox_baseline_transactions (
    baseline_version TEXT NOT NULL REFERENCES sandbox_baselines (baseline_version),
    transaction_id TEXT NOT NULL,
    event_date DATE NOT NULL,
    available_date DATE NOT NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
    currency CHAR(3) NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    category_bucket TEXT NOT NULL,
    payee_reference TEXT NOT NULL,
    payment_channel TEXT,
    PRIMARY KEY (baseline_version, transaction_id),
    CHECK (available_date >= event_date)
);

ALTER TABLE sandbox_datasets
    ADD COLUMN IF NOT EXISTS baseline_version TEXT,
    ADD COLUMN IF NOT EXISTS overlay_version TEXT;

CREATE TABLE IF NOT EXISTS sandbox_simulated_event_appends (
    scenario_id TEXT NOT NULL,
    fixture_version TEXT NOT NULL,
    event_id TEXT NOT NULL,
    appended_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scenario_id, fixture_version, event_id),
    FOREIGN KEY (scenario_id, fixture_version)
      REFERENCES sandbox_datasets (scenario_id, fixture_version)
);
