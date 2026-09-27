# ADR-003 — Define Plaid mapping and feature feasibility

Status: Proposed  
Date: 2026-09-20  
Owner: Data/integration owner (unassigned)  
PRD revision/sections: Candidate v0.3, Sections 7.1–7.4 and 8  
Backlog task: P0-03  
Related decisions: ADR-002, ADR-004 and ADR-013  
Repository scope: Plaid Sandbox analysis, mapping and sanitised fixtures

## Context and decision to be made

The local Sandbox analysis observed useful provider fields but did not prove
canonical money, direction, precise event/availability time, transaction
revision or mature fraud labels. A runtime mapping cannot be inferred from a
successful `/transactions/sync` call.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Promote observed fields directly | Fast integration | Fabricates semantics and point-in-time guarantees |
| Accept only fields with explicit provider semantics and mark the rest unavailable | Truthful and testable | Fewer eligible features; requires lifecycle probes |
| Keep Plaid notebook-only permanently | Lowest data risk | Cannot support a future source integration |

## Proposed decision

Continue local, zero-retention Sandbox analysis. Treat the existing mapping and
feature-availability artifacts as candidates only. Require approved amount
sign/currency normalization, pending-to-posted identity, added/modified/removed
semantics, cursor recovery, availability time and pseudonymisation before a
runtime connector. Date-only values cannot create intraday features.

## Contracts and invariants

- Plaid supplies source facts and enrichment, not fraud labels or authority.
- Missing lookup results never substitute another transaction.
- Raw tokens, payloads and identifiers remain outside Git and notebook output.
- Sanitised fixtures state whether each field is observed, derived,
  unavailable or simulated.
- Legacy A–F relationships to S01–S08 remain unapproved characterisation.

## Verification and consequences

Future mapping tests cover credits/debits, date-only values, pending
replacement, modifications/removals, duplicate pages, account mismatch and
missing IDs. The proposed S01–S08 packet is synthetic; it is not derived from
retained provider rows.

## Open questions and acceptance record

Money/direction, correction identity, availability clocks, key management and
runtime retention remain open. Approvers: data/integration and security
reviewers, unassigned. Approval: pending.
