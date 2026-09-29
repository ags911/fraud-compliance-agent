# Verify: score routing for rule cleared feed payments · spec 0010 · updated 2026-09-29
_Steps derived from spec 0010's acceptance criteria. Ticked steps were run on
2026-09-29 against the dev database (Doppler `dev`) and a local API on the
build branch; every test run and case was deleted afterwards. `/check verify`
runs these; `/test` locks the durable ones._

## Live (local API and dev database)
Run the API from `apps/api` with `SHOWCASE_CASES_ENABLED=true`,
`SIMULATION_WORKER_ENABLED=true` and Doppler's `DATABASE_URL`. Stop any other
local API with a worker on the same database first: an older build would reveal
the new run's payments without the v2 schema.

- [x] `doppler run -- uv run python scripts/apply_sandbox_migrations.py` twice → both succeed (0008 is rerunnable); a direct insert with `routed_by = 'model'`, `rule_recommendation = 'HOLD'`, `recommendation = 'PASS'` is refused by `score_routing_escalates_only` → AC-3
- [x] The API starts with no `sandbox_score_routing_unavailable` warning; `POST /sandbox/scenarios/S01/simulation-runs` returns `routing_snapshot.routing_policy = {version: score-routing-v1, challenge: 0.39337, hold: 0.72222}` and `raised_by_model = 0` → AC-4, AC-8
- [x] The run's 200 stored rows: every row has `rule_recommendation = PASS` and `routing_policy_version = score-routing-v1`; the 10 rows with `synthetic_outlier = true` are sequences 10, 30 … 190 at 7 to 9 times £42 to `payee_s01_recurring`; 9 of 10 reach CHALLENGE (6 HOLD, 3 CHALLENGE, #10 stays PASS at 0.247); every normal payment scores below 0.04; `routed_by = model` on exactly the raised rows → AC-1, AC-2, AC-6
- [x] While the feed runs, `GET /sandbox/simulation-runs/{run_id}` shows #30 as `HOLD`, `routed_by = model`, `model_score = 0.85586`, and `raised_by_model` counts it → AC-8
- [x] `GET /cases` reports `contract_version = 1.1` and lists `run_feed_…_030` with `recommendation_basis = model_threshold`, `routed_by = model`, `event_contract_version = 2`; `GET /cases/{id}` validates against `showcase-cases.v1.1` and its four events against `public-showcase-events.v2`, with `model_routing` naming score 0.85586, CHALLENGE 0.39337, HOLD 0.72222, `score-routing-v1`, `sandbox-portable-xgb-v1` and `synthetic_outlier = true` → AC-7, AC-8
- [x] A Mixed feed run stores outliers at S01's own 10th and 30th payments (overall #46 and #150); #150 is raised to HOLD; no S02 to S05 row differs from its rule → AC-1, AC-6
- [x] Open the raised case in the Risk Console → the drawer shows `Live feed · raised by model`, "The rules cleared this payment. Its model score, 0.856, is at or above the HOLD threshold of 0.722 (policy score-routing-v1), so it was raised to HOLD.", the synthetic outlier note, and the routed Model signal label; the Cases table's Mode reads `Live feed · raised by model` → AC-10, AC-11
- [ ] Watch the routing board during a live S01 feed → the "Last routed" line reads `#30 → HOLD · model 0.856` when #30 lands, and "Raised by model" counts up → AC-9 (covered by Playwright; not watched live)

## Image
- [x] `docker build -f apps/api/Dockerfile .`, then in the container: the model and `score-routing-v1` load, `public-showcase-events.v2.schema.json` is under `FCA_SHOWCASE_ROOT`, and `xgboost` is not installed; image removed → AC-14
- [x] `python3 scripts/verify_mvp3_deployment_config.py` passes, and fails if the Dockerfile or `.dockerignore` stops shipping the policy file or the v2 schema → AC-14

## Policy file
- [x] `apps/api/scripts/derive_score_routing_policy.py` run twice against the owner-local Sparkov CSVs (checksums match the model manifest) → both runs and Codex's first run write SHA-256 `a6141f430702aed546dd95b7f31c7fd3bce6098016846f13f69ee035891f3867`: CHALLENGE 0.39337 (precision 0.50, recall 0.283, alert rate 0.22%), HOLD 0.72222 (precision 0.90, recall 0.080, alert rate 0.034%) → AC-5

## Commands
- [x] `make api-test` → `tests/test_score_routing.py` passes: thresholds and ties, policy loading and every refusal with one warning, missing model with no routing warning, once per process, threshold selection and its alert rate fallback, outliers by S01's own order, routing at run start (raised, never lowered, off in three ways), v2 case shape and save path, no case without the policy, snapshot count, final decision overlay, deterministic pass totals, migration and image → AC-1 to AC-8, AC-12, AC-14
- [x] `make web-test` → `decision-routing.spec.ts` (marker, count, rule note, routing off), `showcase-cases.spec.ts` (raised case table and drawer, rule case unchanged), `sandbox-feed.spec.ts` (chart subtitle), `console-tour.spec.ts` (seven steps, "Raised by model") → AC-9 to AC-13

## Value sourcing
- [x] `rule_recommendation` ← the rule table; final `recommendation` and `routed_by` ← AC-2 on the stored rounded score → AC-1, AC-2
- [x] Thresholds on a case ← the shipped policy named by the payment's `routing_policy_version`; a raised payment whose policy is not loaded is shown with no case → AC-7
- [x] `raised_by_model` ← every revealed row with `routed_by = model`, never the truncated recent lists → AC-8
- [x] "Live feed · raised by model" ← summary `routed_by` via `ConsoleCaseRow.routedBy` → AC-11
