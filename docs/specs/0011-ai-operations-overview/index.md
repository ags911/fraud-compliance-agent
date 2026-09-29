# 0011. AI operations overview on the Risk Console (F4a)

**Date**: 2026-09-29
**Status**: In Progress

## Summary

An "Overview" card on the Scenario tab writes a short, plain summary of what the dashboard shows when the viewer presses "Write overview": a one sentence headline and 3 to 5 points. The server gathers the figures itself and, when its own switch is on, asks the existing Groq model to write the summary; every number the model writes is checked against those figures. When the model is off, busy, slow or writes a number it was not given, the viewer gets a template summary built from the same figures, with one line saying why. Nothing is stored, nothing is decided, and every summary says whether an AI model wrote it.

## Requirements

**User stories**:
- As a demo viewer, I want a short plain summary of what the dashboard shows, so I can understand the scenario without reading every card and chart.
- As a demo viewer, I want to know whether an AI model wrote it and what it is based on, so I can judge how far to trust it.
- As the project owner, I want the live model call to be off by default, limited and cheap, and never able to invent a figure, so a public page cannot run up cost or mislead.

**Acceptance criteria**:
- **AC-1**: The Scenario tab shows an "Overview" card above the four figure cards, with a "Write overview" button, for S01 to S05 and the Mixed feed. For S06 to S08 the button is disabled with the reason "Workflow scenarios have no payment decisions to summarise."
- **AC-2**: Pressing the button sends the scenario in the path and, in a JSON body, the selected range (`7`, `30` or `all`) and, when the viewer's feed is running or finished, its run ID (never in the URL, so it stays out of access logs). The server builds the facts itself from stored data; the browser sends no figures or text.
- **AC-3**: The facts cover the same days the dashboard shows (the dataset's last day, counted back 7 or 30 days but not past its first day; `all` is the whole dataset) and hold: scenario activity (transactions counting inbound and outbound, outbound spend, active days, largest day and its date, with the viewer's shown feed payments added), decision counts by PASS, CHALLENGE and HOLD for outbound payments only (with the viewer's run added), the viewer's run (state, payments shown of scheduled, the routing split, raised by model, and whether score routing is on, meaning the run's routing policy is loaded) when a run ID is given and belongs to the viewer, and the viewer's saved case counts for the scenario. The Mixed feed sums S01 to S05, as the dashboard does.
- **AC-4**: When the overview switch is on, the provider is ready and the limits admit the call, the server asks the allowlisted Groq model for a JSON object with a `headline` and 3 to 5 `points`. The output is used only when it has that shape, stays within the length limits, and every figure in it is written exactly as the facts write it (counts such as `1,234`, money such as `£10,165.83`, dates such as `2 Sep 2026`); any other number, a `%`, a sign, rounding or an abbreviation fails. The viewer then sees it with the label "Written by an AI model (<model>) from the synthetic figures on this page. It can be wrong and it never decides anything."
- **AC-5**: Otherwise the viewer sees a template summary (a headline and 3 to 5 points built from the same facts by fixed rules) labelled "Template summary from the synthetic figures on this page. No AI model was used." When the live switch is on but a live overview could not be used, one reason line says why: the limit is reached, the model was unavailable, it took too long, or its output did not pass the fact check. With the switch off (the public default) the response carries `fallback_reason` `live_disabled` and the card shows no reason line, only the template label.
- **AC-6**: Live calls have their own limits, in an accepted config file: at most 1 at a time, 3 per visitor per 10 minutes, 20 per 30 minute window, and a 20 second timeout. They never use Run showcase's allowance, and Run showcase never uses theirs. Every request, template or live, also passes an overview read limit per visitor that is always on (even with the public database guards off), at `SHOWCASE_CLIENT_CASE_READS_PER_MINUTE` or its default, answering 429 `overview_rate_limited` when exceeded. The live checks run in this order: switch off gives `live_disabled`; a missing key or a model not on the allowlist gives `provider_unavailable`; neither takes a slot. Only then is an admission slot taken (`admission_limited` when refused), the call runs under the 20 second timeout, and the slot is always released.
- **AC-7**: What cannot be read is left out, and the overview is still written. No browser ID, or a malformed one (treated as none, never a 400): feed and cases are left out, with "Your live feed and cases aren't included." A run ID that is unknown or belongs to another browser: only the feed is left out, with "Your live feed isn't included.", and no error reveals whether it exists. Case storage off or failing: only cases are left out, with "Your saved cases aren't included."
- **AC-8**: Nothing is stored: no table, no migration, no cache. The feature's own logs are fixed category lines only (`overview_written source=live|template reason=<code>`), never the facts, prompt or output; the run ID never appears in a URL.
- **AC-9**: The page records what it had when it asked (scenario, range, run ID, feed state and payments shown, case counts by PASS, CHALLENGE and HOLD). When any of these changes afterwards, the card says "Figures have changed since this was written." with a "Write again" button. No call is made until the viewer presses it.
- **AC-10**: While a request is in flight the button reads "Writing…" and is disabled; the result is announced politely to screen readers. If the API cannot be reached the card says "The overview is unavailable right now." and keeps the button.
- **AC-11**: The overview switch is off by default in code and in the deployment template. The deployment verifier fails if the code default or the Bicep default for `SHOWCASE_OVERVIEW_LIVE_ENABLED` is not false, if the Dockerfile stops copying `config/public-showcase-overview.v1.json` or `docs/contracts/sandbox-overview.v1.schema.json`, or if `.dockerignore` stops allowing either.

## Decision

**Chosen option**: Option 2: a server built, fact checked overview with a template fallback.

The server gathers the facts, the allowlisted Groq model may write the summary under its own switch and limits, every number is checked against the facts, and a template summary built from the same facts is always there as the fallback.

## Rationale

Reasoning and options: see [rationale.md](rationale.md). The governing record is ADR-026 (accepted 2026-09-29).

## Feature design

**Data model sketch**: none. Nothing is persisted (AC-8). The facts are computed per request from existing tables (`sandbox_datasets`, daily aggregates, `sandbox_transactions`, `sandbox_simulation_runs` and `_events`, `showcase_cases`); no migration.

**The facts object** (built by the server, sent to the model, never returned whole to the browser):

| Field | Type | Notes |
|---|---|---|
| `scenario` | `{id, label}` | label from `fixtures/s01-s08/scenarios.v1.json`; Mixed: `Mixed feed · S01 to S05` |
| `window` | `{start, end, days}` | dates written as `2 Sep 2026` |
| `activity` | `{transactions, outbound_spend, active_days, largest_day: {date, outbound_spend} or null}` | counts written with thousands commas (`1,234`); spend written exactly as the cards show it (`£10,165.83`) |
| `decisions` | `{PASS, CHALLENGE, HOLD}` | outbound payments in the window, the viewer's run added |
| `feed` | `null` or `{state, shown, scheduled, PASS, CHALLENGE, HOLD, raised_by_model, score_routing_on}` | only the viewer's own run; `score_routing_on` is `routing_policy` not null |
| `cases` | `null` or `{total, PASS, CHALLENGE, HOLD}` | the viewer's saved cases for the scenario (Mixed: S01 to S05 summed) |

**State transitions**: none on the server. The card moves idle → writing → shown (live or template) → out of date (AC-9) → writing; any state → unavailable when the API cannot be reached.

**API surface** (internal, `include_in_schema=False`, like the other Sandbox routes):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/sandbox/scenarios/{scenario_id}/overview` | POST | path `scenario_id` (`S01`…`S05`, `MIX`); JSON body `range` (`"7"`, `"30"`, `"all"`, req), `simulation_run_id` (uuid, opt); header `X-Showcase-Browser-Id` (opt; malformed treated as absent) | `contract_version` `1.0`, `scenario_id`, `range`, `window` `{start, end, days}`, `source` (`live` or `template`), `model_id` (null for template), `headline`, `points` (3 to 5 strings), `fallback_reason` (null, `live_disabled`, `admission_limited`, `provider_unavailable`, `timeout`, `invalid_output`, `ungrounded`), `included` `{feed, cases}` (booleans) | none (public, rate limited) | 404 `sandbox_scenario_not_found` (unknown ID); 404 `sandbox_scenario_not_decided` (S06 to S08); 422 invalid range; 429 `overview_rate_limited` (overview read limit); 503 `sandbox_scenario_data_unavailable` |

The response contract is written first as `docs/proposals/schemas/sandbox-overview.v0.proposed.json` and promoted to `docs/contracts/sandbox-overview.v1.schema.json` when ADR-026 is accepted.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Build facts | window start, end, days | the dataset's `time_boundary` and `range`, by the dashboard's rule (`scenario-date-window.ts`); Mixed: earliest start and latest end across S01 to S05 |
| Build facts | activity figures | daily aggregates with the viewer's shown feed events overlaid (the analytics read's algorithm), summed over the window by the cards' rule (`summariseSandboxActivity`): transactions count inbound and outbound; spend is outbound only; an active day has any transaction; the largest day is the first day with the highest outbound spend above zero |
| Build facts | decision counts | the decisions algorithm (`_decision_days`) for the window: outbound only, the viewer's revealed run payments added by their final recommendation |
| Build facts | feed figures | the run snapshot (`read_simulation_run_cursor`) for `simulation_run_id` scoped to the browser ID and the scenario (Mixed: a `MIX` run); null when either is missing or it does not match |
| Build facts | scenario label | `fixtures/s01-s08/scenarios.v1.json` (the server's catalogue; its wording may differ slightly from the web app's picker); Mixed: `Mixed feed · S01 to S05` |
| Build facts | case counts | the case totals (`by_scenario`) for the browser ID; Mixed sums S01 to S05; null without a browser ID or when case storage is off or fails |
| Response | `included.feed`, `included.cases` | whether `feed` and `cases` are non null in the facts |
| Response | `contract_version` | the constant `1.0` |
| Live call | model ID | `SHOWCASE_GROQ_MODEL`, which must be in `SHOWCASE_GROQ_ALLOWED_MODELS` (as Run showcase) |
| Live call | on or off | `SHOWCASE_OVERVIEW_LIVE_ENABLED`, then provider readiness (key present, model allowlisted) |
| Live call | output token cap | a new `max_completion_tokens` argument on the provider's JSON helper (default 800, unchanged for investigations); the overview passes 400 from its config |
| Live call | limits and timeout | `config/public-showcase-overview.v1.json` |
| Visitor key for limits | client key | `client_identity(request)` with `SHOWCASE_TRUSTED_PROXY_HOPS` (as the case read limit) |
| Read limit | requests per visitor per minute | a separate, always on `ClientWindowLimiter` at `SHOWCASE_CLIENT_CASE_READS_PER_MINUTE` (or its default) |
| Fact check | allowed figures | the exact written tokens in the facts: counts, money and dates as written, plus the window's day count; scenario IDs (`S01`…`S05`) are skipped, not checked |
| Template | headline and points | fixed sentence rules over the facts (below) |
| Card | label text | fixed strings per `source` (AC-4, AC-5) |
| Card | reason line | `fallback_reason` mapped to fixed text in `apps/web/src/lib/showcase-labels.ts`: `admission_limited` "The AI overview limit is reached, so this is the template summary."; `provider_unavailable` "The AI model is unavailable, so this is the template summary."; `timeout` "The AI model took too long, so this is the template summary."; `invalid_output` and `ungrounded` "The AI overview didn't pass the fact check, so this is the template summary."; `live_disabled` and null show no line |
| Card | "not included" note | `included` flags mapped to the AC-7 wording |
| Card | "out of date" | a snapshot the page records when it sends the request (scenario, range, run ID, feed state and payments shown, case counts by outcome), compared with its current state |

**Template rules** (deterministic, no model): headline "`<Scenario label>`: `<transactions>` transactions and `<spend>` outbound spend over `<days>` days." Points in this order: decisions ("`<n>` PASS, `<n>` CHALLENGE and `<n>` HOLD."), largest day ("The largest day was `<date>`, with `<spend>` outbound.", or "No day had outbound spend."), active days ("Payments landed on `<n>` of `<days>` days."), then, only when present, feed ("Your live feed has shown `<shown>` of `<scheduled>` payments; the model raised `<n>`.", or "…; score routing is off.") and cases ("You have `<n>` saved cases for this scenario."). The first three are always present, so there are always 3 to 5 points.

**Model call** (reusing `server/showcase_investigation/provider.py`'s JSON call helper, given a new `max_completion_tokens` argument): temperature 0, JSON response mode, at most 400 output tokens, one system message ("Summarise only the facts given. Copy every figure and date exactly as written; never round, convert, abbreviate or compute. Do not give advice, predict, or recommend any action on a payment. Reply as JSON: {headline, points}."), one user message holding the facts as JSON. Headline at most 160 characters; each point at most 200; 3 to 5 points.

**Fact check**: skip scenario IDs (`S0` followed by a digit); then find every figure in the headline and points: money (`£` and digits), dates (a day, a month name, a year), and any other run of digits with its commas, decimal point, sign or `%`. Each must equal, character for character, a token the facts write (a count, a money amount, a date, or the window's day count). Any other figure, a `%`, a sign or a number word such as "ten thousand" fails. Any miss gives `ungrounded` and the template.

**Key invariants**:
- The browser never sends figures or text that reach the model; the facts come only from stored data.
- A number the facts do not contain never reaches the viewer from the model.
- Every overview is labelled with its source; the template is never presented as AI written, and the reverse.
- Overview calls and Run showcase calls never share admission counters.
- Nothing about an overview is stored, and the feature logs only fixed category lines; the run ID travels in the body, never the URL.
- The overview never changes a route, a recommendation, a case or a feed.

**Security model**: public and anonymous, like the rest of the showcase. The browser ID only scopes which run and cases may enter the facts; another browser's run or cases are never read. Every request passes the overview read limit (its own `ClientWindowLimiter`, per client key), and live calls also pass the overview admission controller. The provider key stays server side. Prompt injection has no path in: the model sees only server built facts. No personal data; synthetic figures only.

**Configuration required**:
- `SHOWCASE_OVERVIEW_LIVE_ENABLED`: turns live overviews on; explicit boolean, default `false`; a Bicep parameter defaulting to `'false'`.
- `config/public-showcase-overview.v1.json`: accepted limits (concurrency 1, 3 per client per 600 seconds, 20 per 1,800 second window, 20 second timeout, 400 output tokens), `status: accepted` after ADR-026.
- Reused, now always read for this route: `SHOWCASE_CLIENT_CASE_READS_PER_MINUTE` (its existing default applies when unset).
- Reused, unchanged: `GROQ_API_KEY`, `SHOWCASE_GROQ_MODEL`, `SHOWCASE_GROQ_ALLOWED_MODELS`, `SHOWCASE_TRUSTED_PROXY_HOPS`, `DATABASE_URL`.

**Critical test scenarios**:
- Happy path, live: switch on, a fake provider returns a grounded JSON overview → the card shows it with the AI label and model ID, verifies **AC-2**, **AC-3**, **AC-4**.
- Template: switch off → template headline and points built from the facts, labelled, with no reason line; switch on but limit reached → template with the limit reason, verifies **AC-5**, **AC-6**.
- Fact check: the provider returns a number not in the facts → `ungrounded`, template shown, verifies **AC-4**, **AC-5**.
- Timeout and bad JSON → `timeout` and `invalid_output`, template shown, verifies **AC-5**.
- Facts: the window matches the dashboard for 7, 30 and `all`; Mixed sums S01 to S05; the viewer's run overlay counts, verifies **AC-3**.
- Scoping: no or malformed browser ID → feed and cases left out; another browser's run ID → only the feed left out, cases kept; case storage off → only cases left out; each with its note and no 404, verifies **AC-7**.
- Fact check cases: `10%`, `£10k`, `about £10,166`, a date not in the facts, and a count that exists only as money all fail; exact tokens pass, verifies **AC-4**.
- Live check order: switch off and a provider that is not ready take no admission slot; a refused slot gives `admission_limited`; the slot is released after a timeout, verifies **AC-6**.
- Template minimum: no feed, no cases and no outbound spend still give 3 points, verifies **AC-5**.
- Token cap: the overview call passes 400 and investigations still pass 800, verifies **AC-4**.
- Separate limits: overview calls exhaust their limit and Run showcase still admits, and the reverse, verifies **AC-6**.
- Staleness: after a feed payment lands, after the feed stops with an unchanged count, and after a case moves between outcomes, the card shows "Figures have changed…" and no request is sent, verifies **AC-9**.
- S06 to S08: button disabled with the reason; the API returns 404 `sandbox_scenario_not_decided`, verifies **AC-1**.
- Logging: a live call logs one fixed line and no facts or output, verifies **AC-8**.
- Deployment: the verifier fails for each AC-11 condition, verifies **AC-11**.

## Build plan

Build approach: Tracer Bullet (from `docs/scope/scope.md`): the first slice runs one thin path from the button to a template overview built from real facts, then the live model and the finish are added.

**Slice 1: a template overview from real facts**
1. Write `docs/proposals/schemas/sandbox-overview.v0.proposed.json` (the full response shape above); satisfies **AC-2**, **AC-5**.
2. One server side facts builder in `server/sandbox_data/` that runs the same aggregation algorithms directly in a single read (not the HTTP routes, whose 404 for a foreign run the overview must not surface): window rule, activity, decisions, feed, cases, Mixed summing over five scoped overlays, browser scoping, written tokens; tests against the dashboard's own rules; satisfies **AC-3**, **AC-7**.
3. Template writer and the `POST /sandbox/scenarios/{id}/overview` route (overview read limit, S06 to S08 404, fixed category logs); satisfies **AC-5**, **AC-6**, **AC-8**.
4. Overview card on the Scenario tab: button, writing state, template result, label, "not included" note, unavailable state, S06 to S08 disabled; satisfies **AC-1**, **AC-5**, **AC-7**, **AC-10**.

**Slice 2: the live model, checked**
5. `config/public-showcase-overview.v1.json`, settings (`SHOWCASE_OVERVIEW_LIVE_ENABLED`), and a separate admission controller; satisfies **AC-6**.
6. `max_completion_tokens` on the provider helper; the live call in the AC-6 check order, shape and length checks, the fact check, timeout, and every fallback reason; satisfies **AC-4**, **AC-5**, **AC-6**.
7. Card shows the live label and model ID and the reason line; satisfies **AC-4**, **AC-5**.

**Slice 3: finish**
8. The page's request snapshot, "out of date" detection and "Write again"; satisfies **AC-9**.
9. Bicep parameter, Dockerfile and `.dockerignore` for the config and contract, and the deployment verifier checks; satisfies **AC-11**.
10. API and Playwright tests for every critical scenario; `verify.md`; satisfies **AC-1** to **AC-11**.

## Consequences

**Positive**:
- The dashboard gains a plain language reading of its own figures, and the public site always gets a useful answer at no cost, because the template works with the model off.
- The fact check means the model cannot put an invented figure in front of a viewer.
- Overviews and investigations are switched and limited separately, so one cannot starve or enable the other.

**Negative / tradeoffs**:
- A second live model use on the public site, with its own switch, limits and config file to keep accurate.
- The server now reproduces the dashboard's window and card rules, so the two must be changed together; tests pin both.
- The number check is strict: a model that rewrites `£10,165.83` as "about £10k" is rejected and the template is shown. That is intended, but more live attempts end on the template.
- Live overviews wait on the provider for up to 20 seconds, on top of any cold start.

**Neutral**:
- No migration, no new provider, no new dependency.
- A new response contract (`sandbox-overview.v1`) and a new accepted config file, both through ADR-026.
- The guided tour is unchanged (already at seven steps).

## Follow-up

- [x] Cross check (Codex, 2026-09-29): 16 findings; fixes applied for the fact check tokens and dates, the token cap, the live check order, the always on read limit, what is left out and when, unnamed sources, staleness, the template minimum, activity rules, the run ID in the body, the deployment checks, and one facts builder.
- [x] Accept ADR-026 before building (owner, 2026-09-29).
- [ ] When the tour is split per tab, add a step for the Overview card.
- [ ] Before switching live overviews on in production, confirm a Groq spending limit or budget alert on the account (the live config's own rule for anonymous live use).
