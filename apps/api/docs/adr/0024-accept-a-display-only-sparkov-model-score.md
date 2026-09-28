# ADR-024 — Accept a display only Sparkov model score on feed cases

Status: Accepted  
Date: 2026-09-28  
Owner: Darren Gidado (product owner)  
PRD revision/sections: retired v0.3; `context/` is canonical  
Backlog task: F3a, spec 0004 slice 3 (AC-11 to AC-15)  
Related decisions: ADR-004 (fraud target and corpus, archived, Proposed), ADR-005 (model artifact and evaluation, archived, Proposed), ADR-006 (routing, authority and oversight), ADR-022, ADR-023  
Repository scope: `apps/api/scripts/train_sandbox_portable_model.py`, `apps/api/server/sandbox_model/`, `apps/api/server/sandbox_data/`, `apps/web/src/console/`, `docs/proposals/schemas/sandbox-portable-model.v0.proposed.json`, `apps/api/tests/`

## Context and evidence

Spec 0004 decides every live feed payment by its scenario's rule table and
saves non PASS payments as feed cases. Slices 1 and 2 are built; every feed
case's Evidence stage says "Not scored yet". Slice 3 adds a model score as
evidence only, and its build plan waits for this record.

The only labelled fraud data the project holds is the Sparkov synthetic
corpus (`data/raw/sparkov/`, gitignored). `model-training-contract.v1.json`
accepts it for mechanics only benchmark evaluation and says no model weight
is a runtime artifact. ADR-004 keeps routing deterministic until a licensed
corpus with mature labels is approved; no such corpus is available to a
portfolio demo.

The `xgboost` Linux wheel for Python 3.13 is 57 MB and pulls in NVIDIA NCCL
(252 MB) and SciPy, which would grow the scale to zero API image by about
350 MB for arithmetic that a short tree walker performs exactly.

## Decision to be made

May the live feed show a model score, trained on Sparkov, as display only
evidence on feed cases, and how is it served?

## Constraints

- The score never changes a route, a recommendation, or whether a case is
  saved (spec 0004 AC-3; `apps/api/AGENTS.md`). No threshold exists.
- Results are described as Sparkov synthetic mechanics, never a fraud
  probability or production performance.
- `server/` never imports `modelling/`, scikit-learn, pandas or `xgboost`
  (`tests/test_modelling_boundaries.py`).
- The raw Sparkov files never leave the owner's machine; only the trained
  artifact and its manifest are committed.
- Frozen contracts (`public-showcase-events.v1`, `sandbox-scenario-analytics.v1`,
  `sandbox-simulation.v1`, `showcase-cases.v1`) do not change shape.

## Options considered

1. **Keep "Not scored yet".** No risk, but F3a never finishes and the page
   keeps a permanent placeholder.
2. **A display only Sparkov score served by a plain Python tree scorer
   (chosen).** Train locally with `xgboost`, commit the booster as XGBoost
   JSON, and score in `server/` by walking the trees, with a dev only parity
   test against `xgboost`.
3. **The same score served by `xgboost` in the API.** Simplest code, but
   about 350 MB more image and slower cold starts.
4. **Wait for a licensed corpus (ADR-004 as written).** Not attainable for a
   portfolio demo.

## Decision

Option 2.

1. **Corpus.** The owner decides that Sparkov is this demo's training corpus
   for the portable model. It stays labelled synthetic mechanics. This
   supersedes ADR-004's licensed corpus precondition for display only
   evidence; it does not authorise a score that routes (see 6).
2. **Model.** An XGBoost binary classifier, `model_version`
   `sandbox-portable-xgb-v1`, trained by
   `apps/api/scripts/train_sandbox_portable_model.py` (local only) on the
   existing chronological train, calibration and test partitions, with Platt
   calibration fitted on the calibration partition and PR AUC, ROC AUC and
   Brier score measured on test. Settings are pinned (`seed`, `nthread=1`,
   `tree_method="hist"`, the `xgboost` version, a canonical JSON dump with
   sorted keys and no timestamps) so two runs give identical file hashes.
3. **Features.** Exactly the eight in spec 0004's Model section, in this
   order: `log_amount`, `event_day_of_week_utc`, `is_weekend`,
   `card_prior_count`, `card_prior_mean_amount`, `amount_to_card_prior_mean`,
   `card_merchant_prior_count`, `card_category_prior_count`. One "card" is one
   scenario dataset. Missing history uses XGBoost's missing branch.
4. **Artifact.** `model.json` (the booster in XGBoost's documented JSON
   format; never pickle) and `manifest.json` (version, feature order, the raw
   Sparkov files' SHA256, Platt parameters, held out metrics, the display only
   scope) live in `apps/api/server/sandbox_model/` and ship in the API image.
   Server code pins the SHA256 of both files and the feature tuple. On any
   mismatch or load failure the API keeps scores null, logs one fixed
   warning, and starts normally.
5. **Serving.** `server/` scores with a plain Python tree walker over the
   booster JSON: float32 feature comparison, the missing branch, the summed
   margin plus base score, then Platt calibration. No new runtime dependency.
   A dev only test proves every score equals `xgboost`'s own prediction within
   1e-6 on a seeded sample, and that server features equal
   `modelling.richer_features` on the same payments.
6. **Scope.** Scores are computed once at run start, stored on the scheduled
   payment (`model_score`, `model_version`, `model_input_sha256`) and copied
   onto its feed case. The drawer shows the score, the version and "Trained on
   Sparkov synthetic data. A mechanics demo, not a fraud probability. It does
   not decide." Routing by score is F3 and needs its own ADR (amending ADR-005
   and ADR-006, with an owner set threshold); that ADR may also use Sparkov.
7. **Contract.** `docs/proposals/schemas/sandbox-portable-model.v0.proposed.json`
   records the scope, features, data source and manifest shape. It stays
   proposed. `model-training-contract.v1.json` is unchanged and keeps
   governing the benchmark report.

## Contracts and invariants

- The rule table in `server/sandbox_data/decisions.py` is the only decider.
  With the model missing, decisions and cases are byte for byte the same.
- The loaded model is exactly the pinned artifact.
- No score, feature or manifest value is ever a payment action or threshold.
- The public showcase copy never calls the score a probability of fraud.

## Verification

- `make api-test`: parity (tree walker equals `xgboost` within 1e-6), feature
  parity with `modelling`, pinned hash refusal, inertness (model missing gives
  identical decisions and cases), reproducible training (two runs, same
  hashes), and the boundary tests.
- `make web-test`: the drawer shows the score, the version and the label for
  a scored feed case, and "Not scored yet" when the score is null.
- Spec 0004's `verify.md` slice 3 steps against a local API and Neon.

## Consequences and ownership

- F3a completes: a real, reproducible model appears in the live product with
  its limits stated, and the image stays small.
- The project owns a short tree walker and must keep its parity test green
  if the `xgboost` version or booster format changes.
- Domain shift remains: Sparkov amounts are dollars and its cards are people;
  Sandbox amounts are pounds and one "card" is a scenario dataset. The label
  says so.
- Owner: the product owner owns the corpus decision and any future move to
  routing by score.

## Acceptance record

Accepted by: Darren Gidado (product owner)  
Date: 2026-09-28  
Notes: Accepted by the owner's explicit choice in a Claude Code session; recorded by Claude on that instruction. The owner decided Sparkov is the demo corpus ("since this is just a demo"), asked for F3a to be completed before F3, and chose the plain Python scorer over `xgboost` in the API.  
