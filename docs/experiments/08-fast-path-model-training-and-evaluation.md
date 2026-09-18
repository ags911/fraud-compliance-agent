# Experiment 08 — Fast-path model training and evaluation

Status: **Mechanics-only Sparkov evaluation complete — review pending; no promotion**  
Notebook: [08-fast-path-model-training-and-evaluation.ipynb](../../notebooks/08-fast-path-model-training-and-evaluation.ipynb)
Decision supported: Post-Phase-0 — candidate model release review

## Run context

- Date/time (UTC): 2026-09-18 (accepted mechanics-only Sparkov rerun after
  output-isolation and repository-relative path fixes)
- Git revision: `538651a7c3abec5daec3da9bbc7592e536bef348`. The artifact was
  regenerated in approved mode at 2026-09-18T22:15Z after a direct default-mode
  notebook run overwrote it with a synthetic report. Partition counts,
  prevalence, and all six headline metrics matched the earlier accepted run.
- Approved configuration/data revision: `model-training-contract.v1.json`, mechanics-only scope
- Data class: Sanitised evidence only; no raw provider records, identifiers, secrets, or model artifacts in Git

## Inputs and gate

- `docs/contracts/model-training-contract.v1.json`
- `docs/proposals/leakage-and-evaluation-design.proposed.json`

The accepted contract pins the ignored local Sparkov mechanics CSV by checksum,
declares four non-identifier features, chronological partitions, two reporting
slices, and a mechanics-only release boundary. It does not approve production
training, model serving, or payment authority.

## Findings

- A class-balanced Logistic Regression baseline and XGBoost candidate completed
  on the checksum-verified local Sparkov mechanics dataset.
- Chronological train/calibration/test counts were 1,037,340 / 259,335 /
  555,719. The held-out test prevalence was 0.386%.
- Held-out Sparkov mechanics metrics were: Logistic Regression PR-AUC 0.1354,
  ROC-AUC 0.8324, Brier 0.0889; XGBoost PR-AUC 0.4319, ROC-AUC 0.9789,
  Brier 0.0489.
- The harness generated aggregate metrics, slices, threshold sweeps, and five
  Plotly diagnostics (precision-recall, ROC, reliability, score distribution,
  and threshold trade-offs).
- No weights, source rows, identifiers, or action threshold were written.

## Limitations and unknowns

- Sparkov is simulated. Its labels, fraud scenarios, source-time semantics, and
  feature distribution cannot establish real-world fraud-model performance.
- The features intentionally exclude identifiers, personal/location data,
  unapproved history, and online-parity claims; this is not the eventual product
  feature contract.
- No probability-calibration method, operating threshold, runtime release, or
  payment authority was selected.

## Sanitised artifact

`docs/proposals/fast-path-model-release.candidate.json`  
Status: `candidate_evaluation_pending_review`  
Report payload SHA-256:
`ad479ad6cc123bfeda714c8afcf757d93ecc750a36cf00e44eba75753c092161`
(the hash covers the run timestamp and revision, so it differs from the earlier
run's `5403cfb9…` although the metrics are identical)

## Proposed next decision

No model decision or promotion. Preserve this report as benchmark mechanics
evidence only. A partner corpus, accepted point-in-time feature contract,
calibration method, production release criteria, and independent review remain
required before any model can be considered beyond this demonstration.

The proposed model strategy, data gates, and later monitoring plan are captured
in [the fast-path model technical specification](../proposals/FAST-PATH-FRAUD-MODEL-TECHNICAL-SPEC.md).
