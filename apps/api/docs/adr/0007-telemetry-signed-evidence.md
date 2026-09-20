# ADR-007 — Separate operational telemetry from signed evidence

Status: Proposed  
Date: 2026-09-20  
Owner: SDK/governance owner (unassigned)  
PRD revision/sections: Candidate v0.3, Sections 5–6 and 10–11  
Backlog task: P0-06  
Related decisions: ADR-006, ADR-008 and ADR-009  
Repository scope: Operational events and Arbiris delivery

## Context and decision to be made

Not every log or progress event is material signed evidence, and not every
signed record is operational state. Treating one as the other would either lose
operational facts or overstate governance evidence.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Sign every event | Superficially complete | High noise/cost and false governance meaning |
| Keep everything only in logs | Simple | Loses material accountability and durable linkage |
| Classify operational telemetry and material evidence separately | Truthful ownership and retention | Requires mapping and delivery-state contracts |

## Proposed decision

Store run progress, retries, health and diagnostics as operational telemetry.
Map material recommendation, authority, review, action and policy/model-release
events to supported signed records or linked artifacts. Persist delivery state
and linked record IDs operationally; Arbiris owns signing and generic evidence
storage. A failed delivery remains pending/failed and never changes the
underlying operational fact.

## Contracts and invariants

- Signed fields use supported SDK structures and round-trip without loss.
- Raw provider errors, secrets, personal data and hidden reasoning are excluded.
- Correlation, policy/model/feature versions and actor references retain
  provenance.
- Demo signatures are labelled as demo signatures, not accountable attestation.

## Verification and consequences

Future tests cover schema round-trip, signature verification/tampering,
unsupported versions, redaction, retry and action-committed/evidence-pending.
No evidence pack is assembled in this application.

## Open questions and acceptance record

Material-event inventory, retention, delivery protocol and supported extension
fields remain open. Approvers: SDK/governance, security and API owners,
unassigned. Approval: pending.
