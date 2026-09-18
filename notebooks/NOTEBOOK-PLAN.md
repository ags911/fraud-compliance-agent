# Phase 0 notebook plan

Status: **Proposed**  
Scope: P0-03 (Plaid mapping and feature feasibility), P0-04 (target/corpus and
evaluation design), plus post-Phase-0 model and investigation evaluation  
Last updated: 2026-09-16

## Purpose

These notebooks answer data and evaluation questions before any production
ingestion, model training, or runtime migration. They are evidence for Phase 0
decisions—not a substitute for accepted contracts or an implementation plan.

The proposed model strategy, data requirements, and current implementation
status are maintained in
[the fast-path model technical specification](../docs/proposals/FAST-PATH-FRAUD-MODEL-TECHNICAL-SPEC.md).

Each notebook must have one clear question, record its Git/config revision in
an experiment record, clear outputs before commit, and produce only sanitised,
reviewable artifacts. Raw Plaid responses, access tokens, account IDs, customer
identifiers, and model artifacts never enter Git.

## Order and decision gates

| # | Notebook | Question answered | Inputs | Sanitised output | Gate |
| --- | --- | --- | --- | --- | --- |
| 01 | `01-plaid-sandbox-source-inventory.ipynb` | Which transaction/source fields and timestamp precisions are actually available in the selected Plaid Sandbox flow? | Local Doppler-backed `apps/api/.env`; documented Sandbox calls | Field inventory, source-revision observations, secure run manifest | Enables 02–04; does not approve a mapping |
| 02 | `02-plaid-sandbox-lifecycle-probes.ipynb` | How do added, modified, removed, pending, posted, duplicate, and missing-ID cases behave or fail in this Sandbox flow? | Local-only Sandbox probes; no funded or production account | Lifecycle observation table and unsupported/unknown cases | Inputs to ADR-003 and canonical correction semantics |
| 03 | `03-plaid-to-canonical-mapping.ipynb` | How does each observed field map to the proposed `SourceEvent` and `CanonicalTransaction` draft? | Outputs from 01–02, canonical draft | Mapping table, redacted examples, candidate fixture manifest | P0-03 mapping review |
| 04 | `04-feature-availability-matrix.ipynb` | Which proposed features are observed, derivable, unavailable, or simulated across Plaid, legacy A–F, target scenarios, replay, and a candidate corpus? | Mapping result, legacy scenario characterisation, corpus schema metadata only | Feature-availability matrix and explicit exclusions | P0-03/P0-04 joint decision |
| 05 | `05-enrichment-pipeline-prototype.ipynb` | Can observed canonical records be transformed into a point-in-time-safe, reproducible feature snapshot without creating a runtime dependency? | Approved mapping candidate, feature-availability matrix, sanitised local probes | Enrichment specification, transformation manifest, feature snapshot examples, explicit unknowns | Required before corpus/label feasibility |
| 06 | `06-corpus-and-label-feasibility.ipynb` | Does each candidate training corpus support the selected prediction unit, label maturity, temporal split, and minimum feature subset? | Licensed/approved corpus schema and small sanitised sample where permitted | Candidate comparison, label policy, data-access decision record | ADR-004/005 input; no training. Sparkov is the proposed research/demo candidate, not an approval. |
| 07 | `07-leakage-and-evaluation-design.ipynb` | Can the chosen source support leakage-safe train/calibration/test partitions and meaningful evaluation? | Approved sample/schema metadata and synthetic edge-case fixtures | Partition specification, leakage test cases, metric/report template | Blocks model implementation until accepted |
| 08 | `08-fast-path-model-training-and-evaluation.ipynb` | Do Logistic Regression and XGBoost improve the fast-path risk estimate under the frozen evaluation protocol, and does any approved challenger add material value? | Approved target, corpus, feature contract, partitions, and release criteria | Sanitised evaluation report, reproducibility manifest, candidate model-release record | Begins only after Phase 0 approval; no runtime promotion |
| 09 | `09-slow-path-investigation-evaluation.ipynb` | Does the constrained LLM/tool investigation produce safe, useful typed recommendations for eligible ambiguous or APP-risk cases? | Accepted eligibility contract, approved tools, fixed scenario suite, human-reviewed expected outcomes | Safety/quality/latency/cost evaluation report and candidate investigation release record | Begins only after the fast-path and investigation contracts are approved; no autonomous action |
| 10 | `10-model-monitoring-and-champion-challenger.ipynb` | Does the released candidate remain calibrated, useful, and operationally safe against delayed labels and a named challenger? | Accepted release artifact, monitoring contract, delayed labels, cohort definitions, and rollback criteria | Sanitised drift/champion-challenger report and retraining/rollback recommendation | Begins only after a separately accepted model release; never changes production automatically |

