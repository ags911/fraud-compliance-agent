# ADR-020 — Accept local case persistence and the showcase cases contract

Status: Accepted  
Date: 2026-09-27  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3  
Backlog task: F4 durable investigation cases (spec 0002); live feed cases (spec 0004, slices 1 and 2)  
Related decisions: ADR-009, ADR-014, ADR-015, ADR-016 and ADR-017  
Repository scope: `apps/api/server/showcase_cases/`, `apps/api/migrations/0004_showcase_cases.sql`, `apps/api/migrations/0006_feed_decisions.sql`, `docs/proposals/schemas/showcase-cases.v0.proposed.schema.json`

## Context and evidence

Spec 0002 built a durable record of completed showcase runs, and spec 0004
extended it to live feed payments. Both are built locally and run against a
Neon PostgreSQL database, behind `SHOWCASE_CASES_ENABLED` (default off).

- A completed Run showcase stream is saved as one `showcase_cases` row plus
  its ordered, append only `showcase_case_events`, in one transaction. Every
  event is validated against the accepted `public-showcase-events.v1` schema
  before commit.
- A revealed non PASS feed payment is saved as an `origin = feed` case,
  through the same `build_case` and `EventValidator`.
- Cases are scoped to an anonymous `X-Showcase-Browser-Id` (a random
  version 4 UUID kept in the browser's `localStorage`). It is a scoping key,
  not authentication.
- Cases are kept 30 days and capped at 50 showcase and 20 feed cases per
  browser; each write trims that browser's expired and excess rows.
- The read routes `GET /cases` and `GET /cases/{case_id}` are internal
  (`include_in_schema=False`). Their shapes are in the proposed schema
  `showcase-cases.v0.proposed.schema.json`.
- Storage never alters the frozen stream: tests prove the stream is identical
  with and without storage, and a failed save only shows as "Not saved".
- Save outcomes are logged as `case_persisted` and `case_persist_failed` with
  a fixed failure class only (2026-09-27).

This conflicts with accepted records. ADR-017 states that "no path persists
run state", and ADR-014 and ADR-016 accept their decisions for the
database-free showcase. None of them authorises storing runs, so spec 0002
records that the cases contract and persistence need an ADR before they are
more than a local experiment.

Verification status: `apps/api/tests/test_showcase_cases.py` and the spec 0004
tests pass (`make api-test`, 445 tests, 2026-09-27). Spec 0004's `verify.md` is
fully ticked. Spec 0002's `verify.md` was updated for the Risk Console and run
with `/check verify` on 2026-09-27 against a local API and Neon: all 40 steps
pass, after two fixes (a malformed `?case=` link now shows "Case not found",
and the storage off note uses the AC-10 wording; commit `9accffa`). Spec 0002
is marked Accepted as a feature spec; that does not accept this ADR.

## Decision to be made

Should the repository accept durable case storage, and the cases read contract,
as its approved design for local and internal environments, while leaving the
public showcase database free?

## Constraints

- The frozen v1 stream contracts (ADR-012, ADR-015) must not change: no new
  event, field or ordering, and a stream ends in exactly one `done` event.
- A case is a record of a completed run, not durable processing. Durable
  processing, idempotent actions and review state stay with ADR-009 and F3.
- No path may approve, release or execute a payment. A saved case must not
  imply authority.
- Stored data must stay synthetic: accepted contract events, derived summary
  fields and a random browser ID. No provider identifiers or payloads.
- The public deployment has no database and no hosting or secrets plan for
  one.

## Options considered

1. **Keep cases as an unaccepted local experiment.** No change to accepted
   records. The built feature stays unofficial, and F4 and F5 cannot build on
   it.
2. **Accept case persistence for local and internal environments only
   (proposed).** Accepts the storage design and the read contract, supersedes
   ADR-017's persistence line in part for that scope, and leaves any public
   enablement to a separate ADR.
3. **Accept case persistence everywhere, including the public showcase.**
   Needs a public database, rate limits, an expiry sweep, a hosting and
   secrets plan and a privacy review of the browser ID, none of which exist.

## Proposed decision

Option 2.

1. Accept the case storage design in spec 0002 and the feed case extension in
   spec 0004 (slices 1 and 2) for local and internal environments.
2. On acceptance, promote `docs/proposals/schemas/showcase-cases.v0.proposed.schema.json`
   to `docs/contracts/showcase-cases.v1.schema.json` without changing its
   shapes, and point the tests at the new path.
3. Supersede in part ADR-017's "no path persists run state" for this scope
   only: a completed run may be recorded as a case when `SHOWCASE_CASES_ENABLED`
   is true and a database is configured. Every other ADR-017 statement stands.
4. The public showcase stays database free. `SHOWCASE_CASES_ENABLED` stays
   unset in the public deployment until a later ADR accepts a public database.

## Contracts and invariants

- **Stream unchanged.** Storage never adds, removes, reorders or alters a
  stream frame, and a storage failure never changes the stream.
- **Server written.** Only the API writes a case, from events it emitted
  itself. The browser never supplies case content.
- **Validated.** Every stored event passes the `public-showcase-events.v1`
  schema before commit, or nothing is stored.
- **Atomic and immutable.** A case and its events commit together or not at
  all. A case is never updated; the only later change is deletion by expiry
  or the per browser caps.
- **Scoped.** Reads return only the calling browser's unexpired cases. A
  missing, expired or other browser's case returns the same 404.
- **Off by default.** With `SHOWCASE_CASES_ENABLED` unset or false, the API
  makes no case database connection and every route behaves as before.
- **No authority.** `authority_status` is always `not_evaluated`. A fail safe
  HOLD is always shown as incomplete, never as a completed investigation.
- **Model score.** `model_score` and `model_version` stay null until a
  separate ADR approves a runtime score. A score may never decide a route, a
  recommendation or whether a case is saved.
- **Nothing identifying in logs or responses.** The browser ID never appears
  in a URL, response body or log; logs carry fixed failure classes only.

## Verification

Before this ADR is accepted (all three met on 2026-09-27; see Context):

- `make api-test` and `make api-lint` pass.
- Spec 0002's `verify.md` is updated for the Risk Console (the case drawer
  and `/?case=<id>` replace the removed case pages) and run with
  `/check verify`, with every step ticked or recorded as failing.
