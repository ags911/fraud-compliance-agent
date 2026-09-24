# Verify: deterministic scenario simulation (live feed) · spec 0003 · updated 2026-09-24

_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup: the API with `DATABASE_URL`, migrations through `0005_simulation_run_owner.sql` applied, and `SIMULATION_WORKER_ENABLED=true` (for example `SHOWCASE_CASES_ENABLED=true SIMULATION_WORKER_ENABLED=true doppler run -- uv run uvicorn server.main:app --reload --port 8010`). Use fresh lowercase version 4 UUIDs as `$A` and `$B`, and delete their runs afterwards (`DELETE FROM sandbox_simulation_runs WHERE browser_id IN ('$A', '$B')`; events cascade).

## Commands
- [ ] `make api-test` → all pass, including the simulation route tests (header required, 429 codes, ownership, stream frames, worker sweep) → AC-4, AC-9, AC-11, AC-12
- [ ] `npx playwright test tests/sandbox-feed.spec.ts` (from `apps/web`) → all pass, including the header on start, stream and overlay, and "Busy" → AC-8, AC-11, AC-13
- [ ] Apply `0005_simulation_run_owner.sql` twice → no error; `browser_id` column, both indexes, and the events FK with `ON DELETE CASCADE` present → AC-1, AC-12
- [ ] `POST /sandbox/scenarios/S02/simulation-runs` with header `$A` → 200 run state with 200 scheduled events and no browser ID in the body → AC-1, AC-4, AC-5
- [ ] The same POST with no header, and with `NOT-A-UUID` → 400 `invalid_browser_id`, the bad value not echoed → AC-9
- [ ] `GET /sandbox/simulation-runs/<A's run>` with header `$B` → 404 `sandbox_simulation_not_found`; the same for `/cancel` and `/events` → AC-9
- [ ] Start S04 with `$A` after S02 → A's S02 run is `cancelled`; a start with `$B` leaves A's run live → AC-10
- [ ] A 4th start with `$A` inside one minute → 429 `simulation_rate_limited`, no new run row → AC-11
- [ ] With 20 runs live, a start from a new browser → 429 `simulation_busy`, no new run row; under concurrent starts the live count never exceeds the cap → AC-11
- [ ] `GET /sandbox/scenarios/S02/analytics?simulation_run_id=<A's run>` with `$A` → the base plus shown payments; with `$B` → 404; with no header → 400; the base without the parameter needs no header → AC-6, AC-9
- [ ] After a full run and a cancel, `sandbox_transactions` and `sandbox_daily_aggregates` for that scenario are unchanged (still 332 rows for S01 to S05) → AC-2, AC-14
- [ ] Backdate a cancelled run's `completed_at` by 8 days and another by 6 days, let the worker sweep (on start, then hourly) → the 8 day one and its events are gone, the 6 day one and any live run remain → AC-12
- [ ] `ls apps/api/scripts` → no `append_sandbox_simulated_event.py`; `grep -r append_simulated_event apps/api/server` → nothing → AC-14

## UI / manual
- [ ] Radar, S02, switch Live on → the switch reads `N / 200`, Transactions counts up from 311 about every 3 seconds, and the charts grow on the latest day → AC-8, AC-5
- [ ] Switch Live off → "Stopped · N", and N equals `appended_event_count` in Neon → AC-2, AC-7
- [ ] Switch Live on again → Transactions starts from 311 again, not from the last count → AC-2, AC-6
- [ ] Change scenario while live → the feed stops (its run is `cancelled`), and the new scenario shows its own base → AC-8
- [ ] With the API started without `SIMULATION_WORKER_ENABLED` → after about 6 seconds the switch reads "Worker not running" → AC-3, AC-8
- [ ] Two browser profiles on the same scenario, both live → each counts its own feed, and neither stops the other → AC-9, AC-10
- [ ] In the network panel, the stream request is a `fetch` carrying `X-Showcase-Browser-Id`, with no browser ID in any URL → AC-13
- [ ] Keep a feed running past 11 minutes of stream time (or restart the API mid run) → the switch keeps updating after the reconnect → AC-13

## Value sourcing checks
- [ ] Owner: the run's `browser_id` in Neon equals `localStorage["showcase-browser-id"]` → Value sourcing, owner
- [ ] Base: `fixture_version` of a new run equals the latest `sandbox_datasets` row for the scenario → Value sourcing, base fixture version
- [ ] Event date: every scheduled event's `event_date` equals the dataset's `end_date` (23 Sep 2026) → Value sourcing, event date
- [ ] Amounts: two runs of S04 schedule the same amount at each sequence, all within 0.7 to 1.3 × 26500 → Value sourcing, amounts
- [ ] Due times: event n is due `(n − 1) × 3` seconds after the run was created → Value sourcing, due times
- [ ] Overlay: analytics with the run equal the base plus one per shown event on the latest day, with outbound spend and `category_counts` summed the same way → Value sourcing, analytics with a run
- [ ] Switch count: "N / 200" matches `appended_event_count` / `scheduled_event_count` on the stream → Value sourcing, Live switch

## Acceptance criteria coverage
- AC-1 migration and start commands · AC-2 base unchanged, Stop count, restart from base · AC-3 worker not running · AC-4 start body, pytest · AC-5 start command, amounts · AC-6 overlay command, restart · AC-7 Stop · AC-8 Radar steps · AC-9 header and ownership commands, two profiles · AC-10 second start, two profiles · AC-11 rate and cap commands, Busy test · AC-12 migration, sweep · AC-13 network panel, reconnect · AC-14 base unchanged, removed script
