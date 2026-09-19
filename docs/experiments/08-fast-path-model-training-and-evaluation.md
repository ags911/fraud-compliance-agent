# Experiment 08 — Fast-path model training and evaluation

Status: **Mechanics-only Sparkov evaluation complete — review pending; no promotion**  
Notebook: [08-fast-path-model-training-and-evaluation.ipynb](../../notebooks/08-fast-path-model-training-and-evaluation.ipynb)
Decision supported: Post-Phase-0 — candidate model release review

## Run context

- Date/time (UTC): 2026-09-19T18:19Z (approved-mode rerun on the refactored
  harness; see "Harness refactor" below). The previous accepted run was
  2026-09-18T22:15Z.
- Git revision: `2807a06c893fc4ae28d32e7c125863b7a38317bd`. Unlike the earlier
  runs, whose recorded revision preceded the commit carrying the report, this is
  the commit that contains the harness that produced it: check it out, supply
  the checksum-pinned corpus, run approved mode, and every figure below is
  reproduced.
- Every metric, threshold-sweep row, and slice row is bit-for-bit identical to
  the 2026-09-18 artifact. Only the run timestamp, revision, the new
  `config_version` field, and the resulting payload digest changed.
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

## Harness refactor (2026-09-19)

The training and evaluation logic moved out of the notebook into
`apps/api/modelling/` (configuration, paths, datasets, features, training,
evaluation, diagnostics, report, pipeline), with parameters in
`config/fast-path-model-training.v1.json` and tests in
`apps/api/tests/test_modelling_*.py`. The notebook is now a thin runner.

- Behaviour is unchanged: on the synthetic fixture the refactored modules
  reproduce the previous notebook's evaluation output exactly, field for field,
  and the fixture itself is byte-identical.
- Approved mode was re-run through the refactored notebook against the
  checksum-verified local Sparkov mechanics CSV, and the committed report is the
  output of that run. All five diagnostics were built; figure display was
  suppressed, because a committed notebook carries no outputs either way. A dry run to a temporary path was compared against the
  2026-09-18 artifact first: all six headline metrics, both 19-row threshold
  sweeps, and both 19-row slice tables matched exactly, as did partition counts
  and prevalence.
- The report now records `config_version` in `run_context` alongside the
  revision and seed, so an artifact names the configuration file that produced
  it. That field is why the payload digest differs from `ad479ad6…` even though
  no metric changed.

## Limitations and unknowns

- Sparkov is simulated. Its labels, fraud scenarios, source-time semantics, and
  feature distribution cannot establish real-world fraud-model performance.
- The features intentionally exclude identifiers, personal/location data,
  unapproved history, and online-parity claims; this is not the eventual product
  feature contract.
- No probability-calibration method, operating threshold, runtime release, or
  payment authority was selected.
- The refactor adds tests, not evidence. Module tests run on a tiny fixed
  fixture and the synthetic mechanics fixture; they say nothing about fraud
  performance.

## Sanitised artifact

`docs/proposals/fast-path-model-release.candidate.json`  
Status: `candidate_evaluation_pending_review`  
Report payload SHA-256:
`38dec6a09a2046c18f05880b50ddc52696675283b5e4debe7e97717c307ad988`
(the hash covers the run timestamp, revision, and configuration version, so it
differs from the 2026-09-18 run's `ad479ad6…` and the earlier `5403cfb9…`
although the metrics are identical)

## Proposed next decision

No model decision or promotion. Preserve this report as benchmark mechanics
evidence only. A partner corpus, accepted point-in-time feature contract,
calibration method, production release criteria, and independent review remain
required before any model can be considered beyond this demonstration.

The proposed model strategy, data gates, and later monitoring plan are captured
in [the fast-path model technical specification](../proposals/fast-path-fraud-model-technical-spec.md).
