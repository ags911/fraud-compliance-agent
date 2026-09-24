# 0004. Score and route live feed payments into cases (F3a)

**Date**: 2026-09-24
**Status**: Proposed

## Summary

Every outbound payment in the live feed (spec 0003) is now decided, not just counted: it gets its scenario's accepted deterministic route and recommendation, and payments that are not PASS become saved cases (spec 0002). Radar's Cases tab and its KPIs move during a feed, and the mock "Recommendations over time" chart is replaced by real decided counts. A model score, from a new XGBoost model trained on labelled Sparkov data with history features Sandbox payments also have, is shown later as evidence only; that slice waits for an ADR that approves the runtime score and its features, and until then a case says "not scored yet". The score never decides anything, because no threshold policy exists.

## Requirements

**User stories**:
- As a demo viewer, I want feed payments to be decided, so the Cases tab, its KPIs and the recommendations chart change while the feed runs.
- As a demo viewer, I want each saved feed case to show the model's score as evidence (once approved), so I can see where a model would fit without it deciding anything.
- As the project owner, I want the score to come from a real, reproducible model with its limits stated, so nothing on the page is a placeholder dressed as real.

**Acceptance criteria** (slices 1 and 2 build now; AC-11 to AC-15 are slice 3, gated on the ADR):
- **AC-1**: At run start, every scheduled outbound feed payment is stored with its deterministic route, recommendation and basis from the scenario decision rule table (below); S06 to S08 have no rule and no schedule.
- **AC-2**: Each scheduled payment also stores a model score and version; both are null until slice 3, and null whenever the model is not loaded; a payment is decided either way.
- **AC-3**: The score never changes a route, a recommendation or whether a case is saved.
- **AC-4**: When the worker reveals a non PASS payment with case storage on, in the same transaction it saves one case for the run's browser, built through spec 0002's `build_case` and `EventValidator`, whose events validate against `public-showcase-events.v1`; the payment records the case ID and `case_status` = `saved`. If validation fails, the payment is still revealed and `case_status` = `invalid` (never retried). PASS payments get no case.
- **AC-5**: A browser keeps at most 20 `feed` cases and at most 50 `showcase` cases; each cap trims only its own origin, in the same transaction as the insert; a feed case never removes a Run showcase case.
- **AC-6**: With case storage off, payments are still decided and counted, `case_status` = `storage_off`, and the feed runs.
- **AC-7**: `GET /sandbox/scenarios/{id}/decisions` returns PASS, CHALLENGE and HOLD counts per day for the scenario's imported outbound payments (each decided by the same rule); with `simulation_run_id` and the owning browser's header it adds that run's revealed payments. S06 to S08 return 404 `sandbox_scenario_not_decided`.
- **AC-8**: Radar's "Recommendations over time" chart reads those counts, drops its "Mock data" badge, and counts up during a feed; the mock generator is removed.
- **AC-9**: Radar's Cases tab lists feed cases, its totals include them, and while the tab is open and a feed runs it refetches `/cases` when the feed's revealed count changes (at most every 3 seconds) and once when the feed ends; an open drawer is not disturbed.
- **AC-10**: For a feed case, the drawer and case page show "Live feed" instead of "Recorded playback" in the source pill and the Mode column, and the Route stage for S04 and S05 reads "Carried from the scenario's recorded investigation; no agent ran for this payment." The Evidence stage shows a Model signal: "Not scored yet" before slice 3, then the score, the model version and "Trained on Sparkov synthetic data. A mechanics demo, not a fraud probability. It does not decide."
- **AC-11**: (slice 3) A training script builds the model from the raw Sparkov files with the features below, Platt calibration on the calibration partition and metrics on test, and writes `model.json` and `manifest.json`; with pinned settings, two runs give identical file hashes.
- **AC-12**: (slice 3) The API loads the artifact read only at startup, checks the SHA256 of both files and the feature tuple against constants pinned in server code, and on any mismatch or load failure keeps scores null with one warning log; it never fails startup.
- **AC-13**: (slice 3) A proposed contract records the model's display only scope, features and data source (`docs/proposals/schemas/sandbox-portable-model.v0.proposed.json`); nothing is published as accepted.
- **AC-14**: (slice 3) Scores are computed at run start in `server/` with no import of `modelling/` or scikit-learn; a parity test shows the server's features match `modelling.richer_features` on the same payments.
- **AC-15**: (slice 3) The artifact ships inside the API package, and `xgboost` is its only new runtime dependency; `test_modelling_boundaries.py` is amended to allow exactly that.

## Decision

**Chosen option**: Option 2: decide every outbound feed payment by its scenario's accepted route and save non PASS payments as feed cases now; add a Sparkov trained XGBoost score as display only evidence once an ADR approves it.

