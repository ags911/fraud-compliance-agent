# 0002. Durable investigation cases (F4)

**Date**: 2026-09-24 (updated 2026-09-24 to match the build)
**Status**: In Progress

## Summary

Every completed showcase run becomes a saved case you can reopen later, instead of vanishing when the tab closes. The API stores the run's own accepted events (the audit trail) plus one summary row, scoped to the browser that ran it, kept 30 days and capped at 50 per browser. Radar's Session tab becomes a Cases tab, and each case opens in a drawer over that tab showing the outcome, the evidence, and every event; `/transactions/<case id>` shows the same case as a full page for deep links. This runs locally and internally only; the public showcase stays database free until an ADR (a recorded architecture decision) says otherwise.

## Requirements

**User stories**:
- As a portfolio visitor, I want the runs I start to still be there after a reload so that I can come back to a result and show it again.
- As a reviewer of the system, I want each case to show exactly which evidence and events produced its recommendation so that the decision is auditable.
- As an operator, I want a failed or incomplete investigation to be unmistakable so that a fail safe HOLD is never read as a completed investigation.

**Acceptance criteria**:
- **AC-1**: With case storage enabled and a valid browser ID, every run that reaches `run_result` is stored as one case holding all of its identity bearing events (every event except `done`) in sequence order, and it is readable through `GET /cases` once `done` has been received. Storage depends on `run_result` alone: a run whose connection closes after `run_result` but before `done` may still be stored.
- **AC-2**: The investigation stream is unchanged by storage: the same events, fields and order as the frozen v1 contract, no new event, and the existing contract drift tests pass without edits.
- **AC-3**: A run with a missing or malformed browser ID, or with case storage disabled, completes exactly as today and stores nothing.
- **AC-4**: If storing fails (a database error, a commit over its 3 second limit, or an event validation failure), the stream still completes unchanged, no partial case or event is left behind, and the web app shows the run as "Not saved".
- **AC-5**: A run that raises, or whose connection closes, before `run_result` stores nothing. A live investigation that times out still ends with `run_result`, so it is stored as an incomplete case (AC-12).
- **AC-6**: `GET /cases` returns only the calling browser's unexpired cases, newest first, 20 per page with a cursor for the next page, filterable by scenario and by recommendation, plus a totals block computed over all of that browser's retained cases, unaffected by the filters.
- **AC-7**: `GET /cases/{case_id}` returns the same `404 case_not_found` for a case that does not exist, belongs to another browser, or has expired.
- **AC-8**: An expired case is never returned; each new case write also deletes that browser's expired cases and any beyond its 50 newest.
- **AC-9**: Radar's Session tab is renamed Cases and keeps its layout (stat cards, decisions table, collapsed breakdown; the unlabelled share bar is removed, since the stat cards already give the split), filled from `GET /cases`, with scenario and recommendation filters above the table and a "Show more" button that loads the next 20; the tab label count shows `totals.total`; the copy follows the Copy table below. A plain click on a row's Run ID opens that case in a right hand drawer (shadcn `Sheet`) over the Cases tab, so the table, filters, totals and scroll position stay behind it. The full case is fetched only when the drawer opens. Opening pushes `?case=<id>` onto the `/radar` URL (`history.pushState`), so refresh and a shared link reopen the drawer on the Cases tab; Escape, the Close button and browser Back close it, and focus returns to that row's Run ID link. On phones the drawer fills the screen. A modified click (new tab or window) still opens `/transactions/<case id>`, which stays as the deep link fallback.
- **AC-10**: When case storage is unavailable (`GET /cases` returns `503` or fails, or there is no browser ID), the Cases tab falls back to this visit's runs with the note "Not saved: case history is off in this environment", and those rows do not link to a case page. When storage is on but a finished run is missing from the refreshed list, it appears as an unlinked row tagged "Not saved" and is left out of the totals.
- **AC-11**: The case detail page shows an outcome summary header (scenario, final recommendation, deterministic route, investigation status, a Recorded or Live badge with provider and model for live runs, the fallback reason when a live request ran as recorded, started and completed times), then the Route, Evidence and Outcome stages, each expandable to its exact stored events with sequence number, event ID and recorded time.
- **AC-12**: An incomplete investigation shows a failure banner stating the fail safe HOLD, the failure reason, that authority was not evaluated and that no action was simulated; it is never styled or worded as a completed investigation.
- **AC-13**: The Evidence stage lists every evidence item with its category, displayed value, source class and fixture version, and every claim shows the evidence IDs it cites, each linked to that evidence item.
- **AC-14**: The case detail page has distinct loading, not found (one message for missing, other browser and expired), storage unavailable, and error with retry states, plus a "Back to Radar" link.
- **AC-15**: With `SHOWCASE_CASES_ENABLED` unset or false, the API makes no database connection for cases and every existing endpoint behaves as before; this is the public deployment's configuration.
- **AC-16**: Every stored event is validated against the v1 event schema before commit; a failure takes the AC-4 path.
- **AC-17**: The web app creates one random browser ID, keeps it in `localStorage`, and sends it on runs and case reads; if storage is blocked or `crypto.randomUUID` is unavailable (outside a secure context), no ID is sent and the AC-10 fallback applies.
- **AC-18**: When a run finishes on `/transactions/investigation` (where live runs start), the page shows "Saved · Open case" linking to its case page, or "Not saved", using the same check as AC-10.
- **AC-19**: The Mode column and the case page show the fallback reason whenever a live request ran as recorded, so recorded and live stay visibly distinct.

