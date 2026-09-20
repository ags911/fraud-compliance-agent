# ADR-016 — Accept the public-showcase scenario fixtures

Status: Accepted  
Date: 2026-09-20  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3, Sections 8–9  
Backlog task: MVP 3 public-safe investigation fixtures  
Related decisions: ADR-006, ADR-014 and ADR-015  
Repository scope: Synthetic S01–S08 facts and MVP 3 investigation evidence

## Context

ADR-015 accepts the public-showcase HTTP and SSE shapes, but implementation
also needs canonical, synthetic scenario values. The proposed S01–S08 packet
already records the agreed scenario catalogue, routing boundaries, no-score
policy, tool budget and failure semantics. It was deliberately forbidden from
runtime use pending product approval.

The public investigation can exercise S01–S05 without a database: S01–S03
demonstrate visible deterministic bypass, S04 demonstrates the bounded evidence
path, and S05 demonstrates the deterministic incomplete path. S06–S08 carry
useful accepted facts and bypass boundaries, but their review conflict,
idempotency and replay behavior still depends on deferred operational contracts
and persistence.

## Decision

Accept `fixtures/s01-s08/scenarios.v1.json` as the sole canonical synthetic
fixture packet for the database-free public-showcase runtime.

Accept the existing illustrative amounts and facts unchanged. Add the exact S04
payee and device evidence already present in the accepted ADR-015 contract
example, and fix the recorded S04 tool sequence to those two distinct tools.
Every value is synthetic, illustrative and non-model-derived.

The showcase runtime may consume this fixture only through a validating loader.
The web app must receive contract events from the API rather than importing the
fixture. Notebook, Plaid, Sparkov and private-SDK data must never replace these
values implicitly.

## Scope boundary

- S01–S05 are ready to drive the MVP 3 public investigation behavior.
- S06–S08 facts and agent-bypass boundaries are accepted, but their operational
  review, idempotency and replay behavior remains deferred to F3–F6.
- The accepted S06 prerequisite still identifies the immutable recorded S04
  snapshot as required but not yet specified. Runtime code must not manufacture
  it or call the agent to create it.
- The third allowlisted tool, `get_account_activity_evidence`, has no accepted
  S04 evidence payload yet. Invoking it cannot invent a result; until separately
  accepted, it must take the stable `tool_failed` path. The recorded S04 path
  uses the two accepted tools.
- Legacy A–F relationships remain candidate comparisons only. No legacy mapping
  is accepted by this decision.
- No fixture contains a model score, threshold, authority result or payment
  action.

## Consequences

Implementation may now begin for the validating fixture loader, deterministic
S01–S05 routing, recorded S04 trace, and S05 outage trace. A future change to an
accepted value, evidence item, recorded tool sequence or scenario boundary
requires a version change, contract/evaluation review and compatible browser
evidence.

The repository still cannot claim S06–S08 operational execution, F3/F3a/F4
completion, provider fidelity, fraud performance, or payment authority.

## Verification

`apps/api/tests/test_f3_preparation_artifacts.py` validates exact S01–S08
coverage, acceptance metadata, the data boundary, tool/failure controls, S04
evidence and recorded sequence, S05 no-provider failure, deferred S06–S08
behavior, and the absence of scores or actions.

## Acceptance record

Decision revision: working tree, 2026-09-20  
Approver: Darren Gidado (product owner)  
Approval date: 2026-09-20  
Approved scope: Existing S01–S08 synthetic values plus accepted S04 payee/device
evidence for the database-free showcase boundary