Routes and recommendations come only from the accepted scenario meaning; the score, when it arrives, is computed once at run start and never influences a decision.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Scenario decision rule** (server side, the single source; outbound payments only):

| Scenario | Route | Eligibility | Skip reason | Recommendation | Basis | Case |
|---|---|---|---|---|---|---|
| S01 | PASS | skipped | `deterministic_clear_route` | PASS | deterministic | no |
| S02 | HOLD | skipped | `hard_deterministic_control` | HOLD | deterministic | yes |
| S03 | HOLD | skipped | `hard_app_control` | HOLD | deterministic | yes |
| S04 | INVESTIGATE | skipped | `existing_recorded_recommendation` | CHALLENGE | evidence_grounded | yes |
| S05 | INVESTIGATE | skipped | `existing_recorded_recommendation` | HOLD | fail_safe | yes |

S01 to S03 reuse the runtime's `_SKIPPED_SCENARIOS`. S04 and S05 carry the recommendation and basis of the runtime's recorded run for that scenario, with `investigation_status` skipped: a new pairing the runtime never emits, accepted here and explained in the drawer copy (AC-10).

**Data model sketch** (migration `0006_feed_decisions.sql`):

| Table | Column | Type | Null | Notes |
|---|---|---|---|---|
| `sandbox_simulation_events` | `deterministic_route` | text | yes (only for rows before 0006) | from the rule table |
| | `recommendation`, `recommendation_basis` | text | yes (only for rows before 0006) | from the rule table |
| | `model_score` | numeric(6,5) | yes | CHECK 0 to 1 |
| | `model_version` | text | yes | the manifest's version |
| | `model_input_sha256` | text | yes | SHA256 of the feature vector, so a shown score can be audited |
| | `case_id` | text | yes | unique; a historical pointer with no FK (the case may later be trimmed or expire) |
| | `case_status` | text | yes | `saved`, `invalid`, `storage_off`, or null (PASS, or not yet revealed) |
| `showcase_cases` | `origin` | text | no | `showcase` or `feed`; default `showcase` backfills existing rows; CHECK |
| | `model_score`, `model_version` | numeric(6,5), text | yes | CHECK both null unless `origin` = `feed`; score CHECK 0 to 1 |
| index | `showcase_cases (browser_id, origin, completed_at)` | | | the per origin caps; the existing `(browser_id, completed_at)` index stays |

Events rows from before 0006 with null decisions are skipped by the decisions overlay. Cancelling a run keeps the cases its revealed payments already saved.

