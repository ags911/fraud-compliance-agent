# ADR-013 — Adopt local-first boundaries for F3 preparation

Status: Accepted for F3 preparation only  
Date: 2026-09-20  
Owner: Product owner — Darren Gidado  
PRD revision/sections: Candidate v0.3, Sections 4–10 and 14  
Backlog tasks: P0-02, P0-07, P0-08 and P0-09  
Related decisions: ADR-012 remains authoritative for the current showcase API  
Repository scope: API proposals, synthetic fixtures and local development

## Context and evidence

F0–F2 are evidenced locally, while F3 remains blocked by an accepted
operational contract, persistence semantics and authentication. The current
showcase API is frozen separately by ADR-012 and must not be expanded by
implication. Plaid Sandbox is not labelled fraud data, Sparkov is mechanics-only
evaluation evidence, and the private Arbiris SDK is excluded from the public
container image.

The product owner approved the eight local-first preparation defaults on
2026-09-20 so review artifacts can progress without claiming that F3, F3a, a
runtime model, a provider connector or a public operational service exists.

## Decision

Adopt the following boundary for F3 preparation:

1. F3 remains local-first and synthetic until its operational contracts are
   accepted.
2. PostgreSQL is the proposed durable store and will run locally through
   containerised development tooling before any managed-cloud decision.
3. Identity and authorization remain provider-neutral. Explicit local test
   identities may exercise future tests; no deployed bypass is permitted.
4. The operational API will use a separate versioned contract. The accepted
   Phase 0 showcase contract remains unchanged.
5. The private Arbiris SDK remains local/private-only. A public live-run feature
   remains unavailable until a public-safe runtime is approved.
6. S01–S08 begin as proposed synthetic fixtures. They are not automatically
   equivalent to legacy scenarios A–F.
7. F3 may define a scoring port and deterministic test implementation. A
   released fraud model and Plaid source-to-score path remain F3a decisions.
8. Every outcome remains a recommendation or route. No real payment approval,
   release, block or execution is authorised.

This decision authorises preparation and review artifacts only. It does not
accept their detailed semantics or authorise operational endpoint, database,
authentication, model-serving, provider-ingestion or payment-action code.

## Constraints and invariants

- Accepted artifacts remain under `docs/contracts/`; drafts remain under
  `docs/proposals/` and proposed fixtures remain visibly marked.
- Current demo routes and consumers continue to follow ADR-012.
- Browser input never supplies authoritative actor, tenant, reviewer or firm
  identity.
- Missing source facts remain unavailable; they are not converted to zero,
  false or generic provider values.
- Model scores are non-authoritative. `PASS` never means `RELEASE`.
- Synthetic fixtures contain no provider payload, credential, personal data,
  runtime score or executed action.

## Verification

| Case/invariant | Expected result | Verification |
| --- | --- | --- |
| Draft scenario coverage | S01–S08 appear exactly once and have no A–F mapping | `apps/api/tests/test_f3_preparation_artifacts.py` |
| Draft lifecycle | Fixture status remains proposed and runtime consumption remains forbidden | Same test module |
| Model/action boundary | No fixture invents a model score or payment action | Same test module |
| Current showcase compatibility | ADR-012 contracts and API tests remain unchanged | `make api-test` |
| Document integrity | All relative proposal and ADR links resolve | `apps/api/tests/test_docs_links.py` |

## Consequences and ownership

F3 preparation can now proceed as a reviewable local packet without starting
F3 implementation. PostgreSQL, identity, API and fixture semantics still need
their own review and acceptance. F3 remains partially prepared and cannot be
marked complete. F3a remains not started.

The product owner owns scope. API/architecture, data/model and
security/governance reviewers remain unassigned; this ADR does not invent those
approvals.

## Open questions

- Exact operational request/response/event and compatibility semantics.
- PostgreSQL state transitions, uniqueness constraints, recovery and outbox
  design.
- Actor/tenant claims, role permissions and protected-read boundaries.
- Canonical money, timestamps, correction lineage and feature schema.
- Public-safe replacement or packaging decision for the private SDK.
- Approved model target, corpus, artifact, threshold and release process.

## Acceptance record

Decision revision: local-first F3 preparation boundary v1  
Approver: Darren Gidado, product owner  
Approval date: 2026-09-20  
Approved scope: the eight preparation defaults recorded in this ADR  
Supporting artifacts: F3 proposals and the then-proposed S01–S08 fixture packet
linked from `docs/proposals/README.md`; ADR-016 later accepts that packet for
the narrow database-free showcase boundary only.

## Subsequent decision

ADR-014, accepted for scoped preparation on 2026-09-20, selected a
repository-owned SDK-free investigation as the public-showcase replacement.
That decision does not change this ADR's local-first F3 boundary or approve the
replacement's unresolved runtime semantics.
