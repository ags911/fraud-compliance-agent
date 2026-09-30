# Verify: AI operations overview (F4a) · spec 0011 · updated 2026-09-30
_Steps derived from spec 0011 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run the API locally with `DATABASE_URL` (for example `doppler run -- uv run uvicorn server.main:app --port 8010` in `apps/api`) and the web app (`npm run dev` in `apps/web`). Live model steps also need `GROQ_API_KEY`, `SHOWCASE_GROQ_MODEL` and `SHOWCASE_GROQ_ALLOWED_MODELS`, and `SHOWCASE_OVERVIEW_LIVE_ENABLED=true` for that run only.

## UI / manual
- [x] Open `/?scenario=S01`, Scenario tab → an "Overview" card sits above the four figure cards, with a "Write overview" button → AC-1
- [x] Open `/` (Mixed feed) → the same card and button are there → AC-1
- [x] Press "Write overview" → the button reads "Writing…" and is disabled until the answer arrives; the result is announced (the card body is a polite live region) → AC-10
- [x] With the switch off (default) → a headline and 3 to 5 points, the label "Template summary from the synthetic figures on this page. No AI model was used.", and no reason line → AC-5
- [x] Compare the template with the cards on screen, at 7D, 30D and All → transactions, outbound spend, active days, largest day and its date, and PASS / CHALLENGE / HOLD equal the cards and the chart for the same range → AC-3
- [x] With the Live feed running, write an overview → a point says "Your live feed has shown N of 200 payments…"; in DevTools the request body holds `simulation_run_id` and the URL does not → AC-2, AC-3
- [x] Clear site data (no browser ID) and write an overview → "Your live feed and cases aren't included." → AC-7
- [x] After writing, change the range → "Figures have changed since this was written." and a "Write again" button; no new request appears in DevTools until it is pressed → AC-9
- [x] After writing with a running feed, wait for one more payment → the out of date line appears → AC-9
- [x] After writing with a running feed, switch Live off (count unchanged) → the out of date line appears → AC-9
- [x] After writing, let a case move between outcomes (or save a new case) → the out of date line appears → AC-9
- [x] Stop the API and press the button → "The overview is unavailable right now." and the button stays usable → AC-10
- [x] Live, with the switch on and a ready provider → the label "Written by an AI model (<model>) from the synthetic figures on this page. It can be wrong and it never decides anything." and no reason line; every figure in it matches a card → AC-4
- [x] Live, press the button 4 times within 10 minutes → the fourth answer is the template with "The AI overview limit is reached, so this is the template summary." → AC-5, AC-6
- [x] Live with `SHOWCASE_GROQ_MODEL=openai/gpt-oss-120b`, the revised prompt and `reasoning_effort` `low` → one overview returns `source` `live` with 3 to 5 grounded points → AC-4
- [x] Live with `SHOWCASE_GROQ_MODEL` not in the allowlist → template with "The AI model is unavailable, so this is the template summary." → AC-5, AC-6
- [x] S06 to S08 cannot be picked today (the picker offers S01 to S05 and Mixed); when they are added, the button must be disabled with "Workflow scenarios have no payment decisions to summarise." → AC-1

