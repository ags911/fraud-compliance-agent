# ADR-002 — Define canonical event, transaction and feature contracts

Status: Proposed  
Date: 2026-09-20  
Owner: Backend/data owner (unassigned)  
PRD revision/sections: Candidate v0.3, Sections 5–8  
Backlog task: P0-02  
Related decisions: ADR-003, ADR-004 and ADR-013  
Repository scope: Canonical domain contracts and fixtures

## Context and decision to be made

Source observations, canonical facts, derived features, predictions, run state
and later outcomes need separate identities and clocks. Plaid observations do
not yet establish money, direction, timestamp, correction or availability
semantics.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Reuse provider payloads directly | Minimal mapping | Provider-specific, unsafe identifiers, ambiguous clocks and money |
| Adopt explicit canonical entities and lineage | Reviewable, replay-safe, provider-neutral | Requires approved mapping and version migration |
| Use current demo transaction dictionaries | Already implemented | Synthetic, incomplete and not an operational contract |

## Proposed decision

Adopt the six-entity separation described by the canonical transaction draft:
`SourceEvent`, `CanonicalTransaction`, `FeatureSnapshot`, `Prediction`,
`RunContext` and `OutcomeLabel`. Money uses non-negative integer minor units and
ISO currency; direction is separate. Preserve event, observation and
availability time plus precision, immutable source revisions and correction
links. Unknown remains distinct from zero/false.

The review schemas are
[`canonical-domain.v0.proposed.schema.json`](../../../../docs/proposals/schemas/canonical-domain.v0.proposed.schema.json).
They remain proposals until ADR-003/004 resolve source and label feasibility.

## Contracts and invariants

- Raw provider identifiers are replaced by approved pseudonymous references at
  the source boundary.
- Features use only facts available at or before the snapshot cutoff.
- Predictions contain recommendations, never executed actions.
- Outcome labels are later observations and never online features.
- Corrections create new revisions; historical facts are immutable.

## Verification and consequences

Positive and negative fixtures cover all six entities in
`apps/api/tests/test_proposed_canonical_domain.py`. Passing proves draft shape,
not approval or data fitness.

## Open questions and acceptance record

Provider mapping, categorical vocabularies, pseudonymisation, hashing,
retention and accepted feature subset remain open. Approvers: API/data and
security reviewers, unassigned. Approval: pending.
