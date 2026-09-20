# ADR-011 — Define operational acceptance, errors, replay and versioning

Status: Proposed  
Date: 2026-09-20  
Owner: Test/technical owner (unassigned)  
PRD revision/sections: Candidate v0.3, Sections 6, 10–11  
Backlog task: P0-09  
Related decisions: ADR-002 through ADR-010 and ADR-012  
Repository scope: Operational contract freeze and Phase 0 gate

## Context and decision to be made

Independent proposals must converge into one implementable operational
contract set. ADR-012 freezes only the existing showcase surface and cannot be
silently extended into F3.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Extend demo contract in place | Fewer files | Conflates transient showcase and durable authenticated operations; rejected |
| Freeze a separate operational version after ADR-002–010 | Clear compatibility and migration | Requires complete gate packet and consumers |
| Implement first and generate contracts later | Fast initial coding | Allows semantics and clients to drift; rejected |

## Proposed decision

After ADR-002–010 acceptance, freeze separate versioned domain schemas,
operational OpenAPI and event contracts. Define redacted errors for validation,
identity/authorization, idempotency conflict, stale review, unavailable
dependency and evidence-pending states. Version replay as comparison-only and
make SSE reconnection reference durable event IDs. Map every PRD requirement to
an owner, artifact and deterministic or later-phase test in the proposed
acceptance matrix.

## Contracts and invariants

- Demo v1 remains compatible until its consumers migrate deliberately.
- Contract changes carry compatibility and migration decisions.
- Fixed test scores are test inputs, never performance evidence.
- No-label monitoring reports unavailable, not an invented false-positive rate.
- Latency results identify boundary, hardware, warmup, concurrency and sample
  count.

## Verification and consequences

The Phase 0 gate requires well-formed schemas, positive/negative fixtures,
contract drift tests, web consumer checks and recorded test results. PostgreSQL,
live-provider and model-release verification remain separately gated.

## Open questions and acceptance record

Exact API/event/errors, supported versions, deprecation window, performance
criteria and all upstream ADR approvals remain open. Approvers: product,
technical, data/ML and governance reviewers, not yet all assigned. Approval: pending.