**Feed case shape**:
- Case ID: `run_feed_` + the first 12 hex digits of the run UUID with hyphens removed + `_` + the payment sequence zero padded to 3 digits (for example `run_feed_3f2a9c1e7b4d_007`).
- Event IDs: `evt_feed_<12 hex>_<seq 3 digits>_<n>`, n = 1 to 4 (built explicitly, not with the runtime's identity helper, which would truncate them).
- Events: `run_started` (`requested_mode` and `execution_mode` recorded, `fallback_reason`, `provider`, `model_id` null, `data_label` synthetic), `route_resolved` (route, eligibility skipped), `investigation_skipped` (the rule's reason), `run_result` (`investigation_status` skipped, the rule's recommendation and basis, `authority_status` not_evaluated, `simulated_action` none, recorded, synthetic).
- `started_at`, `completed_at` and every `recorded_at`: the payment's `due_at`, so cases revealed in one poll still order stably; `expires_at` = `completed_at` + 30 days.

**Worker save**: each due event is claimed and revealed in its own transaction; for a non PASS payment the case is saved in that same transaction under spec 0002's per browser advisory lock, with `INSERT … ON CONFLICT (case_id) DO NOTHING`, and only when `case_id` is still null, so a retried or trimmed case never returns.

**Model** (slice 3; `apps/api/server/sandbox_model/`, packaged with the API):
- `model.json` (XGBoost booster) and `manifest.json` (`model_version` `sandbox-portable-xgb-v1`, feature order, the raw Sparkov files' SHA256, Platt parameters, held out PR AUC, ROC AUC and Brier score, the display only scope). The expected SHA256 of both files and the feature tuple are pinned as constants in `server/`.
- Training (`apps/api/scripts/train_sandbox_portable_model.py`, local only): reads `data/raw/sparkov/fraudTrain.csv` and `fraudTest.csv` through `modelling.richer_features.load_raw_sparkov`, uses the existing train, calibration and test partitions, and pins `seed`, `nthread=1`, `tree_method="hist"`, the xgboost version, and a canonical JSON dump with sorted keys and no timestamps.
- Features, one "card" = one scenario dataset, history ordered by `event_date` then `transaction_id`, with the schedule after every imported row: `log_amount` ← log1p(`amount_minor` / 100); `event_day_of_week_utc`, `is_weekend` ← `event_date` (constant across one feed, since feed payments share the latest day); `card_prior_count` ← prior outbound payments; `card_prior_mean_amount`, `amount_to_card_prior_mean` ← prior outbound amounts, missing (XGBoost's missing branch) when there is no history; `card_merchant_prior_count` ← prior payments to the same `payee_reference`; `card_category_prior_count` ← prior payments in the same `category_bucket`. Excluded: hour of day, time since prior, global merchant count, category one hot columns.

**API surface** (internal, `include_in_schema=False`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/sandbox/scenarios/{scenario_id}/decisions` | GET | optional `simulation_run_id`; header required only with it | `contract_version` "0", `scenario_id`, `fixture_version`, `days[]` of `{date, PASS, CHALLENGE, HOLD}`, `totals` | base public; overlay owner only (reuses `read_analytics`' 404 rules) | 400 `invalid_browser_id`, 404 `sandbox_scenario_not_found` / `sandbox_scenario_not_decided` / `sandbox_simulation_not_found`, 503 |
| `/sandbox/scenarios/{scenario_id}/simulation-runs` | POST | unchanged (spec 0003) | unchanged | unchanged | unchanged; decisions (and later scores) are written in the start transaction |
| `/cases`, `/cases/{case_id}` (spec 0002) | GET | unchanged; no new filter | summaries gain `origin`, `model_score`, `model_version`; totals and filters as today, over both origins | unchanged | unchanged |

`sandbox-scenario-analytics.v1` (accepted) and `public-showcase-events.v1` (frozen) are unchanged. The proposed showcase cases schema gains `origin`, `model_score`, `model_version`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Run start | route, recommendation, basis, reason, eligibility | the scenario decision rule table |
| Run start (slice 3) | features | the dataset's imported outbound transactions plus earlier payments in this schedule, as defined under Model |
| Run start (slice 3) | score, version, input hash | the pinned booster and Platt parameters; `model_version`; SHA256 of the feature vector |
| Worker reveal | case ID, event IDs | the formats under Feed case shape |
| Worker reveal | case owner | the run's `browser_id` (spec 0003) |
| Worker reveal | case times | the payment's `due_at`, plus 30 days for expiry |
| Worker reveal | `case_status` | saved / invalid / storage off, per AC-4 and AC-6 |
| Decisions | imported day counts | outbound `sandbox_transactions` per `event_date`, all assigned to the rule's recommendation |
| Decisions | overlay counts | revealed events of the named run with a non null recommendation, per `event_date` |
| Chart | PASS, CHALLENGE, HOLD per day | the decisions endpoint |
| Cases tab | refresh during a feed | the feed hook's revealed count and end state |
| Drawer | "Live feed" pill and Mode | `origin` = `feed` |
| Drawer | S04 / S05 route copy | fixed copy in AC-10, for `origin` feed with reason `existing_recorded_recommendation` |
| Drawer | Model signal | case `model_score` and `model_version`, or "Not scored yet" when null |

**Key invariants**:
- The score never feeds a route, a recommendation or the case rule; the rule table is the only source.
- A payment has at most one feed case, saved in the same transaction as its reveal, never twice and never after a trim.
- Each browser has at most 20 feed and 50 showcase cases; each trim touches only its origin.
- Imported datasets are never written (spec 0003).
- Feed case events always validate against `public-showcase-events.v1`.
- The loaded model is exactly the pinned artifact.

**Security model**: unchanged from specs 0002 and 0003. Feed cases belong to the run's browser; the decisions overlay needs the owner's header. Scores are synthetic, labelled and display only. No personal data, no compliance scope.

**Configuration required**:
- Existing: `SHOWCASE_CASES_ENABLED` (feed cases need it), `SIMULATION_WORKER_ENABLED`, `DATABASE_URL`.
- Slice 3, training only (local): the raw Sparkov files under `data/raw/sparkov/`, already gitignored.
- Slice 3 dependency: `xgboost` moves into the API's runtime dependencies; scikit-learn and `modelling/` stay dev only.

**Critical test scenarios**:
- Happy path: an S02 feed reveals HOLD payments; each gets a feed case in `/cases` and the decisions overlay counts HOLD up; verifies **AC-1**, **AC-4**, **AC-7**.
- PASS: an S01 feed adds decisions but no cases; verifies **AC-1**, **AC-4**.
- Caps: 25 feed cases leave the newest 20 and every Run showcase case survives; verifies **AC-5**.
- Crash safety: a failure after reveal but before commit leaves the payment unrevealed and no case; a second attempt saves exactly one case; verifies **AC-4**.
- Invalid case: a forced invalid event saves no case, reveals the payment and marks it `invalid`, with no retry; verifies **AC-4**.
- Storage off: the feed runs, decisions count, `case_status` is `storage_off`; verifies **AC-6**.
- Inbound: imported inbound credits are not counted in decisions; verifies **AC-7**.
- Ownership: browser B cannot read A's run decisions (404); S06 returns 404 `sandbox_scenario_not_decided`; verifies **AC-7**.
- Chart and Cases tab: real counts without the badge, feed rows appear while the tab is open, the drawer shows "Live feed", the S04 copy and "Not scored yet"; verifies **AC-8**, **AC-9**, **AC-10**.
- Slice 3: score inertness (model missing gives identical decisions and cases), pinned hash refusal, reproducible training, feature parity with `modelling`; verifies **AC-2**, **AC-3**, **AC-11** to **AC-15**.

## Build plan

Build approach: none recorded, so thin end to end slices. Slices 1 and 2 build now; slice 3 starts only after its prerequisites.

**Slice 1: decided feed payments in the chart**
1. Migration `0006_feed_decisions.sql` as sketched (both tables, CHECKs, the cap index); apply and confirm live; satisfies **AC-1**, **AC-5**.
2. The scenario decision rule table in `server/sandbox_data/`; write route, recommendation and basis for each outbound scheduled payment at run start; satisfies **AC-1**, **AC-3**.
3. `GET /sandbox/scenarios/{id}/decisions` (outbound only, owner scoped overlay, 404 for S06 to S08); satisfies **AC-7**.
4. Radar: the chart reads decisions, drops the badge and removes the mock generator; refetches as feed payments land; satisfies **AC-8**.

**Slice 2: feed cases**
5. Cases repository: `origin` in `CaseRecord`, the summary columns and the insert; per origin caps (50 showcase, 20 feed) in the same transaction as the insert; `ON CONFLICT (case_id) DO NOTHING`; satisfies **AC-5**.
6. Worker: reveal each event in its own transaction; for non PASS payments build the case with `build_case` and `EventValidator` in the shapes above and save it in that transaction; set `case_id` and `case_status`; satisfies **AC-4**, **AC-6**.
7. Web: `origin` and score fields in case types; "Live feed" pill and Mode; the S04 and S05 route copy; "Not scored yet"; the Cases tab refetch while a feed runs; satisfies **AC-9**, **AC-10**.

**Slice 3: the model (prerequisites: an ADR approving the display only runtime score, the history features and the raw Sparkov source; the dependency boundary change)**
8. Proposed contract `docs/proposals/schemas/sandbox-portable-model.v0.proposed.json`; satisfies **AC-13**.
9. Training script with pinned settings and Platt calibration; commit the artifact under `server/sandbox_model/`; satisfies **AC-11**.
10. Server side feature and Platt maths with a parity test; load with pinned hashes; score at run start; copy scores onto feed cases; amend the boundary test and add `xgboost` to runtime dependencies; satisfies **AC-2**, **AC-3**, **AC-12**, **AC-14**, **AC-15**.
11. Drawer Model signal with the score and label; satisfies **AC-10**.

**Across slices**
12. API and Playwright tests for every critical scenario above; satisfies **AC-1** to **AC-15**.

## Consequences

**Positive**:
- The Cases tab, its KPIs and the chart move during a demo, and the mock chart is gone.
- Slices 1 and 2 need no contract change and no new dependency, so they can ship now.
- When slice 3 lands, a real, reproducible model appears with its limits stated, and the deterministic rule stays the only decider.

**Negative / tradeoffs**:
- Outcomes are one colour per scenario: every S02 payment is HOLD. Varied outcomes need a per payment policy that does not exist yet.
- S04 and S05 feed cases pair "evidence grounded" or "fail safe" with a skipped investigation, a combination the runtime never emits; the drawer has to explain it.
- A busy S02 feed produces up to 20 near identical HOLD cases per browser.
- Until slice 3, every feed case says "Not scored yet"; slice 3 itself depends on an ADR and brings domain shift (Sparkov to Sandbox, GBP read as dollars).
- Cases grow more KPIs mixing two origins (for example CHALLENGE counts rise with S04 feed cases).

**Neutral**:
- One more migration; a committed model artifact inside the API package once slice 3 lands.
- Feed cases reuse spec 0002's storage, drawer and case page.

## Follow-up

- [ ] An ADR approving the display only runtime score, the history features and the raw Sparkov source (amending `model-training-contract.v1.json`), plus the API dependency boundary change; this unblocks slice 3.
- [ ] A per payment routing policy with owner set thresholds, if varied outcomes are wanted; only then may a score influence a route.
- [ ] A Sandbox compatible labelled dataset, if a score meaningful on Sandbox payments is wanted.
- [ ] Update `context/architecture.md` and `context/progress_tracker.md` for F3a once built (left for their owner while `context/` has other uncommitted edits).
- [ ] Update spec 0003's Summary, which still calls its now built tasks "remaining".
