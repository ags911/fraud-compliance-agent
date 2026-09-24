# Verify: durable investigation cases · spec 0002 · updated 2026-09-24

_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup for the storage on steps: an API with `DATABASE_URL` (migration `0004_showcase_cases.sql` applied) and `SHOWCASE_CASES_ENABLED=true`. Use a fresh lowercase version 4 UUID as `$BID`, and delete its rows afterwards (`DELETE FROM showcase_cases WHERE browser_id = '$BID'`; events cascade).

## Slice 1 (built)

### Commands
- [ ] `POST /showcase/investigations` for S04 recorded with header `X-Showcase-Browser-Id: $BID` → the stream ends with `event: done` and the `data: {}` line → AC-1
- [ ] `GET /cases/<run_id>` with the same `$BID` → 200, `case.scenario_id` S04, `recommendation` CHALLENGE, 8 events in sequence, `tool_call_count` 2, `evidence_count` 2, `expires_at` 30 days after `completed_at` → AC-1, value sourcing
- [ ] The same request with a different valid UUID → 404 `{"detail":{"code":"case_not_found",...}}` → AC-7
- [ ] `GET /cases/run_missing123` and `GET /cases/DROP%20TABLE` with `$BID` → the same 404 body → AC-7
- [ ] `GET /cases/<run_id>` with no header → 400 `invalid_browser_id` → error order
- [ ] With `SHOWCASE_CASES_ENABLED` unset: `GET /cases/<run_id>` → 503 `cases_unavailable`, and a run still streams normally → AC-15, AC-3
- [ ] A run with header `X-Showcase-Browser-Id: not-a-uuid` → 200 stream, and no row in `showcase_cases` → AC-3
- [ ] `uv run pytest tests/test_showcase_cases.py` → all pass (stream identical with and without storage; storage failure keeps the stream; no `run_result` stores nothing; schema invalid event rejected) → AC-2, AC-4, AC-5, AC-16
- [ ] Apply `0004_showcase_cases.sql` twice → no error, both tables and 5 indexes present → migration is rerunnable
- [ ] Save 51 cases for one `$BID` → exactly 50 remain, the oldest removed; deleting a case removes its events → AC-8

### UI / manual
- [ ] Visit `/transactions/not-a-case` → "Case not found", with no `/cases` request in the network panel → AC-14
- [ ] Visit `/transactions/<run_id>` with storage off → "Case history is off" → AC-14
- [ ] With storage on, run S04 from Radar, then visit `/transactions/<run_id>` → heading "S04 · CHALLENGE", Recorded playback and Synthetic data badges, started and completed times, audit trail of 8 events → AC-11
- [ ] Force a 500 from `/cases/<id>` → "The case couldn't be loaded" plus "Try again", which reloads the case → AC-14
- [ ] Each page state shows "Back to Radar", which opens `/radar` → AC-14
- [ ] In the browser, `localStorage["showcase-browser-id"]` holds one lowercase UUID, and every run request carries it as `X-Showcase-Browser-Id` → AC-17
- [ ] `/transactions/investigation` and `/transactions/new` still open their own pages → route precedence

## Slices 2 and 3 (not built yet)
Steps for AC-6, AC-9, AC-10, AC-12, AC-13, AC-18 and AC-19 are added when those slices land.

## Acceptance criteria coverage
- AC-1 slice 1 commands 1, 2 · AC-2, AC-4, AC-5, AC-16 slice 1 pytest · AC-3 commands 6, 7 · AC-7 commands 3, 4 · AC-8 cap command · AC-11 UI 3 · AC-14 UI 1, 2, 4, 5 · AC-15 command 6 · AC-17 UI 6
- Not yet covered (later slices): AC-6, AC-9, AC-10, AC-12, AC-13, AC-18, AC-19
