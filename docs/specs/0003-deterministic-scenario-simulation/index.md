# 0003. Deterministic scenario simulation (live feed)

**Date**: 2026-09-24 (ratified 2026-09-24 by /architect; first recorded by /develop as Assumed)
**Status**: In Progress

## Summary

Radar's Live switch plays a feed of simulated payments into one scenario's charts, so the dashboard visibly counts up during a demo. Each run is a fixed, repeatable schedule of 200 payments, one every 3 seconds, laid over the imported Sandbox data without ever changing it, so every run starts from the same figures. Runs belong to the browser that started them (like saved cases), with limits so a hosted demo cannot be overloaded. The core feed is built; ownership, limits, a clean up sweep, a header carrying stream and retiring an older write path are the remaining build work.

## Requirements

**User stories**:
- As a demo viewer, I want to switch Live on for a scenario and watch its figures count up, so the dashboard feels like a live console.
- As a demo viewer, I want Stop and a fresh start to return to the imported figures, so every demo starts the same way.
- As the operator of a hosted demo, I want each visitor's feed isolated and bounded, so one visitor cannot stop another's feed or overload the database.

**Acceptance criteria**:
- **AC-1**: A run and its scheduled events are persisted per scenario, fixture version, run ID, owning browser and ordered sequence.
- **AC-2**: Advancing a due event is atomic and idempotent. It marks only that event as shown and never changes the imported scenario dataset; a Stop waits for an in flight batch, so nothing is added after it.
- **AC-3**: The worker advances due events without Plaid access, either inside the API (when `SIMULATION_WORKER_ENABLED=true` and a database is configured) or as the standalone script.
- **AC-4**: The endpoints expose only safe run state and a read only progress stream. They never return transaction rows or accept event content from a browser.
- **AC-5**: S01 to S05 use deterministic, transaction shaped schedules of 200 payments, one every 3 seconds, amounts within 30% of each scenario's typical amount from a fixed seed; S06 to S08 have no payment schedule.
- **AC-6**: `GET /sandbox/scenarios/{id}/analytics?simulation_run_id=` returns the imported base plus that run's shown events; without the parameter, the base alone. A run of another scenario, an older import or another browser returns 404.
- **AC-7**: `POST /sandbox/simulation-runs/{run_id}/cancel` stops the caller's own run; shown payments stay shown.
- **AC-8**: Radar's Live switch, beside the scenario selector, starts, follows and stops a feed for the selected scenario; the figures count up from the base as payments land; changing scenario stops the feed; it says when the worker is not running.
- **AC-9**: Every run belongs to the browser that started it (the `X-Showcase-Browser-Id` header, a lowercase version 4 UUID). Start, status, cancel, the progress stream and run analytics all require that header and only act on that browser's runs; a missing or malformed header returns 400.
- **AC-10**: A browser has at most one live run: starting a run cancels that browser's other live run, and never another browser's.
- **AC-11**: At most 20 runs are live across the site, and a browser may start at most 3 runs per rolling minute; over either limit, start returns 429 with a stable code and Radar says the feed is busy, and no run is created.
- **AC-12**: Finished runs (completed, cancelled or failed) older than 7 days are deleted with their events by the worker; live runs are never swept.
- **AC-13**: The progress stream is read with `fetch` (not EventSource), so the browser ID travels in the header and never in a URL; the client reconnects while the run is live.
- **AC-14**: The older manual append path (`scripts/append_sandbox_simulated_event.py` and its service code) is removed; nothing in the app writes simulated payments into an imported dataset. The `sandbox_simulated_event_appends` table stays as history.

## Decision

**Chosen option**: Option 2: A bounded, deterministic feed overlaid on the base, owned per browser.

A run is a fixed, repeatable 200 payment schedule for one scenario, shown on top of the imported data for the browser that started it, advanced by a worker in the API, bounded by a site cap and a per browser rate limit, and swept after 7 days.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (migration `0003_sandbox_simulation_runs.sql`, built; new migration `0005_simulation_run_owner.sql`):

| Table | Column | Type | Null | Notes |
|---|---|---|---|---|
| `sandbox_simulation_runs` | `run_id` | text | no | primary key, a UUID |
| | `scenario_id`, `fixture_version` | text | no | FK to `sandbox_datasets`, the base the run overlays |
| | `browser_id` | text | yes | **new in 0005**; owner; always set for new runs, null only for runs made before 0005 |
| | `seed` | text | no | `sandbox-simulation-v1` |
| | `state` | text | no | `pending`, `running`, `completed`, `failed`, `cancelled` |
| | `scheduled_event_count`, `appended_event_count` | integer | no | 200 and the number shown so far |
| | `created_at`, `started_at`, `completed_at` | timestamptz | created no, others yes | `completed_at` also set on cancel; drives the sweep |
| | `failure_reason` | text | yes | |
| `sandbox_simulation_events` | `run_id`, `sequence` | text, integer | no | primary key; FK to runs, **changed in 0005 to `ON DELETE CASCADE`** |
| | `event_id` | text | no | unique per run |
| | `due_at` | timestamptz | no | run start plus `(sequence minus 1) × 3` seconds |
| | `event_date`, `available_date` | date | no | the dataset's latest day |
| | `amount_minor`, `currency`, `direction`, `category_bucket`, `payee_reference`, `payment_channel` | | | sanitised values only; `payment_channel` is `simulated` |
| | `appended_at` | timestamptz | yes | set when shown; null means not yet due or not yet advanced |

