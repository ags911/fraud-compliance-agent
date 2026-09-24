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

## Code area

`apps/api/migrations/`, `apps/api/server/`, `apps/api/scripts/`,
`apps/api/tests/`, `apps/api/README.md`, and `context/`.

## Requirements

- AC-1: A run and its scheduled events are persisted per scenario, fixture
  version, run ID, and ordered sequence.
- AC-2: Advancing a due event is atomic and idempotent. It updates only its
  scenario dataset and its derived aggregates.
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
