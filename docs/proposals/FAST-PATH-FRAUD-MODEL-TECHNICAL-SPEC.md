# Fast-path fraud model — proposed technical specification

Status: **Proposed — not an accepted model, data, or release decision**  
Version: 0.1  
Last updated: 2026-09-16  
Decision owners: Product, API/architecture, and data/ML reviewers (unassigned)

## Purpose and authority

This is the durable technical record of the intended fast-path model work. It
consolidates the current implementation, intended comparison strategy, data
requirements, notebook sequence, and open decisions. It does **not** approve a
model family, corpus, target, threshold, route, or runtime deployment.

It is subordinate to an accepted PRD and accepted API/data contracts. Until
then, it is a proposal that prevents the current prototype from being mistaken
for a real fraud model.

## Product and safety boundary

The fast path is a risk-recommendation component in this flow:

~~~
versioned provider facts
  → point-in-time feature snapshot
  → deterministic fraud and APP controls
  → calibrated tabular model score
  → PASS / CHALLENGE / HOLD recommendation
  → independent authority, oversight, review, and simulated action
~~~

- Deterministic fraud and APP controls run first and cannot be bypassed by a
  low model score.
- The model can estimate risk only. It cannot approve, challenge, hold, release,
  block, or execute a payment.
- A model threshold is a policy/oversight decision, not a notebook default.
- The first product remains a provider-neutral, synthetic demonstration. It
  makes no production fraud-performance claim.

## Proposed model-comparison strategy

| Role | Proposed model | Reason | Status |
| --- | --- | --- | --- |
| Transparent benchmark | Class-balanced Logistic Regression | Establish whether non-linear complexity earns its operational cost; supports a simple explanation baseline. | Implemented in Notebook 08 harness only |
| Primary tabular candidate | XGBoost binary classifier | Gradient-boosted trees are a strong, practical first choice for structured transaction features and non-linear interactions. | Implemented in Notebook 08 harness only |
| Deferred challenger | CatBoost and/or LightGBM | Evaluate only if the approved corpus contains suitable categorical/cardinality characteristics or scale requirements. | Not implemented |
| Deferred research track | Graph and deep-learning models | Consider only if approved data demonstrates sufficient entity-link/network scale and a material benefit over tabular models. | Out of scope for the initial model decision |

Random Forest is **not** the selected candidate. It was briefly used as a
mechanics comparison before the XGBoost decision and has been removed from
Notebook 08.

XGBoost is the intended first serious candidate, not a presumed winner. The
winning model must outperform the Logistic Regression benchmark and any
approved challenger on the frozen temporal protocol, calibration, relevant
slices, false-positive cost, recall, and review capacity. Accuracy alone is
not a selection criterion.

### Why this is the proposed starting point

