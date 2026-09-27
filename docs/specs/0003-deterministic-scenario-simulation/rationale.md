# 0003. Deterministic scenario simulation: rationale

## Context

> ⚠️ Premise note: the engineer intends to host this online, but the public showcase is database free by explicit design (ADR-016), and this feed needs Neon PostgreSQL. This spec designs the feed so it is safe to host (per browser ownership, limits, rate limiting), but it does not authorise a public database. That decision is shared with spec 0002's cases and is listed in Follow-up as a prerequisite for any public enablement.

The Radar dashboard shows sanitised Plaid Sandbox activity per scenario (spec 0001). On its own the data is static, so a demo shows a still picture. The product owner wants the dashboard to feel live: pick a scenario, switch Live on, and watch transactions, spend and the charts count up.

The forces: the imported datasets are the project's reference data and must never drift (an earlier short test run permanently added 3 payments to S02, which had to be repaired by hand). The browser must never be able to write payment data or advance the clock. The feed must be repeatable for demos and tests. It runs today in a local API with Neon, and is meant to be hosted, where many anonymous visitors could use it at once and nobody signs in. There is no audit or compliance scope: every value is synthetic.

Without a decision, the simulation stays an unratified assumption: its reset policy, run ownership and hosting model would be guessed each time it is touched.

Workspace: `apps/api` (FastAPI, psycopg, Neon) and `apps/web` (Radar reference page, React). No build approach is recorded, so the plan assumes thin end to end slices.

## Options considered

The engineer made most choices while building, and this ratification reviewed them. The alternatives below were weighed then.

### Option 1: Short predeclared bursts that append into the dataset (the first assumption)

A run adds 1 to 3 payments per scenario and writes them permanently into the scenario's transactions and aggregates.

**Pros**:
- Smallest schedule, and the analytics endpoint needs no overlay.

**Cons**:
- Barely moves the dashboard, so it does not feel live.
- Permanently changes the reference data for everyone; this is how S02 drifted.

### Option 2: A bounded, deterministic feed overlaid on the base, owned per browser (chosen)

Each run predeclares 200 payments; the worker only marks them shown, and analytics add one named run's shown payments to the untouched base. Runs are owned by the anonymous browser ID, with a site cap and a per browser rate limit counted in Neon.

**Pros**:
- Visibly live, repeatable, and resets cleanly; the base never drifts.
- Safe to host: visitors are isolated and the load is bounded.

**Cons**:
- A run schedules 200 rows up front, which needs a clean up sweep.
- The browser ID is scoping, not authentication: anyone holding it can stop that browser's feed.

### Option 3: An open ended generator until stopped

The worker keeps creating payments with no fixed schedule until the viewer presses Stop.

**Pros**:
- Truly continuous, with no schedule rows written in advance.

**Cons**:
- Needs a schema change (no fixed event count) and a runaway guard; not idempotent by sequence in the same simple way.

### Option 4: One shared run per scenario

The latest Start for a scenario wins for every viewer.

**Pros**:
- Simplest; no ownership or limits.

**Cons**:
- Hosted, one visitor's Start stops another visitor's demo midway.

## Rationale

The imported datasets are reference data (spec 0001), and the S02 repair showed what a permanent write costs. Overlaying shown events at read time keeps the base immutable and makes Stop and restart exact, which Option 1 cannot. A predeclared schedule keeps the idempotency boundary simple (`(run_id, sequence)`), which Option 3 gives up for a continuity nobody needs in a ten minute demo.

The engineer plans to host it, so ownership moved from one shared run per scenario (Option 4, fine locally) to one run per browser, reusing the anonymous browser ID that saved cases already use (spec 0002), so there is one scoping model and no sign in. Limits are counted in Neon from the runs table rather than in process memory, because a hosted API may run several replicas, and in memory counts would multiply the real limit. A transaction advisory lock around the check makes the cap exact under concurrent starts.

The worker runs inside the API behind a flag rather than as a separate scheduled job: it fits the single container showcase, needs no extra deployable, and paces every few seconds cheaply; `FOR UPDATE ... SKIP LOCKED` keeps several replicas from claiming the same rows. The standalone script stays for a separate job later. Payments are dated on the dataset's latest day so the chart window stays still and counts only go up; the page labels them simulated, so the past date is honest. The progress stream moves to `fetch` because EventSource cannot send headers, and putting the browser ID in a query string would leak it into URLs and logs.