- The migrations `0004_showcase_cases.sql` and `0006_feed_decisions.sql`
  apply twice without error.

After acceptance, the tests read the promoted contract path, and a contract
test fails if a read response drifts from `showcase-cases.v1`.

## Consequences and ownership

- F4 has an accepted record to build on, and F5 (review queue, case actions)
  and F6 (replay in the case drawer) can reference `showcase-cases.v1`.
- The repository now depends on PostgreSQL for this feature in local and
  internal use. This does not accept ADR-009's wider operational store.
- Owner: the product owner accepts or rejects this record and owns the
  promoted contract. Changes to `showcase-cases.v1` need a new ADR or a
  versioned successor.

## Open questions

- Is the anonymous browser ID, kept 30 days, personal data under UK GDPR
  (an online identifier)? It does not block local use but must be answered
  before public enablement.
- Should the retention (30 days) and caps (50 showcase, 20 feed) be accepted
  as fixed values here, or stay tunable settings?
- Does the public database ADR also cover spec 0003's simulation runs, which
  share the same database?

## Acceptance record

Accepted by: Darren Gidado (product owner)  
Date: 2026-09-27  
Notes: Accepted as written, by the owner's explicit choice in a Claude Code session; recorded by Claude on that instruction. On acceptance the schema moved to `docs/contracts/showcase-cases.v1.schema.json` with its shapes unchanged, and the tests now read it there. The open questions stay open; the privacy question must be answered by ADR-021 before any public use.  
