# Fraud Compliance Agent API

FastAPI backend for the synthetic Fraud Compliance Agent showcase.

Run locally with `uv run uvicorn server.main:app --reload --port 8010`.

The optional Sandbox scenario data slice reads a sanitised, versioned dataset
from Neon PostgreSQL when `DATABASE_URL` is configured. Apply
`migrations/0001_sandbox_scenario_data.sql` with
`uv run python scripts/apply_sandbox_migrations.py`, then import a reviewed
fixture with `uv run python scripts/import_sandbox_scenario.py ../../fixtures/sandbox/s04.dataset.v1.json`.
The importer does not call Plaid and raw provider payloads, descriptions,
identifiers and access tokens must never be committed.