Notebooks 01–04 are the first workstream. Notebooks 01–02 have completed their
source observations; Notebook 03 has completed its sanitised proposal execution
and awaits review; Notebook 04 has a prepared proposal and awaits review.
Notebook 05 has a design-only proposal and may not move to API implementation
until the mapping and feature-availability work is accepted. Notebook 06 has a
Sparkov mechanics-only corpus proposal; the target, label maturity, and
evaluation protocol remain pending. Notebook 07 now has a proposed temporal
and leakage protocol based on sanitised Sparkov evidence; its target, cutpoints,
label treatment, feature schema, and release criteria remain pending review.
It may not claim model performance. Notebook 08 has completed one accepted
Sparkov **mechanics-only** evaluation; its report remains a non-production
candidate record and does not satisfy the production-data gate. Notebooks 09–10
are post-Phase-0 work and require
explicit approval of the required contracts, evaluation protocol, and next
scope.

## Notebook specifications

### 01 — Plaid Sandbox source inventory

**Goal:** establish facts, not a production connector.

- Load `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` from the ignored local
  environment only. Assert their presence without printing them.
- Make the smallest supported local Sandbox probe. Record API product/version,
  request type, response field paths, value types, nullability, and timestamp
  precision—not values.
- Write raw response material only to a secure local location outside Git. A
  run manifest contains a timestamp, Git commit, environment name, and a
  checksum/reference to secure material, but no credential or account data.
- Record every unavailable field or unsupported operation as `unavailable`, not
  as `false`, `0`, or a fabricated timestamp.

**Exit:** a field inventory ready for review; no committed data fixture yet.

### 02 — Plaid Sandbox lifecycle probes

**Goal:** validate event identity and correction assumptions before designing
replay or velocity features.

- Test only supported Sandbox behaviours. For each attempted state, capture
  whether it is observed, unsupported, or indeterminate in the current Sandbox.
- Examine sync cursor boundaries, duplicate-page replay, changed/removed facts,
  pending-to-posted relationships, missing transaction IDs, account mismatch,
  and date-only versus exact timestamps where available.
- Use an isolated local test item and immediately discard raw records after the
  sanitised summary is produced.

**Exit:** a lifecycle table that explicitly informs `source_revision`,
`available_at`, correction lineage, and replay limitations in ADR-003.

### 03 — Plaid-to-canonical mapping

**Goal:** turn observed provider facts into a proposed, reviewable mapping.

- Map each canonical field to one of: observed Plaid field, deterministic
  derivation, synthetic scenario-only value, or unavailable.
- State direction, money-unit, currency, account-scoping, category, timestamp
  precedence, and missingness treatment for every mapped field.
- Pseudonymise references before creating any example. Preserve the raw source
  only through a secure manifest reference.
- Build valid/invalid **candidate** fixture examples with the canonical draft;
  do not put them under accepted `docs/contracts/` or call them canonical yet.

**Exit:** proposed mapping table, redacted examples, and a fixture-manifest
candidate for P0-03 review.

### 04 — Feature-availability matrix

**Goal:** stop the product or model from claiming features absent from the data.

For every proposed v1 feature, compare Plaid, legacy A–F, S01–S08, replay, and
the candidate corpus. Record:

- availability: `observed`, `derivable`, `unavailable`, or `simulated`;
- source and transformation;
- point-in-time/freshness constraint;
- unknown/imputation policy owner; and
- whether the feature is permitted for online scoring, offline evaluation, both,
  or neither.

**Exit:** a proposed `feature-availability.md` artifact and explicit v1 feature
exclusions. It does not select a model.

### 05 — Enrichment pipeline prototype

