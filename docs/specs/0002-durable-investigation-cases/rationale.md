# 0002. Durable investigation cases: rationale

## Context

> ⚠️ Premise note: F4 is sequenced after F3 (durable processing), and the persistence it would build on (ADR-009) is still only proposed, with its run states marked "not accepted API enums". A full F4 would make the *run* durable. This spec deliberately narrows F4 to a durable *record* of runs that already completed, which needs only storage and a read API, no new decision semantics. Durable processing (a run that survives a closed tab or a restart) stays with F3 and needs its own spec.

Today every showcase investigation is request scoped. `POST /showcase/investigations` streams the accepted, frozen v1 events (run started, route resolved, tool call and result with typed evidence, investigation result with claims citing evidence IDs, run result), and the web app keeps the outcome in memory only. Radar's Session tab shows this visit's runs; a reload loses them, and nothing can be reopened, shared or audited later.

The forces:
- **Accepted boundaries.** The public showcase is database free (ADR-016), the showcase API contract is frozen and guarded by drift tests (ADR-012), and a terminal stream event is not evidence of persistence. Recorded and live runs must stay visibly distinct, and a failed investigation must never look completed (ADR-014 to ADR-017).
- **No identity.** Sign in arrives with F5, but any list of cases needs a scope now, and the public demo cannot become a shared log that anyone can fill.
- **No invented semantics.** Project rules forbid inventing contracts, thresholds or metrics; anything new must be proposed, not assumed.
- **Existing infrastructure.** Neon PostgreSQL, psycopg and a SQL migration runner already exist for the Sandbox store, behind `DATABASE_URL`, internal only.

Without a decision, F5 review and F6 replay have nothing durable to attach to, and the case detail page would be designed twice.

## Options considered

### Option 1: Browser posts the case after the run

The web app collects the streamed events and sends them to a new `POST /cases`.

**Pros**:
- Least change to the investigation endpoint.

**Cons**:
- The stored case is whatever the client claims, so it is not a trustworthy audit trail, which is the point of F4.
- Needs input validation and abuse handling for arbitrary uploaded cases.

### Option 2: API written case row plus validated event log (chosen)

The API buffers the events it emits, validates them against the v1 schema and commits one summary row plus the ordered events in one transaction, after `run_result` and before `done`, scoped by an anonymous browser ID header. Two internal read endpoints serve the list and the detail.

**Pros**:
- The audit trail is exactly what the system emitted; nothing can be forged by the client.
- Reuses the frozen event contract as the storage format, so there are no new decision semantics.
- The summary row makes paging, filters and totals cheap.

**Cons**:
- Touches the frozen endpoint's implementation (not its contract), so it needs care and tests to keep the stream identical.
- The summary row duplicates facts already in the events (acceptable because both are write once).

### Option 3: Browser storage only (IndexedDB)

Keep cases in the visitor's browser, with no backend change.

**Pros**:
- Works in the public showcase today, no database, no ADR.

**Cons**:
- Not server side and not auditable: it is a client cache, not the durable, typed case F4 is meant to prove.
- Nothing for F5 review or F6 replay to build on.

### Option 4: Fully normalised case tables

Separate tables for cases, evidence items, claims and tool calls.

**Pros**:
- Straightforward relational queries over evidence and claims.

**Cons**:
- Re models the frozen contract's shape and must change whenever the contract does.
- The audit trail becomes a reconstruction rather than the events as emitted.

## Rationale

Option 2 is the only one that makes a case trustworthy (written by the server from what it actually emitted) while inventing nothing: the storage format is the already accepted v1 event contract, and the summary row is derived once from it. It respects the accepted boundaries by keeping the frozen stream byte identical (the saved check is a separate read, never a new event) and by staying off in the database free public deployment behind an explicit flag, so a future `DATABASE_URL` there cannot switch it on by accident.

The anonymous browser ID in `localStorage` is the smallest scope that works without sign in and across the web and API origins; a third party cookie would silently fail in browsers that block them. It is honest only because the data is synthetic, and the spec says so. The 30 day, 50 case bounds keep storage predictable for an unauthenticated audience.

Option 1 fails the audit purpose, Option 3 fails the durability purpose, and Option 4 couples storage to a contract that is meant to stay frozen. The main cost of Option 2, touching the investigation endpoint's implementation, is contained by committing only after `run_result`, rolling back on any failure, and proving stream equality in tests.

## Changes after the build started (2026-09-24)

- **Migration number**: `0004`, because spec 0003's simulation runs took `0003` first.
- **Contract location**: kept under `docs/proposals/schemas/` as `v0.proposed` until an ADR accepts it, so an unaccepted schema never sits beside the accepted contracts.
- **Drawer, not navigation**: the engineer chose a right hand drawer over the Cases tab instead of leaving Radar for a new page. It keeps the table and filters in view, feels like an operator console, and gives the future regulatory references panel a natural home. The full page stays as a deep link fallback. The drawer uses shadcn's `Sheet` (not the bottom sheet `Drawer`), themed with Radar's own styles.
- **Share bar removed**: on the Cases tab it repeated the stat cards' split with no title or legend, so it read as a random line.
- **Logging deferred**: the build ships without server logging for case storage; it is recorded as owed rather than dropped.

