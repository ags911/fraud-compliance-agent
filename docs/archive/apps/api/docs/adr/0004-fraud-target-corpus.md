# ADR-004 — Select the fraud target and corpus

Status: Proposed  
Date: 2026-09-20  
Owner: Data/ML owner (unassigned)  
PRD revision/sections: Candidate v0.3, Sections 7.2–7.4  
Backlog task: P0-04  
Related decisions: ADR-002, ADR-003 and ADR-005  
Repository scope: Model target, label policy and corpus eligibility

## Context and decision to be made

F3a requires a score with a precise target and mature labels. Plaid Sandbox has
no fraud labels. Sparkov contains simulated labels suitable only for mechanics
evaluation. Unauthorized fraud and APP scam risk must not be conflated.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Use Sparkov as runtime training data | Available mechanics harness | Cannot support provider parity or production-performance claims; rejected |
| Use Plaid Sandbox outcomes | Matches integration source | No independent fraud labels; rejected |
| Select a licensed corpus with mature unauthorized-fraud labels and retain APP controls separately | Defensible target and evaluation path | Requires external access, provenance and label review |
| Keep F3 deterministic-only | Safe and immediately testable | F3a remains blocked |

## Proposed decision

Keep F3 deterministic-only until a licensed corpus with mature labels,
availability timestamps, temporal coverage and compatible features is approved.
The leading target candidate is unauthorized fraud; APP risk remains an
independent deterministic safety policy unless separately supported by an
approved target/corpus.

## Contracts and invariants

- Positive, negative and unknown labels have explicit provenance and maturity.
- Unlabelled, released or reviewer-approved records are not automatically
  negative.
- Label availability follows the historical cutoff used for training/evaluation.
- Source licences and access routes are recorded; raw data remains outside Git.

## Verification and consequences

A corpus decision needs a sample-schema feasibility check, feature overlap,
label-maturity analysis, temporal partition plan and bias/selection-limit
record. Until then, F3a cannot release or serve a model.

## Open questions and acceptance record

Target, corpus, access, licence, mature-label horizon and minimum usable cohorts
remain open. Approver: data/ML reviewer, unassigned. Approval: pending.
