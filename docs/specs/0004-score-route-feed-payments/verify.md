# Verify: score and route live feed payments · spec 0004 · updated 2026-09-24
_Steps derived from spec 0004 acceptance criteria (slices 1 and 2; slice 3, AC-11 to AC-15, waits for its ADR). `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
Run the local API with `SHOWCASE_CASES_ENABLED=true`, `SIMULATION_WORKER_ENABLED=true` and `DATABASE_URL` from Doppler, then open `/radar`.

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
- AC-11 to AC-15 · slice 3, not built (blocked on the ADR)
