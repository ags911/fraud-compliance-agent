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

## Slice 2 (built)

### Commands
- [ ] `GET /cases` with `$BID` after S01, S04 and S05 runs → items newest first (S05, S04, S01), `next_cursor` null, `totals.total` 3, `totals.by_scenario` has S01 to S08 with zeros, `fail_safe_holds` 1, `deterministic_passes` 1 → AC-6, value sourcing
- [ ] With 22 cases: page 1 has 20 items and a `next_cursor`; `?cursor=<it>` returns the other 2 and `next_cursor` null; no case appears twice → AC-6
- [ ] `?scenario_id=S04&recommendation=CHALLENGE` → only S04 rows, while `totals.total` still counts every case → AC-6
- [ ] `?cursor=abc@def` → 400 `invalid_cursor`; `?limit=0`, `?limit=21`, `?limit=ten`, `?scenario_id=S09`, `?recommendation=RELEASE` → 422 `invalid_parameters`; no body contains the bad value → error order, no echo
- [ ] With no key and `?limit=ten` → 400 `invalid_browser_id` (key before parameters); with storage off → 503 `cases_unavailable` (storage first) → error order

### UI / manual (storage on)
- [ ] Radar tabs read Scenario · Cases · Model; the Cases count badge equals `totals.total` → AC-9
- [ ] Before any run: "Saved cases" heading and the "No saved cases yet" empty state with a Run button → AC-9 copy
- [ ] Run S01, S04, S05: rows appear newest first with local "d MMM, HH:mm:ss" times, each Run ID links to its case → AC-9
- [ ] Filter "HOLD" → only S05; the stat cards do not change → AC-9, AC-6
- [ ] With more than 20 cases: 20 rows, then "Show more" loads the rest and disappears → AC-9
- [ ] Clicking a Run ID opens the case drawer over the Cases tab (table, filters and totals stay behind it), and `/radar` gains `?case=<id>`; the case is fetched only then → AC-9 (drawer decided 2026-09-24)
- [ ] Escape, the Close button and browser Back each close the drawer, and focus returns to that row's Run ID link → AC-9
- [ ] Refresh or share `/radar?case=<id>` → Radar opens on the Cases tab with that case's drawer; closing it stays on `/radar` → AC-9
- [ ] A claim's cited evidence ID in the drawer scrolls to that item without adding a history entry → AC-13
- [ ] At phone width the drawer fills the screen, with no sideways scroll → AC-9
- [ ] Cmd or Ctrl click on a Run ID still opens `/transactions/<id>` in a new tab → AC-11
- [ ] Save a case from `/transactions/investigation`, then open Radar's Cases tab → it is listed (the tab refreshes when opened) → AC-9
- [ ] A finished run missing from the list (simulate by hiding it from the `/cases` response) → an unlinked row tagged "Not saved", outside the totals → AC-10
- [ ] Mode column shows `recorded (live off)` style wording when a live request ran as recorded → AC-19
- [ ] `/transactions/investigation` after a run: "Saved · Open case" linking to the case → AC-18

### UI / manual (storage off)
- [ ] Cases tab heading "This visit's runs" with the "Not saved: case history is off in this environment" description, table "This visit's decisions", no filters, no links → AC-10
- [ ] `/transactions/investigation` after a run: "Not saved: case history is off in this environment." → AC-18

## Slice 3 (built)

### Commands
- [ ] `npx playwright test tests/showcase-cases.spec.ts` (from `apps/web`) → 18 pass on desktop and mobile → AC-9, AC-10, AC-11, AC-12, AC-13, AC-14

### UI / manual (storage on)
- [ ] Open an S04 case → Summary, then Route ("Eligible for investigation"), Evidence and Outcome stages; each stage's "Stored events (N)" expands to its events with sequence, event ID and recorded time, and the counts add up to 8 → AC-11
- [ ] In the S04 Evidence stage, each item shows its category, value, "Synthetic fixture" and "Fixture s04-r1" → AC-13
- [ ] In the S04 Outcome stage, each claim's "Cites" ID is a link, and clicking it jumps to that evidence item → AC-13
- [ ] Open an S05 case → a red "Investigation incomplete: fail safe HOLD" banner naming the failure reason, stating that authority was not evaluated and no action was simulated; nowhere says "Investigation complete" → AC-12
- [ ] Open an S01 case → the Route stage shows "Investigation skipped", Evidence says none was gathered, and Outcome shows the deterministic PASS → AC-11

## Acceptance criteria coverage
- AC-1 slice 1 commands 1, 2 · AC-2, AC-4, AC-5, AC-16 slice 1 pytest · AC-3 commands 6, 7 · AC-7 commands 3, 4 · AC-8 cap command · AC-11 UI 3 · AC-14 UI 1, 2, 4, 5 · AC-15 command 6 · AC-17 UI 6
- AC-6 slice 2 commands 1 to 3 · AC-9 slice 2 UI (storage on) 1 to 7 · AC-10 slice 2 UI unsaved row, storage off · AC-18 slice 2 investigation page steps · AC-19 slice 2 Mode column step
- AC-11 stages, AC-12, AC-13 slice 3 UI steps · slice 3 Playwright file covers AC-9 to AC-14 in the browser