Payment-risk inputs are expected to be tabular and heterogeneous: transaction
amount, time/velocity aggregates, account/payee history, categories, and
future approved provider signals. Gradient boosting is a suitable first
comparison family for such data; XGBoost is an established scalable tree
boosting implementation. [Chen & Guestrin, 2016](https://doi.org/10.1145/2939672.2939785)

This does not mean that a tree model is universally best. Stripe notes that
traditional linear and tree-based approaches can be suitable for industrial ML,
while the payoff for neural networks depends on very large-scale data and
infrastructure. [Stripe fraud-ML guide](https://stripe.com/guides/primer-on-machine-learning-for-fraud-protection)

## Data, labels, and feature requirements

### Where real model data comes from

The notebooks do not create a real training corpus. The required path is:

~~~
approved provider/corpus source
  → secure data pipeline outside Git
  → canonical mapping and point-in-time feature transformation
  → approved, versioned local dataset / secure artifact reference
  → Notebook 08 evaluation
  → candidate artifact store and API integration only after release approval
~~~

Plaid Sandbox observations are integration evidence only. They are not labelled
fraud data and must not silently become the training corpus. Raw provider
payloads, identifiers, secrets, labels, and model weights remain outside Git.

### Proposed interim benchmark

The first proposed research/demo corpus is the Sparkov simulated card-transaction
dataset. Its controlled local intake, intended use, schema mapping, and limits
are recorded in [the Sparkov corpus intake proposal](sparkov-corpus-intake.proposed.md).
It can demonstrate reproducible pipeline mechanics only. It cannot validate
production performance, feature parity, thresholds, or runtime model behaviour.

### Required decisions before real training

1. Define the prediction unit and target: unauthorised fraud, APP risk, or
   another tightly scoped target. These labels must not be conflated.
2. Select a licensed/approved corpus with verified access, temporal fields,
   label definition, maturity/availability time, prevalence, and known
   selection bias.
3. Freeze the canonical and point-in-time feature contract. Every offline
   feature must have an online-equivalent computation or be excluded.
4. Define chronological train, calibration/selection, and untouched final-test
   partitions. Calibration is disjoint from base-model fitting.
5. Freeze release criteria, relevant cohort/slice definitions, fraud-loss,
   false-decline, and review-cost assumptions.
6. Record the dataset checksum, feature-schema hash, transformation version,
   code/config revision, random seed, and contract version.

No minimum production sample count is set yet. A defensible requirement must be
based on the chosen target prevalence, number of mature positive labels,
temporal test cohorts, and the precision/recall confidence needed for the
proposed policy. A generic row-count target would be misleading.

### Current synthetic fixture

Notebook 08's out-of-the-box demonstration uses **900 synthetic records**:

| Partition | Records | Use |
| --- | ---: | --- |
| Train | 540 | Fits the Logistic Regression and XGBoost comparison models |
| Calibration | 180 | Reserved; no synthetic calibration procedure is claimed |
| Test | 180 | Aggregate metrics and Plotly diagnostics |

These labels are generated from a rule-shaped formula to test software
mechanics. They are not fraud evidence, a training corpus, a sample-size
recommendation, or a release basis.

## Evaluation and model selection

The selection report must include:

- PR-AUC and ROC-AUC;
- calibration/reliability and Brier score;
- precision, recall, false-positive rate, and score-at-or-above-threshold rate
  across a threshold sweep;
- temporal/cohort/slice results, prevalence, confidence intervals where
  feasible, and limitations;
- operational review capacity plus fraud-loss and false-decline cost
  assumptions; and
- online/offline feature parity, latency measurement boundary, and a rollback
  plan.

The score-quality report and action policy remain separate. A charted threshold
is not selected until the authorised policy/oversight decision records it.

## Current implementation status

| Capability | State |
| --- | --- |
| Logistic Regression and XGBoost comparison harness | Implemented in Notebook 08 |
| Default demonstration | Implemented: synthetic mode renders the full diagnostic set, with visible non-evidence labelling |
| Approved-data gate | Implemented: requires an accepted checksum-verified local CSV and model-training contract |
| Mechanics-only Sparkov contract and adapter | Implemented: accepted local benchmark contract with a checksum-verified, ignored feature CSV; explicitly not production data or a runtime release |
| Plotly diagnostics | Implemented: PR, ROC, reliability, score distribution, and threshold trade-off charts |
| Production target/corpus/features/partitions/calibration | Not implemented; Sparkov mechanics-only evidence does not satisfy this requirement |
| CatBoost/LightGBM challenger | Not implemented |
| Model artifact registry, serving, or runtime scoring | Not implemented |
| Monitoring/champion-challenger notebook scaffold | Implemented as Notebook 10; remains gated on an accepted release, monitoring contract, delayed labels, cohorts, and rollback criteria |
| Production model release | Not implemented and not authorised |

The API's existing demo routes and legacy scenarios are not a deployed model
service. Candidate model packages exist only in the API development environment
to support reproducible notebook work.

## Delivery sequence

1. **Notebook 03:** proposed Plaid-to-canonical mapping.
2. **Notebook 04:** feature-availability matrix and explicit exclusions.
3. **Notebook 05:** point-in-time enrichment and online/offline parity proof.
4. **Notebook 06:** corpus and label feasibility decision.
5. **Notebook 07:** leakage-safe temporal evaluation protocol.
6. **Contract/ADR review:** accept the target, corpus, feature schema,
   partitions, calibration procedure, and release criteria.
7. **Notebook 08:** evaluate Logistic Regression and XGBoost on the approved
   corpus; add a CatBoost/LightGBM challenger only if justified.
8. **Independent release review:** validate artifact storage/checksum, parity,
   monitoring, rollback, and policy/authority boundaries.
9. **API implementation:** only after approval, load the signed/checked
   candidate artifact behind deterministic controls and contract tests.
10. **Notebook 10:** post-release monitoring and champion/challenger evidence;
    the gated scaffold exists, but no monitoring capability or runtime action is
    implemented.

## Notebook responsibilities

| Notebook | Model-work responsibility |
| --- | --- |
| 03–05 | Make source facts and derived features reviewable and point-in-time safe. |
| 06 | Decide whether a corpus and label are defensible. |
| 07 | Freeze the evaluation protocol before model comparison. |
| 08 | Compare named tabular models and produce candidate evidence only. |
| 09 | Evaluate bounded slow-path investigation independently of the fast-path score. |
| 10 | Define drift, delayed-label performance, calibration decay, champion/challenger, retraining, and rollback evidence. The scaffold is gated; it is not a monitoring service. |

Deterministic controls, scenario fixtures, contracts, API scoring, and
production monitoring implementation belong in versioned contracts and tested
API code—not in exploratory notebooks.

## Open decisions

- Which target is in scope, and how are mature labels obtained?
- Which corpus and provider data may be used under licence/privacy constraints?
- Which features are approved, including treatment of unavailable device, IP,
  payee, or history signals?
- What are the calibrated policy boundaries and authority/oversight rules?
- Which model challenger, if any, is justified by the approved data?
- What artifact store, release process, monitoring metrics, and rollback
  mechanism are accepted?

## Related artifacts

- [Candidate PRD](../product/prd.md)
- [Active showcase delivery plan](../product/implementation-plan.md)
- [Notebook plan](../../notebooks/NOTEBOOK-PLAN.md)
- [Notebook 08 experiment record](../experiments/08-fast-path-model-training-and-evaluation.md)
