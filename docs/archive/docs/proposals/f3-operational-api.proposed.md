# F3 operational API contract — proposed review outline

Status: **Proposed; not an accepted contract or implemented API**  
Version: `0.1-proposed`  
Decision boundary: [ADR-013](../../apps/api/docs/adr/0013-adopt-local-first-f3-boundaries.md)  
Current accepted demo contract: [ADR-012](../../apps/api/docs/adr/0012-freeze-showcase-api-contract.md)

## Purpose

Define the review packet that must become a separate, versioned operational
contract before F3 endpoint code begins. This proposal does not change the five
showcase routes, approve canonical transaction semantics, or authorise a
database, runtime model, provider connector or payment action.

## Proposed capability boundary

| Capability | Candidate contract responsibility | Explicit exclusion |
| --- | --- | --- |
| Stateless scoring | Validate an accepted canonical transaction/snapshot reference, run deterministic controls and a scoring port, and return a versioned recommendation with factors | No payment action, no browser-supplied authority and no invented production score |
| Durable processing | Accept an idempotency key, create or resume a durable run, and expose its typed lifecycle | No duplicate action, no dependence on an open browser stream and no implied exactly-once distributed guarantee |
| Transaction reads | Return server-owned source facts, feature lineage, recommendation, run and evidence-delivery state | No raw provider identifiers, secrets, hidden reasoning or fabricated history |
| Event stream | Report durable run progress using versioned event IDs and reconnection semantics | SSE is not the system of record |

The PRD names `/risk/score` and
`/transactions/{transaction_id}/process` as candidate operations. Their exact
paths, envelopes, status codes and compatibility policy remain unresolved until
the canonical, persistence and identity proposals are jointly reviewed.

## Required contract set

1. Versioned `SourceEvent`, `CanonicalTransaction`, `FeatureSnapshot`,
   `Prediction` and `RunContext` schemas promoted from the existing canonical
   proposal only after approval.
2. Separate OpenAPI for operational HTTP operations; ADR-012's demo OpenAPI is
   not edited or silently superseded.
3. Separate event schema for durable processing progress, reconnection and
   terminal semantics.
4. Stable redacted errors covering validation, identity, authorization,
   idempotency conflict, unavailable dependency, concurrency conflict and
   evidence-pending states.
5. A compatibility and migration record for each accepted contract version.

## Scoring boundary for F3

F3 may introduce a provider-neutral scoring interface and a deterministic test
implementation to verify orchestration. Test scores are fixed inputs with no
performance meaning. Loading a trained artifact, choosing a target, threshold
or calibration method, and processing Plaid facts through a model belong to
F3a and require separate approval.

## Acceptance questions

- Does scoring accept an immutable snapshot or create it synchronously?
- Which prediction facts are committed synchronously, and which delivery states
  may be pending?
- What identifies an idempotency scope, and how is a conflicting request hash
  reported?
- Which reads require which server-derived role and tenant context?
- Which event IDs and retention window support reconnection?
- How does a source correction create a new transaction revision without
  mutating the prior decision?

## Future verification gate

Acceptance requires generated schema/OpenAPI artifacts, valid and invalid
fixtures, API drift tests, frontend consumer tests, PostgreSQL failure-injection
tests and a recorded ADR. Until then, no application imports this proposal.