## Decision

**Chosen option**: Option 2: API written case row plus validated event log

The API stores each completed run as one summary row plus its ordered, schema validated contract events, in one transaction, scoped by an anonymous browser ID; the web app reads cases through two internal endpoints and a new case detail page.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (new migration `0004_showcase_cases.sql`, Neon PostgreSQL; `0003` is the simulation runs migration from spec 0003):

`showcase_cases`: one row per completed run, derived once from its events and never updated.

| Field | Type | Null | Source / rule |
|---|---|---|---|
| `case_id` | text PK | no | the run's `run_id` |
| `browser_id` | uuid | no | `X-Showcase-Browser-Id` header |
| `scenario_id` | text | no | events; `^S0[1-8]$` |
| `requested_mode` | text | no | `run_started` |
| `execution_mode` | text | no | `run_result` (`recorded` or `live`); must equal `run_started.execution_mode`, else the save fails (AC-4) |
| `fallback_reason` | text | yes | `run_started` |
| `provider`, `model_id` | text | yes | `run_started` (live runs only) |
| `deterministic_route` | text | no | `route_resolved` |
| `investigation_status` | text | no | `run_result` (`skipped`, `complete`, `incomplete`) |
| `recommendation` | text | no | `run_result` |
| `recommendation_basis` | text | no | `run_result` |
| `failure_reason` | text | yes | `investigation_result` (null when not incomplete) |
| `authority_status` | text | no | `run_result` (always `not_evaluated`) |
| `tool_call_count` | int | no | number of `tool_call` events |
| `evidence_count` | int | no | total items across every `tool_result.evidence[]` (today's Radar rule) |
| `event_count` | int | no | number of stored events |
| `fixture_version` | text | yes | `fixture_version` of the first evidence item in sequence order (null when no evidence) |
| `started_at` | timestamptz | no | server clock when the stream wrapper receives the `run_started` frame |
| `completed_at` | timestamptz | no | server clock when the stream wrapper receives the `run_result` frame |
| `expires_at` | timestamptz | no | `completed_at` plus 30 days |
| `contract_version` | text | no | `1.0` |

Indexes: (`browser_id`, `completed_at` desc, `case_id` desc) for paging; `expires_at` for cleanup. Check constraints mirror the contract enums. The migration must be rerunnable (`CREATE ... IF NOT EXISTS`, constraints added inside `DO` blocks), because the runner applies every file on every run and keeps no record of applied migrations.

`showcase_case_events`: the audit trail, append only.

| Field | Type | Null | Source / rule |
|---|---|---|---|
| `case_id` | text FK → `showcase_cases` | no | on delete cascade |
| `sequence` | int | no | event `sequence`; PK (`case_id`, `sequence`) |
| `event_id` | text | no | event `event_id`; unique per case (`case_id`, `event_id`), since IDs share a run derived prefix |
| `event_type` | text | no | event `event` |
| `payload` | jsonb | no | the full event exactly as emitted |
| `recorded_at` | timestamptz | no | server clock when the stream wrapper receives the event's frame |

Relationship: `showcase_cases` 1 : N `showcase_case_events`.

**State transitions**: none. A case exists only once complete and is immutable; the only later change is deletion (expiry or the 50 case cap).

**API surface** (internal, `include_in_schema=False`, like the Sandbox analytics route; the frozen public OpenAPI is untouched):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/showcase/investigations` | POST (existing) | body unchanged; `X-Showcase-Browser-Id: uuid` header (opt) | the unchanged SSE stream | none (as today) | unchanged; storage never adds an error |
| `/cases` | GET | header `X-Showcase-Browser-Id` (req); `limit:int` 1 to 20 (opt, default 20); `cursor:str` (opt); `scenario_id` `S01` to `S08` (opt); `recommendation` `PASS`, `CHALLENGE` or `HOLD` (opt) | `contract_version`, `items[]` (case summary rows, without `browser_id`), `next_cursor` or null, `totals` | browser ID scope | 400 `invalid_browser_id`, 400 `invalid_cursor`, 422 `invalid_parameters`, 503 `cases_unavailable` |
| `/cases/{case_id}` | GET | header `X-Showcase-Browser-Id` (req) | `contract_version`, `case` (summary row), `events[]` (`sequence`, `event_id`, `event_type`, `recorded_at`, `payload`) in sequence order | browser ID scope | 400 `invalid_browser_id`, 404 `case_not_found`, 503 `cases_unavailable` |

`totals`, over all of the browser's unexpired cases (filters ignored), using today's Radar rules exactly:
- `total`: number of cases.
- `by_recommendation` {`PASS`, `CHALLENGE`, `HOLD`}: count by `recommendation`.
- `by_scenario`: {`S01` to `S08` → {`PASS`, `CHALLENGE`, `HOLD`}}, zero filled for every scenario.
- `deterministic_passes`: cases with `deterministic_route` = `PASS`.
- `fail_safe_holds`: cases with `recommendation_basis` = `fail_safe`.
- `completed_investigations`: cases with `investigation_status` = `complete`.

Paging: order by (`completed_at` desc, `case_id` desc); fetch `limit` plus 1 rows, and return `next_cursor` only when that extra row exists. The cursor is base64url of `<completed_at ISO 8601 with microseconds>|<case_id>` from the last row returned; it stays valid when filters change (it only marks a position). A cursor that fails to decode returns 400 `invalid_cursor`.

Errors: checked in this order, first failure wins: storage disabled or unreachable (503 `cases_unavailable`), then a missing or malformed header (400 `invalid_browser_id`), then parameters (400 `invalid_cursor`, 422 `invalid_parameters`). Bodies use the showcase shape `{"detail": {"code": ..., "message": ...}}`, and a `/cases` exception handler replaces FastAPI's default 422 body so request input is never echoed back.

New web route: `/transactions/:caseId` in `ProductApp.tsx`, inside the Payments shell; `/transactions` itself stays a planned page. The page accepts only IDs matching `^run_[a-z0-9_]{3,64}$` and shows not found without a request otherwise. The existing `/transactions/new` and `/transactions/investigation` routes are declared first, so they keep their pages.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Store case | every column above | the table's Source column (the emitted events, the header, the server clock) |
| Store case | whether to store at all | `SHOWCASE_CASES_ENABLED` is true, `DATABASE_URL` is set, and the header is a valid UUID |
| Store case | which events | every emitted event carrying the v1 event identity (`event_id`), i.e. all but `done` |
| Store case | where events are captured | a wrapper in `main.py` around the runtime's SSE output: it parses each `data:` frame with `json.loads` and keeps the ones carrying `event_id`; the drift tested runtime is not changed |
| Store case | commit moment | when the wrapper sees the `event: done` frame (after `run_result`), it commits, then passes the frame through unchanged, so a read after `done` finds the case |
| Store case | commit limits | `asyncio.to_thread` with `connect_timeout` and `statement_timeout` of 3 seconds; the thread is shielded from stream cancellation |
| Store case | event validation | a `jsonschema` `Draft202012Validator` for `public-showcase-events.v1.schema.json`, compiled once at startup |
| `GET /cases` | this browser's cases | `browser_id` column = header value, `expires_at` > now |
| `GET /cases` | page order and next page | (`completed_at` desc, `case_id` desc); `next_cursor` from the last row |
| `GET /cases` | `totals` | aggregate over all this browser's unexpired rows, ignoring filters |
| Radar Cases tab | stat cards and breakdown | `totals` (Runs completed = `total`; PASS, CHALLENGE, HOLD = `by_recommendation`; PASS detail = `deterministic_passes`; HOLD detail = `fail_safe_holds`; Runs detail = `completed_investigations`; breakdown chart = `by_scenario`) |
| Radar Cases tab | tab count badge | `totals.total` (fallback mode: this visit's run count) |
| Radar Cases tab | table rows and paging | `items[]`, then `next_cursor` for "Show more" |
| Radar Cases tab | "Time" column | `completed_at`, shown in the browser's local time |
| Radar Cases tab | saved or not saved after a run | after `done`, refetch the first page of `GET /cases`: the run's `case_id` present means saved; absent means an unlinked "Not saved" row outside the totals; `503` or failure means the environment wide fallback (AC-10) |
| Investigation page | saved state after a run | the same refetch as the Radar Cases tab (AC-18) |
| Radar Cases tab | fallback rows | the current in memory session runs (today's behaviour) |
| Case page | header fields | `case` summary row |
| Case page | Route stage | stored `run_started`, `route_resolved`, `investigation_skipped` events |
| Case page | Evidence stage | stored `tool_call` and `tool_result` events (evidence items), `investigation_result.claims[].evidence_ids` |
| Case page | Outcome stage | stored `investigation_result` and `run_result` events |
| Case page | failure banner | `investigation_status` = `incomplete` plus `failure_reason` |
| Case page | failure reason wording | the existing `FAILURE_REASON_LABELS` in `src/components/console/ShowcaseTrace.tsx` |
| Case page | failure explanation | the stored `investigation_result.summary` (the server's fixed failure summary) |
| Case page | failure banner trigger | the stored `investigation_result` event (`investigation_status` = `incomplete`), not only the summary column |
| Case page and Mode column | fallback reason | `fallback_reason` column (from `run_started`) |
| Case page | event recorded times | `events[].recorded_at` |
| Web, any request | browser ID | `localStorage` key `showcase-browser-id`, created once with `crypto.randomUUID()`; the Radar iframe is served from the same origin without a `sandbox` attribute, so it shares this storage; its `?case=` URL is mirrored onto the top level `/radar` URL with `replaceState`, and its full page links use `target="_top"` |

**Copy** (Radar's second tab; storage on / fallback):

| Where | Today | Cases (storage on) | Fallback (storage off) |
|---|---|---|---|
| Tab label | Session | Cases, count `totals.total` | Cases, count of this visit's runs |
| Section heading | Synthetic showcase decision stream | Saved cases | This visit's runs |
| Section description | Only completed, synthetic showcase runs from this browser session appear here. No payments are executed and no runtime model score is shown. | Completed synthetic showcase runs from this browser, kept for 30 days (up to 50). No payments are executed and no runtime model score is shown. | Not saved: case history is off in this environment. Only this visit's runs appear here. No payments are executed and no runtime model score is shown. |
| Empty state title | No showcase runs yet | No saved cases yet | No showcase runs yet |
| Empty state copy ending | Runs stay in this browser session only. | Saved cases stay in this browser for 30 days. | Runs stay in this browser session only. |
| Table title | Current session decisions | Cases | This visit's decisions |
| Breakdown chart title | Current session recommendations | Recommendations by scenario | Recommendations by scenario |
| Breakdown empty message | No completed showcase runs in this session. | No saved cases yet. | No completed showcase runs in this session. |
| Unsaved row tag | none | Not saved | none (the whole tab carries the note) |

**Key invariants**:
- A case and all its events are committed in one transaction, or nothing is.
- The stream's content and order never depend on storage; storage runs after an event is emitted and cannot alter or block it.
- Stored events are never edited; the case row is built only from them and never updated, so its derived columns cannot go stale.
- `event_count` equals the number of stored events; `(case_id, sequence)` and `event_id` are unique.
- Every read filters by `browser_id` and `expires_at > now`, so another browser's or an expired case is indistinguishable from a missing one.
- After each write, the browser has at most 50 cases. The write takes `pg_advisory_xact_lock` on a hash of the browser ID inside its transaction, so parallel writes from one browser cannot overshoot the cap.
- The stream never waits on storage longer than the 3 second commit limit.
- A stored case keeps the contract's safety facts as emitted: `authority_status = not_evaluated`, `simulated_action = none`, and a fail safe basis whenever the investigation is incomplete.

**Security model**:
- No sign in. The browser ID is a scoping key, not authentication: whoever holds it sees those cases. Only lowercase version 4 UUIDs are accepted. It never feeds live admission or rate limiting, which keep using trusted ingress metadata only (caller supplied identity headers stay ignored there). This is acceptable only because every case is synthetic showcase data; F5 replaces it with real identity.
- A case is private to its browser. A `/radar?case=<id>` or `/transactions/<id>` link opens only in the browser that saved the case; anywhere else it shows "Case not found".
- Stored content is exactly the contract events, which already exclude prompts, raw provider responses and reasoning. No new personal data is collected; the browser ID is random and tied to nothing.
- Retention: 30 days and 50 cases per browser. This must be recorded in the data governance section of `context/architecture.md`.
- No new rate limiter: the endpoints are internal and disabled in public. A limiter is a prerequisite for any public enablement (see Follow-up).
- No server logging yet: a failed save is caught and the stream continues unchanged, but nothing is logged. Logging is owed (see Follow-up); when added, it records `case_persisted` and `case_persist_failed` with a failure class only, never payloads, case IDs or browser IDs.

**Configuration required**:
- `SHOWCASE_CASES_ENABLED`: turns case storage and the `/cases` endpoints on; default false, and left unset in the public deployment.
- `DATABASE_URL`: existing, reused; case storage also requires it.
- Dependency: `jsonschema` moves from the API's dev group into its runtime dependencies, and the event schema file is located through a settings path that also works in the deployed container.

**Critical test scenarios**:
- Happy path: an S04 recorded run with a valid header is stored with all its events in order, then appears first in `GET /cases` and in full from `GET /cases/{run_id}`; verifies **AC-1**, **AC-6**, **AC-11**, **AC-13**.
- Frozen stream: the SSE output with and without storage is identical, and the drift tests pass; verifies **AC-2**.
- Save fails: a database error at commit leaves zero rows in both tables, the stream still ends with `done`, and the web app shows "Not saved"; verifies **AC-4**, **AC-16**.
- No result: a run that raises before `run_result` stores nothing, while a live timeout run is stored as incomplete; verifies **AC-5**, **AC-12**.
- Slow database: a commit over 3 seconds leaves nothing stored and `done` still arrives; verifies **AC-4**.
- Paging: 21 cases give a full first page, a `next_cursor`, and one row on the second page; a garbled cursor returns 400; verifies **AC-6**.
- Fallback reason: a live request that ran as recorded shows its reason in the Mode column and on the case page; verifies **AC-19**.
- Failure path: an S05 run shows the failure banner with the fail safe HOLD and failure reason, and no completed styling; verifies **AC-12**.
- Scoping: browser B requesting browser A's case, a random ID, and an expired case all receive the same `404 case_not_found`; verifies **AC-7**, **AC-8**.
- Cap: a 51st case removes the oldest, including when two runs from one browser commit at once; verifies **AC-8**.
- Disabled: with the flag off, no database connection is attempted and Radar falls back to session runs with the note; verifies **AC-10**, **AC-15**, **AC-3**.
- Drawer: clicking a Run ID opens the case drawer and adds `?case=`; Escape, Close and Back close it and return focus to the row; a shared `?case=` link reopens it; verifies **AC-9**.

## Build plan

Build approach: none is recorded in the project, so this assumes thin end to end slices (Tracer Bullet): one stored case visible in the browser first, then the list, then the full detail page.

**Slice 1: one case, stored and readable**
1. [x] Draft `docs/proposals/schemas/showcase-cases.v0.proposed.schema.json` (proposed, not accepted; it moves to `docs/contracts/` when an ADR accepts it) for the list and detail responses and the header, with contract tests; satisfies **AC-6**, **AC-7**.
2. [x] Add a rerunnable migration `0004_showcase_cases.sql` for both tables, and widen `apply_sandbox_migrations.py`'s file glob (today `*_sandbox_*.sql`) so it applies every numbered migration; satisfies **AC-1**, **AC-8**.
3. [x] Add `SHOWCASE_CASES_ENABLED` and the event schema path to the API settings and `.env.example`, a lowercase version 4 UUID browser ID validator, and move `jsonschema` into runtime dependencies with the validator compiled at startup; satisfies **AC-3**, **AC-15**, **AC-16**.
4. [x] Add a case repository beside `server/sandbox_data/` (psycopg): insert case plus events plus cleanup in one transaction under a per browser advisory lock, with 3 second connection and statement timeouts; read list, read one; satisfies **AC-1**, **AC-7**, **AC-8**.
5. [x] In `main.py`, wrap the runtime's SSE output without changing the runtime: parse each `data:` frame, buffer the identity bearing events with their receive times, and on the `event: done` frame validate and commit through a shielded `asyncio.to_thread`, then yield the frame unchanged; roll back on any failure without altering the stream (logging is owed, see Follow-up); store nothing when there is no `run_result`; satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-16**.
6. [x] Add `GET /cases/{case_id}` (internal); satisfies **AC-7**.
7. [x] Web: add `src/lib/showcase-browser-id.ts` (created only from the top level app, blocked when `localStorage` or `crypto.randomUUID` is unavailable) and send the header from `useShowcaseInvestigation`; satisfies **AC-17**.
8. [x] Web: add the `/transactions/:caseId` route (ID format checked before any request) with a minimal case page (header and a plain event list) and its loading, not found and unavailable states; satisfies **AC-11**, **AC-14**.

**Slice 2: the Cases list**
9. [x] Add `GET /cases` with paging (`limit` plus 1, base64url cursor), filters, `totals`, the error order and the non echoing 422 handler; satisfies **AC-6**, **AC-8**.
10. [x] Web: add `src/lib/showcase-cases.ts` (types and fetchers) and a hook; rename Radar's Session tab to Cases and fill it from `GET /cases` with the Copy table, filters, "Show more", the tab count, the local time column, the fallback reason in the Mode column, the saved check (refetch after each run); satisfies **AC-9**, **AC-19**.
10a. [x] Web: the case drawer (shadcn `Sheet`, the same Route, Evidence and Outcome stages as the case page, in Radar's own styles), `?case=<id>` history handling with focus return, and removal of the unlabelled share bar; satisfies **AC-9**, **AC-11**, **AC-13**.
11. [x] Web: the storage unavailable fallback with the "Not saved" note, and unlinked "Not saved" rows outside the totals; satisfies **AC-10**.
11a. [x] Web: show "Saved · Open case" or "Not saved" on `/transactions/investigation` after each run; satisfies **AC-18**.

**Slice 3: the full case page**
12. [x] Group events into Route, Evidence and Outcome stages, each expandable to its raw events, reusing `ShowcaseModeLabel`, `ShowcaseEvidenceTrace` and `ShowcaseOutcome` from `src/components/console/ShowcaseTrace.tsx` where they fit; satisfies **AC-11**, **AC-19**.
13. [x] Evidence items and claims with evidence ID links; satisfies **AC-13**.
14. [x] The failure banner from the stored `investigation_result`, using the existing `FAILURE_REASON_LABELS` and the stored summary; satisfies **AC-12**.
15. [x] The error with retry state and the "Back to Radar" link; satisfies **AC-14**.

**Across slices**
16. [x] API tests for storage, rollback, scoping, retention and the cap, and a check that the frozen drift tests are unchanged; Playwright tests for the Cases tab (both modes) and the case page states; satisfies **AC-1** to **AC-19**.

## Consequences

**Positive**:
- Investigations become auditable after the fact, from the exact events that produced them, with no new decision logic.
- Radar's second tab gains durable history without changing its layout.
- The case page is built once on the product side, ready for F5 review and F6 replay.

**Negative / tradeoffs**:
- A run still lives only as long as its request: a closed tab mid run loses it, and one closed just after `run_result` may be saved without the visitor seeing it finish. True durable processing is F3 (ADR-009) and not part of this spec.
- The browser ID is weak scoping; clearing site data loses access to past cases, and anyone holding the ID can read them.
- The public showcase gains nothing until an ADR accepts a public database, so the recruiter facing demo still shows session only runs.
- Buffering events and committing before `done` adds a small delay to the end of each stored run.
- Expired rows for browsers that never return linger until a later write or a sweep.

**Neutral**:
- A new internal contract (`docs/proposals/schemas/showcase-cases.v0.proposed.schema.json`, proposed) and a fourth migration (`0004`).
- The migration runner starts applying every numbered migration, not only Sandbox ones.

## Follow-up

- [ ] Record F4 in `context/progress_tracker.md` (implementation plan status) and the case retention statement in `context/architecture.md`'s data governance rules, once built.
- [ ] Add server logging for case storage (`case_persisted`, `case_persist_failed` with a failure class only), owed since the build shipped without it.
- [ ] Write the ADR that accepts the showcase cases contract (promoting it from `docs/proposals/schemas/` to `docs/contracts/showcase-cases.v1.schema.json`) and case persistence, and decide separately whether the public showcase may run a database (this reverses part of ADR-016).
- [ ] Before any public enablement: a per browser and per client rate limit on `/cases`, a sweep for expired rows, and a hosting and secrets plan for the database.
- [ ] F5 hook: the case page is where review decisions, claiming and the S06 stale version error ("This case was updated by someone else; reload before deciding") will live; `/reviews` hosts the queue. Real identity replaces the browser ID.
- [ ] F6 hook: a Radar Health tab (data freshness, dataset versions, provider status) and a read only replay and compare view on the case page for S08, badged "Replay, no action taken"; replay must never write a second case for the same run.
- [ ] Decide whether `/transactions` (still a planned page) becomes the full case list outside Radar.
- [ ] A 30 day sweep script, if lingering expired rows matter before public enablement.