New indexes in 0005: `(browser_id, created_at)` for the rate limit, and a partial index on `state` where `state IN ('pending', 'running')` for the cap. One run has many events (1:N). `sandbox_simulated_event_appends` (0002) stays as history and receives no new rows.

**State transitions**: `pending` → `running` (first event shown) → `completed` (all 200 shown). `pending` or `running` → `cancelled` (Stop, a new run from the same browser, or Radar changing scenario). `failed` is reserved for a worker error. Terminal states never change; a terminal run older than 7 days is deleted.

**API surface** (all internal, `include_in_schema=False`; every route needs `X-Showcase-Browser-Id`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/sandbox/scenarios/{scenario_id}/simulation-runs` | POST | path scenario (req), header browser ID (req) | run state | browser ID scoping | 400 `invalid_browser_id`, 404 `sandbox_scenario_not_found`, 429 `simulation_busy` / `simulation_rate_limited`, 503 |
| `/sandbox/simulation-runs/{run_id}` | GET | run ID, header | run state | own runs only | 400, 404 `sandbox_simulation_not_found`, 503 |
| `/sandbox/simulation-runs/{run_id}/cancel` | POST | run ID, header | run state after stop | own runs only | 400, 404, 503 |
| `/sandbox/simulation-runs/{run_id}/events` | GET | run ID, header | SSE `simulation_state` frames on each change, ending at a terminal state or after 660 seconds | own runs only | 400, 404 (before streaming) |
| `/sandbox/scenarios/{scenario_id}/analytics` | GET | optional `simulation_run_id`; header required only when it is given | base aggregates, plus the run's shown events when named | own runs only for the overlay | 400, 404 `sandbox_simulation_not_found`, 503 |

Run state is `run_id`, `scenario_id`, `fixture_version`, `seed`, `state`, `scheduled_event_count`, `appended_event_count`, `next_due_at`; never the browser ID or any transaction row. Error bodies never echo the header or the run ID.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Start | owner | `X-Showcase-Browser-Id` header, validated by `valid_browser_id` (spec 0002) |
| Start | base fixture version | latest `sandbox_datasets` row for the scenario |
| Start | event date | the base dataset's `end_date` |
| Start | 200 amounts | scenario typical amount × (0.7 + 0.6 × a SHA256 of `seed:scenario:sequence`) |
| Start | payees, category | the scenario's fixed shape in `simulation.py` |
| Start | due times | start time + `(sequence − 1) × 3` seconds |
| Start | cap check | count of runs in `pending` or `running`, under `pg_advisory_xact_lock` |
| Start | rate check | count of this browser's runs with `created_at` in the last 60 seconds |
| Worker | shown events | due events of live runs, claimed with `FOR UPDATE OF event, run SKIP LOCKED` |
| Worker | sweep | terminal runs with `completed_at` older than 7 days |
| Analytics with a run | daily count, outbound spend, categories | base `sandbox_daily_aggregates` plus that run's events with `appended_at` set, added per day as `build_dataset` counts them |
| Live switch | "37 / 200" | `appended_event_count` / `scheduled_event_count` from the stream |
| Live switch | "Worker not running" | no shown event 6 seconds after start |
| Live switch | "Busy" | a 429 from start |
| Stat cards and charts | counts and spend | analytics with the run, refetched each time `appended_event_count` changes |

**Key invariants**:
- The imported dataset (`sandbox_transactions`, `sandbox_daily_aggregates`, `sandbox_datasets`) is never written by a run or the worker.
- A browser has at most one run in `pending` or `running`; the site has at most 20.
- A shown event is shown exactly once (`appended_at` set once, counted once).
- A Stop's reported count equals the final count (the worker locks the run row while advancing).
- The browser never supplies payment content or a clock.

**Security model**: no sign in. The browser ID is a scoping key, not authentication; whoever holds it can see and stop that browser's feed. Acceptable because every value is synthetic and no transaction row is ever returned. The ID never appears in URLs, responses or logs. Rate limiting and the site cap protect the database; the endpoints stay internal (`include_in_schema=False`). No compliance scope.

**Configuration required**:
- `SIMULATION_WORKER_ENABLED`: runs the worker inside the API; default false, so a deployment starts no worker unless asked.
- `DATABASE_URL`: existing; the feed needs it.
- Limits are code constants, not settings: 20 live runs, 3 starts per minute, 7 day retention, 3 second pace, 200 payments.

**Critical test scenarios**:
- Happy path: start S02 with a browser ID, the worker shows payments, analytics with the run count up from the base, Stop freezes the count; verifies **AC-2**, **AC-6**, **AC-7**, **AC-8**.
- Base untouched: after a full run and a cancel, the imported dataset's rows and aggregates are byte for byte unchanged; verifies **AC-2**, **AC-14**.
- Ownership: browser B cannot read, stream, overlay or cancel browser A's run (404), and a missing header returns 400; verifies **AC-9**.
- One live run per browser: a second start cancels the first run of the same browser only; verifies **AC-10**.
- Limits: the 21st concurrent start and the 4th start in a minute return 429 and create no run, including under concurrent starts; verifies **AC-11**.
- Sweep: a cancelled run 8 days old is deleted with its events, a 6 day old one and a live one are kept; verifies **AC-12**.
- Stream: the progress stream carries the header, is readable with `fetch`, and reconnects after the server closes it while the run is live; verifies **AC-13**.
- Race: a Stop during an in flight batch reports the true final count; verifies **AC-2**.
- Determinism: the same scenario and sequence always yield the same amount; S06 to S08 have no schedule; verifies **AC-5**.

## Build plan

Built (from the Assumed build):
1. [x] Migration `0003_sandbox_simulation_runs.sql`, the run and event tables; satisfies **AC-1**.
2. [x] The 200 payment deterministic schedule for S01 to S05; satisfies **AC-5**.
3. [x] Worker marks due events shown without touching the base, with the run row locked; the run overlay in analytics; one live run per scenario; satisfies **AC-2**, **AC-6**.
4. [x] Cancel endpoint; progress stream with real SSE frames; satisfies **AC-4**, **AC-7**.
5. [x] Worker inside the API behind `SIMULATION_WORKER_ENABLED`, plus the standalone script; satisfies **AC-3**.
6. [x] Radar's Live switch, refetching analytics as payments land and stopping on scenario change; satisfies **AC-8**.

Remaining, as thin end to end slices:
7. [x] Migration `0005_simulation_run_owner.sql`: `browser_id`, the two indexes, and `ON DELETE CASCADE` on events; satisfies **AC-1**, **AC-12**.
8. [x] Ownership end to end: require and validate the header on every simulation route and on run analytics, store the owner, scope every read and cancel to it, and change "one live run per scenario" to "one live run per browser"; Radar sends the header; satisfies **AC-9**, **AC-10**, **AC-6**, **AC-7**.
9. [x] Replace EventSource with a `fetch` based SSE reader that sends the header and reconnects while the run is live; satisfies **AC-13**, **AC-8**.
10. [x] Limits in the start transaction (advisory lock, site cap 20, 3 per minute) returning 429 codes, and Radar's "Busy" status; satisfies **AC-11**, **AC-8**.
11. [x] The 7 day sweep in the worker loop (in the API and the script); satisfies **AC-12**.
12. [x] Retire the manual append path: remove the script, `append_simulated_event` and `_append_simulated_event_cursor`, and their tests; keep the 0002 table; satisfies **AC-14**.
13. [x] Tests for every critical scenario above, API and Playwright; satisfies **AC-1** to **AC-14**.

## Consequences

**Positive**:
- The dashboard visibly counts up during a demo, and every run starts from the same imported figures.
- The reference datasets can no longer drift through the feed or the old append path.
- Visitors of a hosted demo are isolated from each other, and database load is bounded.

**Negative / tradeoffs**:
- The browser ID is weak scoping: clearing site data loses the running feed, and anyone holding the ID can stop it.
- Each run writes 200 schedule rows up front; the sweep keeps this bounded, but a burst of visitors writes up to 4,000 rows at the cap.
- Feed payments sit on a past date (the dataset's latest day), which a careful viewer may notice.
- A tab closed mid run leaves its run going until it finishes (up to 10 minutes), holding one of the 20 slots.
- Hosting still needs a public database decision; until then the feed works only where a database is configured.

**Neutral**:
- A fifth migration (`0005`), and the manual append script disappears.
- The web client reads SSE with `fetch`, the same pattern the investigation stream already uses.

## Follow-up

- [ ] Before any public enablement: an ADR allowing a public database (shared with spec 0002's cases; partly reverses ADR-016), plus a hosting and secrets plan for Neon.
- [ ] Update `context/architecture.md`'s "Implemented local deterministic simulation runtime": it still says each append recomputes the scenario's aggregates, and does not mention the overlay, ownership, limits or the in API worker (left for its owner, since `context/` has other uncommitted edits).
- [ ] Server logging for the worker and limits (runs started, 429s, sweeps), owed like spec 0002's case logging.
- [ ] Consider releasing a run when its viewer disconnects, if closed tabs holding slots becomes a problem.
- [ ] A versioned API contract for the simulation endpoints under `docs/proposals/schemas/`, accepted with the public database ADR.
