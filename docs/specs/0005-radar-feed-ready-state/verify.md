# Verify: Radar live feed on by default · spec 0005 · updated 2026-09-24
_Steps derived from spec 0005 acceptance criteria (second amendment) and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
Run the local API with `SHOWCASE_CASES_ENABLED=true`, `SIMULATION_WORKER_ENABLED=true` and `DATABASE_URL` from Doppler. Clear this site's `radar-live-feed` storage key first, then open `/radar`.

- [ ] Load `/radar` → the Live switch turns on by itself and the status counts "n / 200" as payments land; the charts count up; exactly one start request is sent (DevTools, Network) → AC-1
- [ ] Hover the status, then Tab to the switch → the tooltip opens both ways and explains the live state, including that saved cases appear in the Cases tab → AC-3
- [ ] Change scenario to S02 → one new start for S02, the old run is cancelled, the switch stays on → AC-1
- [ ] Switch Live off, then reload → the switch stays off, the status reads "Showing history", no start request is sent; `localStorage["radar-live-feed"]` is `off` → AC-2
- [ ] Switch Live on again → a fresh run starts from the imported history and the storage key is removed → AC-2
- [ ] Stop the API, reload with Live on by default → the switch is off, the status reads "Showing history" with a grey dot, and the tooltip says the feed isn't available here → AC-4
- [ ] With the API still stopped, switch Live on yourself → "Unavailable" with a red dot and the fix in the tooltip → AC-4
- [ ] Start the API without the worker (`SIMULATION_WORKER_ENABLED` unset), reload → after about 6 seconds "Worker not running" with the fix in the tooltip → AC-5
- [ ] Let a run reach its last payment → "Finished · 200", the switch turns off, nothing restarts it, and its payments stay on the charts → AC-6
- [ ] The Scenario tab has no feed panel or line above the cards → AC-9
- [ ] Cards, charts, the Cases tab and the Model tab look and behave as before → AC-10
- [ ] On a 390px wide phone, the top bar wraps with the picker readable and "Run showcase" on a second row; nothing runs off the edge → AC-3
- [ ] S06 to S08 note: the selector lists only S01 to S05, so the disabled switch for workflow scenarios (AC-7) cannot be reached on this page today → AC-7

## Commands
- [ ] Start 11 runs within a minute from one browser ID (`curl -X POST -H "X-Showcase-Browser-Id: <id>" http://localhost:8010/sandbox/scenarios/S02/simulation-runs`) → the first 10 succeed, the 11th returns 429 `simulation_rate_limited` → AC-8
- [ ] `curl -s "http://localhost:8010/sandbox/scenarios/S02/decisions" | jq 'has("run")'` → `false` (the decisions API is as spec 0004 left it) → AC-9
- [ ] `make api-test` → green, including `test_feed_limits_allow_browsing_scenarios_with_the_feed_on` → AC-8
- [ ] `cd apps/web && npx playwright test tests/sandbox-feed.spec.ts tests/showcase-cases.spec.ts` → green on desktop and mobile → AC-1 to AC-6, AC-10

## Acceptance-criteria coverage
- AC-1 … load step, scenario change step, Playwright "starts by itself" and "changing scenario" tests
- AC-2 … switch off and reload step, switch on step, Playwright "remembered across a reload" test
- AC-3 … tooltip step, phone step, Playwright tooltip assertions
- AC-4 … API stopped steps, Playwright quiet and asked for failure tests
- AC-5 … worker step, Playwright worker test
- AC-6 … finished step, Playwright "stays finished" test
- AC-7 … not reachable from the selector today (see note above)
- AC-8 … 11 starts command, API limit test
- AC-9 … no panel step, decisions `curl` step
- AC-10 … cards, charts and tabs step, the rest of the Playwright suite
