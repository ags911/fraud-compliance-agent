-- Sandbox-only deterministic scenario storage. Raw provider payloads and
-- identifiers are deliberately excluded from every table in this migration.
CREATE TABLE IF NOT EXISTS sandbox_datasets (
    scenario_id TEXT NOT NULL,
    fixture_version TEXT NOT NULL,
    source_class TEXT NOT NULL CHECK (source_class = 'sanitised_sandbox'),
    creation_revision TEXT NOT NULL,
    enrichment_version TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    event_time_precision TEXT NOT NULL CHECK (event_time_precision IN ('date', 'minute', 'second')),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scenario_id, fixture_version),
    CHECK (start_date <= end_date)
);

CREATE TABLE IF NOT EXISTS sandbox_transactions (
    scenario_id TEXT NOT NULL,
    fixture_version TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    event_date DATE NOT NULL,
    available_date DATE NOT NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
    currency CHAR(3) NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    category_bucket TEXT NOT NULL,
    payee_reference TEXT NOT NULL,
    payment_channel TEXT,
    feature_snapshot JSONB NOT NULL,
    PRIMARY KEY (scenario_id, fixture_version, transaction_id),
    FOREIGN KEY (scenario_id, fixture_version)
      REFERENCES sandbox_datasets (scenario_id, fixture_version),
    CHECK (available_date >= event_date)
);

CREATE INDEX IF NOT EXISTS sandbox_transactions_dataset_date_idx
  ON sandbox_transactions (scenario_id, fixture_version, event_date);

CREATE TABLE IF NOT EXISTS sandbox_daily_aggregates (
    scenario_id TEXT NOT NULL,
    fixture_version TEXT NOT NULL,
    aggregate_date DATE NOT NULL,
    transaction_count INTEGER NOT NULL CHECK (transaction_count >= 0),
    outbound_amount_minor BIGINT NOT NULL CHECK (outbound_amount_minor >= 0),
    category_counts JSONB NOT NULL,
    PRIMARY KEY (scenario_id, fixture_version, aggregate_date),
    FOREIGN KEY (scenario_id, fixture_version)
      REFERENCES sandbox_datasets (scenario_id, fixture_version)
);