**Goal:** prove how an eligible source fact becomes a point-in-time-safe feature
snapshot before assessing a training corpus or fitting a model.

- Transform only fields that Notebook 03 maps as observed or deterministic
  derivations and Notebook 04 permits. Preserve source/revision, `available_at`,
  transformation version, missingness, and synthetic-versus-observed provenance.
- Implement and test candidate enrichment for normalisation, merchant/category
  handling, account context, velocity aggregates, and missingness flags. Every
  aggregate must use facts available strictly before the decision time.
- For each feature, demonstrate historical backfill and online-equivalent
  calculation from the same named transformation; document any feature that
  cannot meet this parity as offline-only or excluded.
- Produce only sanitised feature snapshots and transformation manifests. Raw
  Plaid records, account IDs, and customer references remain outside Git.
- This is a feasibility prototype, not production ingestion or a runtime feature
  store. Reusable code moves to `apps/api` only after the mapping is accepted
  and receives API-owned tests.

**Exit:** a reviewable enrichment specification, point-in-time test cases, and
candidate feature-snapshot manifest that feed Notebook 06.

### 06 — Corpus and label feasibility

**Goal:** select a defensible training/evaluation source before any training.

- Compare only datasets with verified licence, access, temporal fields, label
  definition, and relevant schema coverage.
- The initial proposed research/demo candidate is the Sparkov simulated
  card-transaction corpus. Its controlled intake and limitations are recorded
  in [`sparkov-corpus-intake.proposed.md`](../docs/proposals/sparkov-corpus-intake.proposed.md).
  Verify source terms at acquisition time, keep its raw files in ignored local
  storage, and use `make corpus-sparkov-inspect` to produce sanitised schema
  evidence. It remains unsuitable for production-performance claims.
- Define the prediction unit and distinguish unauthorised-fraud labels, APP
  signals, operational recommendations, reviewer dispositions, and simulated
  outcomes.
- Record label maturity/availability time, exclusions, delayed outcomes,
  prevalence, and selection-bias risks.
- Keep public sample data out of Git unless its licence and sanitisation allow a
  tiny, reviewable sample; otherwise commit schema and secure manifest only.

**Exit:** a candidate corpus/target decision record. Synthetic labels generated
by existing rules must never be presented as independent model evidence.

### 07 — Leakage and evaluation design

**Goal:** define the test before choosing a model.

- Specify chronological train, calibration/selection, and untouched final-test
  partitions; calibration is disjoint from base-model fitting.
- Build synthetic edge-case fixtures for future events, late-known labels,
  duplicates, corrected transactions, and immature negatives.
- Define the report skeleton: cohort/slice coverage, prevalence, PR-AUC and
  ROC-AUC, precision, recall, false-positive rate, calibration, confidence
  intervals where feasible, review-capacity/cost assumptions, and no-label
  monitoring limitations.
- Separate score quality from the proposed action policy: evaluate the full
  threshold sweep and its precision/recall/false-positive trade-off before any
  human-approved threshold is selected. Report fraud-loss, false-decline, and
  review-cost assumptions separately; do not imply that a score alone has
  authority to block or approve a payment.
- Do not choose numeric risk thresholds or train a candidate model in Phase 0.

**Exit:** an approved evaluation protocol and leakage-test plan required before
future model implementation.

### 08 — Fast-path model training and evaluation

**Goal:** develop and evaluate the tabular risk model that may assist the
fast-path route for every eligible transaction.

- Use only the approved prediction target, corpus, feature subset, chronological
  partitions, calibration procedure, and evaluation criteria from notebooks
  04–07 and their accepted ADRs/contracts.
- Keep deterministic hard controls independent and ahead of the model. A model
  score must never bypass an APP signal, policy control, authority gate, or
  oversight requirement.
- Record feature schema hash, data manifest, code/config revision, random seed,
  model family, calibration artifact, cohort/slice results, PR-AUC, ROC-AUC,
  precision, recall, false-positive rate, calibration, threshold sweep,
  operational capacity/cost assumptions, and limitations.
- Compare against named baselines; do not claim that synthetic labels generated
  by existing rules prove independent model superiority.
