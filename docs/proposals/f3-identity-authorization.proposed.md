# F3 identity and authorization — proposed decision outline

Status: **Proposed; provider-neutral and local-test-only**  
Version: `0.1-proposed`  
Decision boundary: [ADR-013](../../apps/api/docs/adr/0013-adopt-local-first-f3-boundaries.md)  
Backlog alignment: P0-08 / future ADR-010

## Selected direction

Define identity and authorization independently from an authentication vendor.
Local tests may inject explicit synthetic identities through a test-only
adapter. No deployed environment may enable that adapter, and no browser field
may establish authoritative actor, reviewer, role, tenant or firm context.

## Proposed actor context

The server-owned context must eventually contain an opaque actor identifier,
tenant/firm scope where applicable, authenticated roles, authentication method,
session/request correlation and the time at which authorization was evaluated.
None of those values are accepted merely because they appear in a request body.

## Proposed roles and minimum boundaries

| Role | Candidate capability | Must not imply |
| --- | --- | --- |
| `scorer_operator` | Submit permitted score/process requests and read permitted operational results | Review authority, policy change or model promotion |
| `fraud_reviewer` | Claim and decide eligible review records within server scope | Authority to bypass non-overridable policy or act outside assignment |
| `model_approver` | Review future model-release evidence and perform an expressly contracted promotion mutation | Payment-action authority or permission to edit evaluation evidence |
| `administrator` | Manage expressly contracted configuration and access | Automatic qualification as an independent fraud reviewer |

Sensitive reads require authorization as well as mutations. Client-side hiding
is presentation only and never enforcement.

## Local test identity boundary

- Enabled only by an explicit test/local configuration value.
- Startup fails if the bypass is enabled in a deployed/public environment.
- Identities are synthetic, fixed and visible in test evidence.
- Tests cover missing identity, insufficient role, spoofed submitted identity,
  cross-scope access and deployed-bypass refusal.

## Decisions still required before acceptance

- Single-firm versus multi-tenant v1 scope.
- Authentication provider and accepted token/credential types.
- Authoritative claim-to-role and claim-to-tenant mapping.
- Role-by-operation matrix, protected-read inventory and separation-of-duty
  rules.
- Session expiry, revocation, audit fields and service-to-service identity.

## Future verification gate

Acceptance requires a complete operation/role matrix and tests for allow,
deny, missing identity, spoofing, cross-scope access, stale authorization and
the impossibility of enabling the local bypass in deployed configuration.
