# ADR-021 — Allow the public showcase one guarded PostgreSQL database

Status: Proposed  
Date: 2026-09-27  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3  
Backlog task: public enablement of saved cases (spec 0002), the live feed (specs 0003, 0004, 0008) and Sandbox analytics (spec 0001)  
Related decisions: ADR-009, ADR-010, ADR-014, ADR-016, ADR-017 and ADR-020  
Repository scope: `infra/azure/`, `.github/workflows/deploy-showcase.yml`, `scripts/verify_mvp3_deployment_config.py`, `apps/api/server/showcase_cases/`, `apps/api/server/sandbox_data/`, `apps/api/migrations/`

## Context and evidence

The public showcase (Azure Static Web Apps plus one Container App, 0 to 1
replicas, UK South) is database free. ADR-014 kept a database out of scope,
ADR-016 accepted its fixtures "for the database-free showcase", and ADR-017
states that "no path persists run state". The deployment template sets no
`DATABASE_URL`, so the public Risk Console shows its fallbacks: "Not saved:
case history is off in this environment" for cases, and no live feed or
Sandbox analytics.

Locally, three features use one Neon PostgreSQL database (AWS `eu-west-2`,
London), all verified on 2026-09-27:

- Saved cases (spec 0002, and feed cases from spec 0004). Spec 0002 passed
  all 40 verify steps. ADR-020 accepted them for local and internal
  use only on 2026-09-27.
- The live feed (specs 0003 and 0008). Spec 0003 passed all 28 verify
  steps; the Mixed feed passed its checks.
- Sandbox scenario analytics (spec 0001), read only.

Existing protections, and their gaps for a public audience:

| Protection | Today | Gap in public |
|---|---|---|
| Feed starts | 10 per browser ID per rolling minute; 20 live runs site wide | A browser ID is a random value the client supplies, so one client can mint IDs. The site cap bounds concurrent runs, not total rows: a cancelled run frees its slot, and each run writes 200 event rows. |
| Feed retention | Finished runs swept after 7 days, hourly, by the in API worker | Adequate. |
| Case writes | Only from the API's own stream; the investigation route already has a per client admission limit keyed on a server derived client identity | Adequate for writes. |
| Case reads | Scoped by browser ID; no rate limit | Unbounded reads against the database. |
| Case retention | Expired rows hidden on read; each write trims that browser's expired rows and caps it at 50 showcase and 20 feed cases | A browser that never returns leaves its rows until something deletes them; there is no site wide sweep. |
| Total size | No ceiling | Nothing stops growth before cost or the provider's plan limit. |

The subscription budget is a £10 equivalent monthly budget with 80% and
100% alerts, whose delivery has never been exercised.

## Decision to be made

May the public showcase connect to one PostgreSQL database for saved cases,
the live feed and Sandbox analytics, and under which guards?

## Constraints

- The frozen v1 stream contracts (ADR-012, ADR-015) do not change.
- No path may approve, release or execute a payment; stored data stays
  synthetic (accepted contract events, derived fields, scheduled synthetic
  payments, sanitised Sandbox aggregates).
- The browser ID is a scoping key, not authentication (ADR-010 identity
  remains unaccepted), and never appears in a URL, response body or log.
- Secrets never enter source control, Bicep parameters or the image.
- The monthly budget is a £10 equivalent.

## Options considered

1. **Stay database free.** No risk and no cost. The public console never
   shows saved cases, the live feed, or Sandbox analytics, which are the
   features built since the last release.
2. **One guarded Neon database for the public showcase (proposed).** A
   dedicated Neon project or branch in the same London region, a least
   privilege runtime role, and the guards below. Low cost and no new vendor.
3. **Azure Database for PostgreSQL (Flexible Server).** Keeps everything in
   Azure, but its smallest always on tier likely exceeds the £10 budget and
   adds network and operations work for a synthetic showcase.
4. **Browser storage only.** Cases in IndexedDB, no live feed. Rejected in
   spec 0002's rationale: a browser written case is not an audit record, and
   the live feed needs a server clock.

## Proposed decision

Option 2, enabled only when every guard in "Contracts and invariants" is
built and verified.

1. The public API may use one PostgreSQL database on Neon, in a project or
   branch separate from development, in the London region. Development and
   tests never point at it.
2. The API connects with a runtime role limited to `SELECT`, `INSERT`,
   `UPDATE` and `DELETE` on the showcase tables. Migrations run as a separate
   step in the deployment workflow with a migration role; the app never runs
   DDL.