- Start with Logistic Regression as the transparent benchmark and XGBoost as
  the initial non-linear tabular candidate. Add CatBoost/LightGBM only when the
  approved corpus makes a comparison meaningful; do not preselect a winner.
- Store candidate weights only in approved model/artifact storage, never Git.
  A notebook result is not a runtime promotion.

**Exit:** a reviewable candidate model-release record and reproducible
evaluation report. Promotion requires the separately approved release process,
rollback plan, artifact checksum, and contract version.

### 09 — Slow-path investigation evaluation

**Goal:** evaluate—not delegate—an LLM/tool investigation path for eligible
ambiguous or APP-risk cases.

- Use a fixed, versioned suite of S04/S05 and other approved investigation
  scenarios, with human-reviewed expected evidence and safe failure outcomes.
- Constrain the LLM to approved tools and a typed response schema. It may
  recommend a route and cite evidence factors; it cannot execute or authorise a
  payment action.
- Evaluate tool-selection correctness, typed-output validity, evidence
  completeness, refusal/safe-failure behaviour, prompt-injection resilience,
  latency, provider failure handling, and cost.
- Keep hidden reasoning and raw provider errors out of datasets, reports, and
  the operator console. Evaluate observable structured outputs and evidence
  summaries instead.
- Do not fine-tune, promote, or silently change an LLM/provider/model version
  from this notebook. Any such change needs a separate approved data, safety,
  and release decision.

**Exit:** a reviewable investigation-evaluation report and candidate release
record. It cannot approve autonomous action; authority, oversight, and review
remain independent runtime controls.

### 10 — Model monitoring and champion/challenger

**Goal:** define the evidence required after an accepted model release without
allowing automated retraining, promotion, or rollback.

- Compare the released champion with a named candidate only on approved delayed
  labels, frozen cohorts, and the declared monitoring window.
- Monitor data/feature drift, score distribution, calibration decay,
  precision/recall/false-positive-rate where labels have matured, review load,
  false-decline/fraud-loss assumptions, and online/offline feature parity.
- Define alert thresholds, investigation ownership, artifact lineage,
  retraining eligibility, and rollback criteria through an accepted monitoring
  contract. Do not infer or tune them in the notebook.
- Produce sanitised aggregate reports only. No notebook can deploy a model,
  alter a threshold, or change a production champion.

**Exit:** a reviewable monitoring and champion/challenger recommendation. Any
release, retraining, promotion, or rollback remains an independently authorised
operational decision.

## Common execution contract

Every notebook begins with:

1. Purpose, decision owner, status, and explicit non-goals.
2. Input sources, source/revision time boundary, and permitted data class.
3. Required local environment variables listed by **name only**.
4. Expected sanitized outputs and secure-storage references.
5. Reproduction command/environment plus the current Git revision.

Every notebook ends with:

1. Findings and limitations.
2. Availability/unknowns—not inferred values.
3. Links to generated proposal, fixture manifest, and experiment record.
4. A decision recommendation marked `proposed`; no notebook self-approves a
   contract, policy, or model.

## Output locations and promotion

| Output | Interim location | Promotion condition |
| --- | --- | --- |
| Mapping/lifecycle/feature report | `docs/proposals/` | Accepted ADR and Phase 0 review |
| Experiment record | `docs/experiments/` | Always retained, sanitised |
| Candidate fixture manifest | `fixtures/proposals/` | Accepted canonical contract and scenario mapping |
| Raw provider material | Secure local/managed storage outside Git | Never promoted to Git |
| Reusable validation/transformation code | Notebook first, then `apps/api` | Accepted mapping plus API tests |

## Definition of done for the notebook workstream

- Each notebook has run instructions and a completed experiment record.
- No committed output contains credentials, raw provider payloads, PII, or
  misleading model-performance claims.
- P0-03 produces an explicit mapping and feature-availability decision, with
  unsupported fields clearly visible.
- P0-04 produces a target/corpus and evaluation decision, or documents the
  unresolved blocker.
- Accepted results are converted into versioned contracts, fixtures, and tests;
  notebooks remain explanatory evidence rather than runtime dependencies.
- Post-Phase-0 notebooks 08–10 produce evaluation evidence only. A separately
  approved model/investigation release process is required before any runtime
  promotion.
