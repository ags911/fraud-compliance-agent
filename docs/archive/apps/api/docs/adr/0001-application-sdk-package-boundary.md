# ADR-001 — Define the application, SDK and package boundary

Status: Proposed  
Date: 2026-09-20  
Owner: Technical owner (unassigned)  
PRD revision/sections: Candidate v0.3, Sections 1, 9, 10 and 14  
Backlog task: P0-08  
Related decisions: ADR-012, ADR-013 and ADR-014  
Repository scope: API, private SDK integration and public container

## Context and decision to be made

The current demo imports a teaching example from the pinned private Arbiris SDK.
The public container deliberately excludes that SDK, so its live-run endpoints
return an unavailable response. F3 needs an owned application boundary without
moving generic Arbiris governance capabilities into this repository.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Keep importing the SDK example | No migration work | Private, not packaged, and leaves application behavior owned by an example |
| Move fraud orchestration into this API behind owned ports; consume only packaged SDK interfaces | Clear ownership and public-safe substitution point | Requires characterisation and compatibility tests |
| Copy SDK implementation into this repository | Immediate control | Forks private code and blurs ownership; rejected |

## Proposed decision

Own fraud-domain orchestration, contracts, persistence and provider ports in
`apps/api`. Consume the pinned SDK only through packaged, versioned interfaces
for signing/governance delivery. Retain its example as a characterised legacy
reference, not a production import. Keep the SDK outside the public image. Per
ADR-014, the planned public investigation is repository-owned and SDK-free;
its detailed contracts and tests remain pending.

## Contracts and invariants

- Web code consumes accepted API contracts only.
- API domain code does not import `vendor/.../examples` after migration.
- Arbiris owns generic signing, governance storage and evidence-pack behavior;
  this app owns fraud operational facts and review execution.
- A missing SDK yields a stable unavailable state, never a silent substitute.

## Verification and consequences

Future boundary tests must reject imports from SDK examples, verify the pinned
package version and exercise the unavailable adapter. This proposal does not
authorise the migration or public SDK distribution.

## Open questions and acceptance record

The application/package interfaces, signing adapter boundary and migration
evidence remain open. Public distribution of the private SDK is no longer the
selected showcase path. Approvers: technical owner and SDK owner, unassigned.
Approval: pending.
