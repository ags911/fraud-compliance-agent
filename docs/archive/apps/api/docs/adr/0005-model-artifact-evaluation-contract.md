# ADR-005 — Define the model artifact and evaluation contract

Status: Proposed  
Date: 2026-09-20  
Owner: Data/ML owner (unassigned)  
PRD revision/sections: Candidate v0.3, Sections 7.2, 9.2 and 10  
Backlog task: P0-04  
Related decisions: ADR-004, ADR-006 and ADR-011  
Repository scope: Evaluation, calibration, release and rollback

## Context and decision to be made

The repository has a reproducible Logistic Regression/XGBoost mechanics
harness, but it selects no production target, threshold, calibration method or
runtime artifact. F3a requires an independently approved release contract.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Promote the current Sparkov candidate | Existing metrics and code | Mechanics-only evidence; prohibited as runtime release |
| Freeze evaluation after ADR-004 and compare benchmark/candidate on temporal data | Auditable selection | Requires corpus, labels and release ownership |
| Use a deterministic scorer indefinitely | No model risk | Does not complete F3a |

## Proposed decision

After ADR-004, freeze chronological train, calibration/selection and untouched
test partitions; feature/encoder versions; calibration method; required
metrics/slices; threshold-selection protocol; artifact checksum; compatibility;
rollback; and release approver. Keep score quality separate from routing policy.
XGBoost remains a candidate and Logistic Regression the transparent benchmark,
not a predetermined winner.

## Contracts and invariants

- Final-test results never tune the model, calibration or threshold.
- Raw versus calibrated scores and every threshold meaning are explicit.
- Runtime predictions record model, feature and policy versions.
- Artifact loading fails closed on checksum or compatibility mismatch.
- Promotion is a privileged mutation and no model independently acts.

## Verification and consequences

Future tests cover deterministic artifact loading, checksum refusal,
online/offline feature parity, calibration, untouched-test evaluation,
promotion race and rollback. Current benchmark tests remain mechanics-only.

## Open questions and acceptance record

All numerical criteria, threshold/review capacity, artifact store, release
owner and rollback mechanism remain open. Approval: pending data/ML and
security review.