## Commands
- [x] `curl -s -X POST localhost:8010/sandbox/scenarios/S01/overview -H 'Content-Type: application/json' -d '{"range":"30"}'` → 200, `source` `template`, `fallback_reason` `live_disabled`, `model_id` null, `included` both false → AC-2, AC-5, AC-7
- [x] The same for `MIX` with `"range":"all"` → the headline's transactions and spend equal the sum of S01 to S05 from each `/analytics`, over all days → AC-3
- [x] `POST .../S07/overview` → 404 `sandbox_scenario_not_decided`; `.../S09/overview` → 404 `sandbox_scenario_not_found` → AC-1
- [x] Body `{"range":"14"}` or an extra field → 422 `{"detail":"invalid_overview_request"}`, echoing nothing → AC-2
- [x] With a browser ID header and a random run ID → 200, `included.feed` false, no 404 → AC-7
- [x] With `SHOWCASE_CASES_ENABLED=true`, your browser ID and a run ID for another scenario → `included` `{feed: false, cases: true}` → AC-7
- [x] With `SHOWCASE_CLIENT_CASE_READS_PER_MINUTE=2` and `PUBLIC_DATABASE_GUARDS_ENABLED` unset → the third request in a minute is 429 `overview_rate_limited` → AC-6
- [x] API log after any overview → exactly one `overview_written source=… reason=…` line; no figures, run ID or browser ID → AC-8
- [x] No new table or migration: `ls apps/api/migrations` is unchanged (0008 is the last) → AC-8
- [x] `cd apps/api && uv run --frozen pytest tests/test_sandbox_overview.py tests/test_overview_deployment_config.py` → all pass → AC-2 to AC-8, AC-11
- [x] `cd apps/api && uv run --frozen python ../../scripts/verify_mvp3_deployment_config.py` → passes; flipping the code default, the Bicep default, a Dockerfile copy or a `.dockerignore` allow line makes it fail (covered by `tests/test_overview_deployment_config.py`) → AC-11
- [x] `cd apps/web && npx playwright test tests/overview.spec.ts` → all pass at both widths → AC-1, AC-2, AC-4, AC-5, AC-7, AC-9, AC-10

## Value sourcing
- [x] Window start, end, days: 7D, 30D and All give the dashboard's own date span and day count (sub line under the scenario heading) → AC-3
- [x] Activity figures: with a feed running, the overview's transactions and spend include the shown payments, as the cards do → AC-3
- [x] Decision counts: outbound only; S04 shows CHALLENGE, S02/S03/S05 HOLD, S01 PASS, the run's revealed payments added → AC-3
- [ ] Feed figures: the run's state, shown of scheduled, and raised by model match the Live status and the routing board; with no score routing policy loaded the point says "score routing is off" → AC-3
- [x] Scenario label: S02 reads "High-value and high-velocity risk" (the server's catalogue; the picker says "High-value / high-velocity risk"); Mixed reads "Mixed feed · S01 to S05" → AC-3
- [x] Case counts: equal the Cases tab's per scenario totals; Mixed sums S01 to S05 only → AC-3
- [x] `included` flags: match whether the feed and cases points appear → AC-7
- [x] `contract_version` is `1.0` and the body validates against `docs/contracts/sandbox-overview.v1.schema.json` → AC-2
- [x] Model ID: the live label names `SHOWCASE_GROQ_MODEL` exactly → AC-4
- [x] Switch: unset `SHOWCASE_OVERVIEW_LIVE_ENABLED` → `live_disabled`; a value other than true or false → the overview route answers 503 → AC-6, AC-11
- [x] Token cap: live requests pass 400 output tokens; Run showcase still passes 800 → AC-4
- [x] Limits and timeout: come from `config/public-showcase-overview.v1.json` (1, 3 per 600 s, 20 per 1,800 s, 20 s) → AC-6
- [x] Visitor key: behind a proxy, `SHOWCASE_TRUSTED_PROXY_HOPS` picks the client key, as for case reads → AC-6
- [x] Fact check: a live answer with `10%`, `£10k`, `about £10,166`, a date not on screen, or a count written as money shows the template with the fact check reason → AC-4, AC-5
- [x] Reason line text: each `fallback_reason` shows its fixed line from `showcase-labels.ts`; `live_disabled` shows none → AC-5
- [x] Out of date: a snapshot of scenario, range, run ID, feed state, payments shown and case counts; changing any one dates the overview → AC-9

## Acceptance-criteria coverage
- AC-1: UI steps 1, 2, S06 to S08 note; command 3 · AC-2: UI 6; commands 1, 4; contract step · AC-3: UI 5, 6; command 2; value sourcing 1 to 6 · AC-4: UI 13; fact check, model ID, token cap steps · AC-5: UI 4, 14, 15; command 1; reason line step · AC-6: UI 14, 15; command 7; switch, limits, visitor key steps · AC-7: UI 7; commands 1, 5, 6 · AC-8: commands 8, 9 · AC-9: UI 8 to 11; out of date step · AC-10: UI 3, 12 · AC-11: command 11; switch step
