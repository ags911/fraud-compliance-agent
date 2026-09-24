# 0004. Score and route live feed payments into cases: rationale

## Context

> ⚠️ Premise note: the accepted `model-training-contract.v1.json` limits the only trained model to "synthetic benchmark mechanics only; never production training, runtime scoring". Showing a score per feed payment is runtime scoring in practice, even as display only evidence. This spec builds it under a new proposed contract and keeps it local and unaccepted until an ADR amends that scope. It also cannot produce a meaningful fraud probability for Sandbox payments: Plaid Sandbox is never a labelled fraud corpus, so the model learns from Sparkov and is applied across datasets.

The live feed (spec 0003) adds simulated payments to a scenario's charts, but nothing decides them. Radar's Cases tab and its KPIs therefore never move during a feed, and the Scenario tab's "Recommendations over time" chart is a mock that simulates a PASS / CHALLENGE / HOLD split over real counts "until Sandbox events are scored by the decision engine". The project owner wants the live data to reach the decisions, the cases and a real score.

The forces: the project's routing decision says deterministic controls come before any model routing, and that recommendations are not actions. The rules forbid inventing a numeric threshold, so a score may be shown but may not route a payment. Today's deterministic route is fixed per scenario in the showcase runtime (S01 PASS, S02 and S03 hard HOLD, S04 and S05 INVESTIGATE); there is no per payment rules engine. The only model (an XGBoost candidate) was trained on Sparkov with an hour of day feature that Sandbox payments do not have (they are date precision), and no trained artifact is saved in the repo. Saved cases (spec 0002) have a 50 per browser cap, and a feed can produce 200 payments per run. The frozen `public-showcase-events.v1` contract must not change.

Without a decision the chart stays mock, the Cases tab stays still during demos, and any score added later would be guessed.

Workspace: `apps/api` (FastAPI, psycopg, Neon, the `modelling/` package with XGBoost) and `apps/web` (Radar). No build approach is recorded, so the plan assumes thin end to end slices.

## Options considered

### Option 1: Decisions from the scenario rule only, no score yet

Every feed payment gets its scenario's accepted route and recommendation; non PASS payments become cases; the case shows "Model signal: not scored yet".

**Pros**:
- Smallest build; no contract change; nothing that could be mistaken for a fraud probability.

**Cons**:
- Leaves the scoring story (the part a fraud or ML reviewer looks for) unbuilt, with a placeholder on the page.

### Option 2: Scenario rule decides, a portable Sparkov trained XGBoost score is shown as evidence (chosen)

As Option 1, plus a model trained on Sparkov labels with only the features Sandbox payments share, scored once at run start and stored, and shown in the case's Evidence stage with its limits.

**Pros**:
- Real, reproducible model; honest about its source and limits; never decides.
- Reuses the existing `modelling/` pipeline and its untouched calibration partition (for Platt calibration).

**Cons**:
- Domain shift from Sparkov to Sandbox, and a contract scope change that needs an ADR.
- Outcomes stay one colour per scenario.

### Option 3: Reuse the existing Sparkov XGBoost benchmark model as is

Score Sandbox payments with the benchmark model, filling the missing hour of day.

**Pros**:
- No new training.

**Cons**:
- A filled feature makes the score meaningless, no artifact exists to load, and the contract explicitly forbids runtime scoring of that model.

### Option 4: Per payment routing rules with owner set thresholds

Route each payment by amount, velocity or new payee against thresholds the owner writes as policy; the score may later join.

**Pros**:
- Varied, more realistic outcomes within a scenario.

**Cons**:
- Needs a threshold policy that does not exist; building it now would invent thresholds, which the rules forbid.

## Rationale

The scenario rule is the only routing the accepted documents support: each scenario's meaning is accepted, and the runtime already encodes it. Deciding feed payments with it moves the Cases tab and the chart without inventing a threshold (ruling out Option 4 for now), and it keeps the project's routing decision intact because the deterministic rule stays first and final.

A score is worth building now (over Option 1) because it is the part a reviewer expects, and the pieces exist: labelled Sparkov data, the `modelling/` pipeline, XGBoost and an unused calibration partition. The existing benchmark model cannot be reused honestly (Option 3): it needs an hour of day Sandbox lacks, and its contract forbids runtime scoring. A portable model trained on the shared features is the honest middle: real labels, real training, applied to features that exist on both sides, and labelled as a mechanics demo. It is trained offline and committed with a hash, so the API loads a reviewed artifact rather than training at startup, and it is scored once at run start because the schedule is fixed in advance, so the worker only reveals stored values.

Only non PASS payments become cases, with their own cap of 20, so feed cases stay meaningful and never push out the owner's Run showcase cases. INVESTIGATE payments carry the scenario's recorded outcome under the contract's existing "existing recorded recommendation" reason rather than replaying fixture evidence that does not describe the payment, and rather than running 200 agent investigations per feed.

### After the cross check (2026-09-24)

A same model cross check found that the model slice was not buildable as first written: the hashed Sparkov file carries only four features and the contract excludes card history features, the served API cannot import XGBoost or `modelling/`, the artifact sat outside the API package, and no calibration was chosen. The engineer chose to build decisions and feed cases now and gate the model on an ADR that approves the runtime score, the history features (from the raw Sparkov files) and the dependency boundary change; Platt calibration and hashes pinned in code were settled. It also chose outbound only decisions (inbound credits are not payments to decide) and eligibility `skipped` with explanatory copy for S04 and S05 feed cases. The remaining findings (collision free IDs, per origin caps, idempotent inserts, saving the case in the reveal transaction, stable ordering by `due_at`) were applied as recommended.

