# Fraud Compliance Agent API

FastAPI backend for the synthetic Fraud Compliance Agent showcase.

Run locally with `uv run uvicorn server.main:app --reload --port 8010`.

The optional Sandbox scenario data slice reads a sanitised, versioned dataset
from Neon PostgreSQL when `DATABASE_URL` is configured. Apply every reviewed
migration with `uv run python scripts/apply_sandbox_migrations.py`.

For the original reviewed S04 fixture, run
`uv run python scripts/import_sandbox_scenario.py ../../fixtures/sandbox/s04.dataset.v1.json`.
For the S01–S08 history slice, set `PLAID_ENV=sandbox`,
`PLAID_SANDBOX_ACCESS_TOKEN`, and `SANDBOX_PSEUDONYMISATION_KEY` in Doppler,
then run `uv run python scripts/import_plaid_sandbox_history.py`. That command
calls Plaid once through `/transactions/sync`, keeps provider responses in
memory, stores only sanitised values, and generates every calendar day in each
scenario timeline. To append a reviewed simulated event to one scenario, run
`uv run python scripts/append_sandbox_simulated_event.py path/to/event.json`.
Raw provider payloads, descriptions, identifiers and access tokens must never
be committed.

The local deterministic simulation worker is separate from the API process.
After the migrations and import, start it with
`uv run python scripts/run_sandbox_simulation_worker.py`. An internal client
can create a run with `POST /sandbox/scenarios/{scenario_id}/simulation-runs`,
observe its safe state with `GET /sandbox/simulation-runs/{run_id}`, and
subscribe to `GET /sandbox/simulation-runs/{run_id}/events`. The worker, not
the browser, appends due sanitised events. It never calls Plaid.
