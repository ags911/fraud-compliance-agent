# Verify: score and route live feed payments · spec 0004 · updated 2026-09-24
_Steps derived from spec 0004 acceptance criteria. ADR-024 unblocked slice 3;
the trained portable artifact and automated checks are complete. `/check verify`
runs these; `/test` locks the durable ones._

## UI / manual
Run the local API with `SHOWCASE_CASES_ENABLED=true`, `SIMULATION_WORKER_ENABLED=true` and `DATABASE_URL` from Doppler, then open the Risk Console at `/` (`/radar` before 2026-09-27; it still falls back to `/`).

- [x] Start an S02 feed → "Recommendations over time" shows a `Sandbox` badge (no `Mock data`), and its HOLD count rises as payments land → AC-8
- [x] Open the Cases tab while that feed runs → new HOLD rows with Mode `Live feed` appear within about 3 seconds of each payment; an open drawer is not disturbed; one more refresh follows when the feed ends → AC-9
- [x] Stay on the Scenario tab during an S02 feed → the Cases tab count rises with each HOLD payment (about every 3 seconds) and once more when the feed stops; opening the tab shows those cases → AC-9
- [x] Open an S04 feed case → the drawer and `/transactions/<case_id>` show the `Live feed` pill, the Route copy "Carried from the scenario's recorded investigation; no agent ran for this payment." and Model signal `Not scored yet` → AC-10
- [x] Let an S02 feed reveal more than 20 payments → the browser keeps only its newest 20 feed cases, and every Run showcase case is still listed → AC-5
- [x] Start an S01 feed → PASS counts rise and no case appears → AC-1, AC-4
- [x] Restart with `SHOWCASE_CASES_ENABLED=false` and run S03 → the feed runs and decisions count up; revealed payments have `case_status = storage_off` → AC-6

## Commands
- [x] `make api-test` → `tests/test_feed_decisions.py` passes: rule table, day counts, route error codes, feed case shape and IDs, reveal outcomes (saved, PASS, storage off, invalid, already revealed, already cased) → AC-1, AC-3, AC-4, AC-6, AC-7
- [x] `make web-test` → `sandbox-feed.spec.ts` and `showcase-cases.spec.ts` pass (decided chart, Cases polling, Live feed labels) → AC-8, AC-9, AC-10
- [x] `doppler run -- uv run python scripts/apply_sandbox_migrations.py` twice (in `apps/api`) → both succeed; the schema has the 0006 columns, `showcase_cases_model_score_feed_only`, unique `sandbox_simulation_events.case_id` and `showcase_cases_browser_origin_idx`; existing cases read `origin = showcase` → AC-1, AC-5
- [x] After starting a feed: `SELECT deterministic_route, recommendation, recommendation_basis, model_score FROM sandbox_simulation_events WHERE run_id = …` → every row has the scenario's rule values and a null score → AC-1, AC-2
- [x] `GET /sandbox/scenarios/S06/decisions` → 404 `sandbox_scenario_not_decided`; `GET /sandbox/scenarios/S09/decisions` → 404 `sandbox_scenario_not_found` → AC-7
- [x] Crash safety: force the case insert to fail during a reveal → the payment stays unrevealed with no case; the next attempt saves exactly one → AC-4

## Value sourcing
- [x] Route, recommendation, basis, reason ← rule table: S04 feed payments store INVESTIGATE / CHALLENGE / evidence_grounded, and their case says `existing_recorded_recommendation` → AC-1
- [x] Case owner ← the run's `browser_id`: a feed case is listed only for the browser that started the run → AC-4
- [x] Case times ← `due_at`: `started_at = completed_at = due_at`, `expires_at = due_at + 30 days` → AC-4
- [x] Imported day counts ← outbound `sandbox_transactions` only: S01's base decisions total 178 while its analytics count 332 transactions (inbound excluded) → AC-7
- [x] Overlay counts ← the named run's revealed, decided events: a second browser ID asking for the same run gets 404 `sandbox_simulation_not_found` → AC-7
- [x] "Live feed" ← `origin = feed`: a Run showcase case still shows `Recorded playback` → AC-10
- [x] Model signal ← `model_score`: null shows `Not scored yet` → AC-10
- [x] Mocked scored feed case → drawer shows five-place score, model version and the ADR-024 mechanics label; null still says `Not scored yet` → AC-10

## Slice 3 verification

- [x] Run `train_sandbox_portable_model.py` twice against owner-local raw Sparkov CSVs; model SHA-256 `8fb7909ad5192993eabbffd6e014ffb95626af0457a6c9aefc48bdfe3afcb576` and manifest SHA-256 `411a4aadbcc2a98d73fe9d383f0f2ae9f4eba6d1281570db8f25027fb57f532d` match → AC-11
- [x] Verify the committed artifact's tree-walker parity against XGBoost, including missing branches, and its pinned-hash refusal → AC-12, AC-14
- [x] Start a local Neon feed and inspect stored score, version and input digest; confirm the case copies score/version without changing rule decisions → AC-2, AC-3, AC-14 (2026-09-28, dev database: an S04 feed scored all 200 payments with `sandbox-portable-xgb-v1` and a 64 character digest; every feed case carried its payment's exact score; test rows deleted)
- [x] A scored run start and an unscored one store identical rows apart from the three score columns and the clock's `due_at`; a scorer fault leaves null scores, logs one `sandbox_portable_score_failed`, and the run still starts → AC-2, AC-3 (`tests/test_sandbox_portable_model.py`)
- [x] Build the API image, load and score the packaged model, and confirm `pip show xgboost` fails → AC-15

## Acceptance-criteria coverage
- AC-1 · rule table tests, migration introspection, S01/S04 manual steps
- AC-2 · stored null score check (the score itself is slice 3)
- AC-3 · rule table is the only decider; no score path exists yet
- AC-4 · reveal tests, crash safety, S01 PASS step, owner and times checks
- AC-5 · cap constants test, >20 payment manual step
- AC-6 · storage off test and manual step
- AC-7 · route tests, not decided and not found commands, inbound and ownership checks
- AC-8 · chart Playwright test and S02 manual step
- AC-9 · Cases polling Playwright test and manual step
- AC-10 · case page and drawer Playwright tests and manual step
- AC-11 to AC-15 · artifact training, hash pinning, scorer/feature parity, tamper refusal, image packaging and no-runtime-XGBoost checks pass; local Neon persistence verified