3. `DATABASE_URL` reaches the Container App as a secret from Doppler's
   production config, the same way the Groq key is prepared, never as a
   plain parameter.
4. Each feature stays behind its own flag, set explicitly in the template:
   `SHOWCASE_CASES_ENABLED` and `SIMULATION_WORKER_ENABLED`. Either can be
   turned off without a code change, and turning both off returns the public
   console to today's fallbacks.
5. Supersede in part: ADR-014's and ADR-016's "database free" wording and
   ADR-017's "no path persists run state", for the public showcase and only
   under this ADR's guards. Extends ADR-020's local scope to public.

## Contracts and invariants

Guards required before enablement:

- **A real client identity.** The investigation route keys its admission
  limit on `request.client.host`, and nothing tells uvicorn to trust the
  Azure ingress's forwarded headers (no `--forwarded-allow-ips`). In
  Container Apps that host is likely the ingress proxy, so every visitor may
  share one key. Before any per client guard counts, derive the client
  identity from the address the ingress records, trusting only the ingress
  hop so a client cannot spoof it, and confirm it in staging. This also
  affects the live investigation limit already deployed.
- **Per client start limit.** Feed starts are also limited per server
  derived client identity (the key the investigation admission already
  uses), not only per browser ID. The client identity is held in memory and
  never stored.
- **Case read limit.** `GET /cases` and `GET /cases/{case_id}` are rate
  limited per client identity, answering 429 with a stable code.
- **Site wide case sweep.** The worker deletes expired cases hourly, as it
  does finished runs.
- **Storage ceiling.** Above a configured row ceiling for cases, runs or
  events, new case writes and feed starts are refused with the existing
  "not saved" and 503 or 429 paths, and a warning is logged. Reads keep
  working.
- **Failure is harmless.** A database outage never breaks the investigation
  stream (already true) and never takes down `/health` or the recorded
  showcase.
- **Nothing identifying stored or logged.** Stored per row: the random
  browser ID and synthetic content only. No IP address, user agent or
  provider identifier is written. Logs carry fixed categories only.
- **Retention.** Cases 30 days, finished runs 7 days, both enforced by the
  sweeps. Sanitised Sandbox datasets are reference data and are not
  personal data.
- **Contracts.** The simulation endpoints get a versioned contract
  (`sandbox-simulation.v1`, drafted as
  `docs/proposals/schemas/sandbox-simulation.v0.proposed.openapi.json`)
  accepted with this ADR or before enablement;
  saved cases use `showcase-cases.v1` from ADR-020.

## Verification

Before enablement:

- The guards above have API tests, including a client that mints browser
  IDs and hits the per client limit, and a sweep test for expired cases.
- `scripts/verify_mvp3_deployment_config.py` fails if the template sets
  `DATABASE_URL` as a plain value, omits either flag, or points at a non
  London region.
- A staging deployment passes spec 0002's and 0003's `verify.md` against the
  public database, and the budget alerts are proven to arrive (a test alert
  or a lowered threshold).
- A rollback drill: both flags off, redeploy, and the console shows the
  fallbacks with no database connection attempted.

## Consequences and ownership

- The public console gains saved cases, the live feed and Sandbox
  analytics, and the project takes on one managed database, its secret and
  its cost.
- ADR-009's wider operational store stays unaccepted; this is a showcase
  store only.
- Owner: the product owner accepts or rejects this record, owns the Neon
  project and the budget, and approves the privacy position below.

## Open questions

- **Privacy.** A random browser ID kept for 30 days may count as an online
  identifier under UK GDPR. Proposed position: treat it as personal data,
  state it in a short privacy note on the page, store nothing else about the
  visitor, and rely on expiry for deletion. Does the owner accept that
  position, or should saved cases stay local only?
- **Neon plan.** Does the chosen Neon plan fit the storage ceiling and the
  £10 budget, and what are its limits when exceeded?
- **Worker placement.** The worker runs inside the API, and the Container App
  scales to zero, so feeds advance only while a replica is warm (an open
  stream keeps it warm). Is that acceptable, or should the worker run as a
  separate scheduled job?
- **Ceiling values** (answered by the owner on 2026-09-27). Per client: 20
  feed starts and 60 case reads per minute; the per browser start limit
  stays 10. Row ceilings: 20,000 cases, 2,000 feed runs, 400,000 feed
  events. All are settings, so they can change without a code change.

## Acceptance record

Accepted by:  
Date:  
Notes:  
