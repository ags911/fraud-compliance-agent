# 0003 · Deterministic scenario simulation

**Status**: Assumed
**Date**: 2026-09-24
**Authorized by**: product owner, during /develop

## Owed decision

The worker deployment model, simulation run contract, reset policy, and
browser event stream need formal architecture ratification.

## Assumption built on

Build a Sandbox-only, Neon-backed deterministic simulator. A server-owned
worker command advances due, predeclared events for one scenario at a time.
It does not call Plaid. Run state and schedules persist in PostgreSQL;
scheduled events are immutable, and `(run_id, sequence)` is the append
idempotency boundary. A run starts from the latest isolated scenario dataset.
It can be observed through internal, read-only API endpoints and SSE. Browser
connections neither advance the clock nor submit event content. S01 through
S05 have safe, transaction-shaped schedules. S06 through S08 receive no
invented payment schedule because their accepted meaning is operational.

A reset creates a new run with a new run ID. It does not erase a prior run or
rewrite its records. The worker may be run locally now and is intended for a
future Azure Container Apps Job deployment after ratification.

**Continuous feed (engineer's choices, 2026-09-24, during /develop):** a run
is a long bounded feed, not a short burst: 200 payments, one every 3 seconds
for 10 minutes, with a Stop. Amounts vary by up to 30% around each
scenario's typical amount, from a fixed seed, so a run position always yields
the same payment. Each run starts from the imported base: the worker only
marks a scheduled event as shown and never rewrites the scenario dataset, and
the analytics endpoint adds one run's shown events to the base only when that
run is named. Feed payments land on the dataset's latest day, so the date
window does not move while a run counts up. Starting a run cancels any run
still going for that scenario, and Radar stops a feed when the viewer
changes scenario.

## Code area

`apps/api/migrations/`, `apps/api/server/`, `apps/api/scripts/`,
`apps/api/tests/`, `apps/api/README.md`, and `context/`.

## Requirements

- AC-1: A run and its scheduled events are persisted per scenario, fixture
  version, run ID, and ordered sequence.
- AC-2: Advancing a due event is atomic and idempotent. It marks only that
  event as shown and never changes the imported scenario dataset; a Stop
  waits for an in flight batch, so nothing is added after it.
- AC-6: `GET /sandbox/scenarios/{id}/analytics?simulation_run_id=` returns the
  imported base plus that run's shown events, and 404s a run of another
  scenario or an older import; without it, the base alone.
- AC-7: `POST /sandbox/simulation-runs/{run_id}/cancel` stops a run; shown
  payments stay shown.
- AC-8: Radar's Scenario tab starts, follows and stops a feed, and its
  figures count up from the base as payments land; it says when the worker
  is not running.
- AC-3: A local worker command can advance due events without Plaid access.
- AC-4: Internal API endpoints expose only safe run state and a read-only SSE
  notice stream. They do not expose raw transaction data or accept event
  bodies from a browser.
- AC-5: S01 through S05 use deterministic transaction-shaped schedules; S06
  through S08 remain without a payment schedule.

## Ratify

This decision was recorded by /develop, not deliberated. Run `/architect
Deterministic scenario simulation` to deliberate and ratify it. Until then it
stays flagged as an owed decision; it does not block the local Sandbox build.
