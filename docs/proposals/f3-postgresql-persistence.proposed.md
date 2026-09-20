# F3 PostgreSQL persistence — proposed decision outline

Status: **Proposed; design only, no database is configured**  
Version: `0.1-proposed`  
Decision boundary: [ADR-013](../../apps/api/docs/adr/0013-adopt-local-first-f3-boundaries.md)  
Backlog alignment: P0-07 / future ADR-009

## Selected direction

PostgreSQL is the proposed F3 operational store. Development begins locally in
a container after this design is accepted; MVP 1–3 remain database-free and no
managed Azure database is authorised. API handlers will use repositories and
parameterised access rather than containing SQL.

## Proposed operational entities

| Entity | Durable purpose | Principal invariant |
| --- | --- | --- |
| Transaction revision | Immutable canonical facts and correction lineage | A correction creates a new revision; prior facts are not overwritten |
| Feature snapshot | Point-in-time features and source lineage | Snapshot hash and schema version are immutable |
| Prediction | Deterministic-control/model output and versions | Recommendation is not authority or action |
| Processing run | Stateful lifecycle, idempotency scope and request fingerprint | Same key and fingerprint returns/resumes one run; conflict fails |
| Review queue state | Mutable claim/expiry/current-version state | Server-derived ownership and optimistic concurrency |
| Review decision | Immutable submitted reviewer decision | A stale version never overwrites a decision |
| Simulated action | Separately committed action result | At most one action for the approved transaction/run scope |
| Evidence delivery | Delivery attempts, linked record IDs and pending/failure state | Failed evidence delivery never invents a failed or duplicate action |

## Proposed transition and recovery rules

- Commit transaction revision and accepted processing run before returning a
  durable run identifier.
- Enforce idempotency and action uniqueness with database constraints, not only
  application checks.
- Record action outcome independently from review and evidence-delivery state;
  `DECIDED` does not mean action or evidence succeeded.
- Preserve an evidence-pending state when action state is committed but
  delivery is incomplete. Reconciliation retries delivery without repeating an
  action.
- A browser disconnect does not cancel or erase durable processing.
- Replay is read-only with respect to action and preserves original lineage.

## Proposed run transitions

| Current state | Trigger | Next state | Durable effect |
| --- | --- | --- | --- |
| none | Valid new idempotency key/fingerprint | `ACCEPTED` | Insert one run and request fingerprint |
| `ACCEPTED` | Worker starts | `PROCESSING` | Record attempt/lease without creating an action |
| `PROCESSING` | Recommendation needs review | `PENDING_REVIEW` | Create queue state; execute nothing |
| `PROCESSING` | Fail-safe or non-action terminal route | `COMPLETED_NO_ACTION` | Store recommendation and reason codes |
| `PENDING_REVIEW` | Valid versioned decision | `DECIDED` | Insert immutable review decision; revalidation still required |
| `DECIDED` | Authority/policy revalidation passes | `ACTION_PENDING` | Reserve unique simulated-action scope |
| `ACTION_PENDING` | Simulated action commits | `ACTION_COMMITTED` | Insert exactly one action result |
| `ACTION_COMMITTED` | Evidence delivery pending/fails | `EVIDENCE_PENDING` | Insert/retry outbox delivery; never repeat action |
| any non-terminal | Dependency/validation failure | `FAILED` or approved fail-safe state | Store redacted category and preserve retry policy |

The state names are proposed vocabulary, not accepted API enums. Exact legal
transitions and whether `DECIDED` is a run state or derived review fact remain
for ADR-009 review.

## Proposed failure matrix

| Failure or race | Required durable result | Forbidden result | Future verification |
| --- | --- | --- | --- |
| Two identical process requests | One run returned/resumed to both callers | Two runs or actions | Concurrent PostgreSQL integration test |
| Same key, different fingerprint | Stable conflict; original run unchanged | Overwrite or second run | Uniqueness/fingerprint test |
| Crash before action commit | Recoverable pending/failed state; no action fact | Reported action success | Failure injection before transaction commit |
| Crash after action commit, before evidence delivery | One action plus `EVIDENCE_PENDING` | Retried second action or invented evidence success | Commit/outbox failure injection |
| Two reviewers finalize same version | One immutable decision; one stale conflict | Last-write-wins overwrite | Optimistic-concurrency integration test |
| Approval expires or action changes | Revalidation fails; no action | Execution under stale approval | Revalidation test |
| Database unavailable before acceptance | No durable run ID reported | Ephemeral success | API/repository fault test |
| Signing/evidence service unavailable | Operational fact retained; delivery pending | Rollback/repeat committed action | Outbox reconciliation test |
| Browser disconnects | Durable run continues under approved lifecycle | Cancellation inferred from socket close | Reconnect test with durable event IDs |
| Historical replay requested | New comparison result only | New payment action | Replay repository/API test |
| Source correction arrives | New transaction/source revision linked to prior | Mutation of original fact or repeated action | Correction lineage test |

## Decisions still required before acceptance

- Exact tables, keys, foreign keys, retention and migration tool.
- Transaction isolation, lock strategy and conflict response semantics.
- Idempotency-key scope, request fingerprint algorithm and retention window.
- Run/review/action state machines and legal transitions.
- Outbox/reconciliation design for evidence delivery.
- Backup, restore, data deletion and local fixture reset policy.

## Future verification gate

Use real PostgreSQL integration tests for simultaneous process requests,
conflicting fingerprints, concurrent review finalisation, crashes before/after
action commit, evidence retry and correction/replay. Unit tests may use an
in-memory repository only for isolated domain logic and cannot prove database
constraints.
