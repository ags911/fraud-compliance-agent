# Experiment 08 — Fast-path model training and evaluation

Status: **Mechanics-only Sparkov evaluation complete — review pending; no promotion.** A proposed richer-feature experiment (section 7 of the notebook) is recorded below and is separate from it.  
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

## Richer-feature candidate v2 (proposed, 2026-09-22)

Question: can richer point-in-time features, selected without touching the test
partition, lift the Sparkov benchmark, and do the model-fit checks show a genuine
result? This is a proposal. It does not amend the accepted v1 contract, replace
its reviewed report, or approve any feature for runtime. Notebook 08 section 7
runs it, opt-in through `FCA_NOTEBOOK08_RICHER=run`, over the new
`modelling.richer_features` and `modelling.richer_benchmark` modules, with
parameters in `config/fast-path-model-richer-features.v2.candidate.json`.

Method:

- Partitions identical to v1 (train 1,037,340 / calibration 259,335 / test
  555,719), asserted against those counts on every run.
- 33 features, each built only from earlier rows: amount and time-of-day
  fields, merchant category, the amount against the card's own history, card
  velocity and timing (counts and amount sums over 1 hour, 1 day and 7 days, and
  time since the previous transaction), and merchant and card familiarity. No
  label-derived feature, no name, address, coordinate, date of birth or job.
- Model selection on the first chronological half of the calibration partition
  only (four XGBoost settings, early stopping); isotonic calibration on the
  second half; the test partition scored once, afterwards.

Results (held-out test, 2,145 positives, prevalence 0.386%):

| Model | PR-AUC | ROC-AUC |
| --- | --- | --- |
| v1 XGBoost, four features (accepted report) | 0.432 | 0.979 |
| Same four features, tuned with early stopping | 0.437 | 0.976 |
| Category added | 0.785 | 0.996 |
| Amount-versus-card-history added | 0.840 | 0.996 |
| Card velocity and timing added | 0.963 | 0.999 |
| Familiarity added (all 33 features, chosen model) | **0.961** | **0.9992** |

Recall is 94.5% at a 0.1% false-positive rate and 98.9% at 1%. These are
rank-based summaries; no score threshold was chosen.

Model-fit checks:

- **Leakage control.** The same pipeline trained on shuffled labels scores
  PR-AUC 0.0039 (the base rate) and ROC-AUC 0.455, so nothing in the pipeline's
  structure leaks the answer.
- **Over- and under-fitting.** Not underfit. Train PR-AUC is 1.000, against
  0.981 on the selection rows, 0.981 on the calibration-fit rows and 0.961 on
  test: mild overfitting with a further drop on a later period. The learning
  curve on the selection rows is flat after about 330 trees.
- **Stability.** Monthly test PR-AUC stays between 0.939 and 0.973 across
  June to December 2020, with no collapse. December is lowest, and has the
  lowest fraud rate.
- **Where the gain comes from.** Tuning alone changed nothing (0.432 to 0.437);
  the features did all of it. Category and card velocity and timing carry the
  gain, and importance is led by amount (30%), the category indicators (44%
  together) and the 1-day and 1-hour amount sums (11%). Familiarity adds nothing
  measurable: without it, the remaining 30 features score 0.963. Amount-versus-
  history adds a lot before the velocity features exist (0.785 to 0.840) but only
  about 0.006 after them (0.955 without it, against 0.961), so it is largely
  redundant with velocity.
- **Calibration.** Isotonic calibration moves the Brier score from 0.00055 to
  0.00054 and worsens log loss (0.00225 to 0.00238), so it is not a demonstrated
  improvement. The top score bin over-predicts (0.71 predicted against 0.68
  observed), and the fraud rate falls from 0.58% in train to 0.39% in test.

Verdict: the score is a real result of the pipeline and not a leak, but it is a
result on simulated data. The controls above cannot detect an artefact of the
simulator, and category and amount carry much of the signal, which is what a
generator that draws fraud from fixed patterns would produce. It shows the model
can learn Sparkov's patterns. It does not show how it would perform on real
fraud.

Limitations and unknowns:

- The card velocity features need online streaming aggregates over one card's
  recent activity. Their online equivalent, latency and parity are not
  established, and the technical specification requires one for every feature.
- One seed and one time split; the test period has only 2,145 positives.
- No threshold, recalibration process or promotion criterion has been approved.

Reproduction and integrity: the run is deterministic. Running the notebook
section reproduced an earlier standalone run exactly (metrics, checks and
selection). The recorded revision is the commit that preceded the one carrying
the report. `test_modelling_richer_benchmark.py` fails if the config changes
without the report being regenerated, or if the report is edited by hand.

Proposed report: `docs/proposals/fast-path-model-richer-features.proposed.json`
(status `proposed`, payload SHA-256
`9a64887bbf4c409b12828bcc94d784ccbdaf96cf5cf76957091441a4efa10247`).

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

No model decision or promotion, for either version.

For v2, the decision is whether to accept a v2 training contract, which needs the
online availability of each feature confirmed first. The 30-feature set without
the familiarity group scores the same as all 33 and is the smaller thing to
review.

For v1: preserve this report as benchmark mechanics
evidence only. A partner corpus, accepted point-in-time feature contract,
calibration method, production release criteria, and independent review remain
required before any model can be considered beyond this demonstration.

The proposed model strategy, data gates, and later monitoring plan are captured
in [the fast-path model technical specification](../proposals/fast-path-fraud-model-technical-spec.md).
