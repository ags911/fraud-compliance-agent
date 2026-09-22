# ADR-010 — Define identity, roles, tenancy and deployment controls

Status: Proposed  
Date: 2026-09-20  
Owner: Security/technical owner (unassigned)  
PRD revision/sections: Candidate v0.3, FR-08 and Sections 10, 13–14  
Backlog task: P0-08  
Related decisions: ADR-001, ADR-006, ADR-009, ADR-013 and ADR-014  
Repository scope: Operational identity and authorization

## Context and decision to be made

The current showcase is unauthenticated and single-operator. Every exposed
mutable operational endpoint needs server-derived actor, scope and permission;
client-side hiding or a submitted reviewer ID is not authorization.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Select an auth vendor immediately | Fast concrete integration | Premature without tenancy/role contract or Azure credentials |
| Provider-neutral actor contract plus local test adapter | Contract-first and testable | Vendor selection remains later work |
| Keep anonymous operational mutations | Minimal setup | Unsafe and prohibited |

## Proposed decision

Adopt the provider-neutral actor and role outline in
[`f3-identity-authorization.proposed.md`](../../../../docs/proposals/f3-identity-authorization.proposed.md).
Use explicit synthetic identities only in local/test configuration and fail
startup if that bypass is enabled in a deployed environment. Protect sensitive
reads as well as writes. Defer authentication-provider selection until
single-firm/multi-tenant scope and claims are approved.

## Contracts and invariants

- The server derives actor, tenant/firm and roles from verified identity.
- Submitted actor/reviewer/firm fields are never authoritative.
- Reviewer assignment and record access are server-enforced.
- Administrator does not automatically satisfy independent-review duties.
- Model promotion and configuration are separately privileged operations.
- ADR-014's bounded MVP 3 agent remains unauthenticated only because recorded
  playback is the public default and live provider access is limited to a
  controlled operator-enabled window. It exposes no durable or review mutation.
  Authentication remains mandatory before later non-local operational
  mutations or always-on user-specific access.

## Verification and consequences

Future tests cover allow/deny, missing identity, spoofing, cross-scope access,
stale authorization and deployed-bypass refusal. This proposal does not add
production SSO or claim tenant isolation.

## Open questions and acceptance record

Authentication provider, token/credential types, v1 tenancy, claim mappings,
revocation and service identity remain open. Approvers: security and technical
owners, unassigned. Approval: pending.
