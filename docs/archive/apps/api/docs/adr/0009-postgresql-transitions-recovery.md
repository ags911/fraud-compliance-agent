# ADR-009 — Define PostgreSQL transitions, idempotency and recovery

Status: Proposed  
Date: 2026-09-20  
Owner: Backend owner (unassigned)  
PRD revision/sections: Candidate v0.3, FR-07–08 and Section 10  
Backlog task: P0-07  
Related decisions: ADR-006, ADR-007, ADR-010 and ADR-013  
Repository scope: Local-first F3 persistence design

## Context and decision to be made

F3 needs durable runs, idempotent processing, review concurrency, separate
action/evidence state and read-only replay. IDs alone cannot prevent duplicate
effects across retries or crashes.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| In-memory/SQLite operational state | Easy local setup | Does not prove PostgreSQL constraints/concurrency; rejected for F3 integration |
| PostgreSQL with transactional uniqueness and reconciliation | Explicit durability and failure testing | Requires schema, migrations and local container |
| Distributed queue/cache first | Scalable-looking | No current requirement; unnecessary complexity |

## Proposed decision

Use PostgreSQL locally for F3 after acceptance. Separate immutable transaction,
snapshot, prediction, review-decision and action facts from mutable run/queue
state. Enforce idempotency fingerprint, action uniqueness and optimistic review
version in database constraints. Use a transactional outbox/reconciliation
pattern for evidence delivery; do not claim exactly-once across stores.

The detailed proposal and failure matrix are in
[`f3-postgresql-persistence.proposed.md`](../../../../docs/proposals/f3-postgresql-persistence.proposed.md).

## Contracts and invariants

- Same idempotency key and fingerprint returns/resumes one run.
- Same key with a different fingerprint fails with a stable conflict.
- At most one simulated action exists for the approved action scope.
- Review decision and action/evidence outcomes are separate.
- Replay never writes an action; corrections create new source revisions.
- Browser disconnect never erases an accepted durable run.

## Verification and consequences

Acceptance requires real PostgreSQL failure-injection tests for concurrent
process/review requests and crashes around action/evidence commits. No database
is configured by this proposal; MVP 1–3 remain database-free.

## Open questions and acceptance record

DDL, migration tool, isolation/locks, state machines, retention, outbox and
recovery ownership remain open. Approvers: backend and security reviewers,
unassigned. Approval: pending.
