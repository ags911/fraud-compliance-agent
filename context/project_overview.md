# Project Overview

> **Relationship to existing docs.** This `/context/` directory is a
> supplementary baseline, synthesized from every Markdown document in this
> repository (PRD, ADRs, proposals, experiments, design docs, audits) as of
> 2026-09-22. It does **not** replace or override `docs/project-context.md`,
> which root `AGENTS.md`/`CLAUDE.md` name as the canonical instruction source,
> nor the PRD/ADR authority chain those documents establish. Where this file
> and a primary source disagree, the primary source wins — treat this as a
> synthesis for orientation, not a new approval record. Root `AGENTS.md` has
> not been modified to point here. **Every "accepted" vs "proposed"/
> "candidate" marker below is load-bearing**: this repository repeatedly
> states that a proposal, a notebook result, or a "decided" direction note is
> not itself a contract acceptance — only a resolved ADR plus a versioned
> artifact under `docs/contracts/` is.

## Summary

Fraud Compliance Agent is a monorepo containing a provider-neutral
payment-risk decision demo: a React/Vite operator console (`apps/web`) and a
FastAPI backend (`apps/api`) that together demonstrate an auditable flow from
transaction signals to a simulated outcome, evidence, oversight, and review.
Per the PRD (`docs/product/prd.md`, v0.3, **status: candidate for approval,
not yet the ground-truth PRD**) and `docs/project-context.md`: this is a
**public recruiter/employer showcase, not a production financial service**.
It is production-shaped in architecture, contract-first interfaces, typed
state, testing, and data boundaries, but deliberately uses synthetic
scenarios and simulated actions. "It must not collect real customer data,
execute a payment, make a compliance claim, or imply a live fraud-performance
result."

**Document authority hierarchy** (PRD §1, once approved): (1) the PRD, (2)
accepted API ADRs and contracts, (3) the API Phase 0 backlog/PRD review, (4)
the dual-tier build plan, (5) the Fraud Risk Console implementation plan.
"An implementation plan may not silently override an accepted contract."
Until the PRD's own approval record (§12) is complete, the **API
repository's accepted Phase 0 ADR artifacts remain authoritative** for
backend contracts.

## Core Goals (PRD §2, §4)

**Product statement:** "Provide an auditable payment-risk orchestration
service that recommends safe payment routes, investigates only eligible
contextual cases, and makes any simulated action subject to independent
authority, oversight, and human-review controls." Not a replacement for a
PSP's fraud network — the first release proves a transparent, controlled
operating model for one provider-shaped payment flow.

**In scope (v1):** one provider adapter and canonical payment-event schema;
point-in-time feature derivation and deterministic fraud/APP controls; a
candidate calibrated tabular-model interface (Logistic Regression benchmark,
XGBoost primary candidate — model selection itself not yet approved); typed
`PASS`/`CHALLENGE`/`HOLD` recommendations; bounded contextual investigation
for permitted ambiguous/APP-risk cases only; simulated actions with
authority/oversight controls, durable history, and review; versioned
synthetic fixtures with later provider/Plaid integration testing; a React
operator console using the approved Payments design system.

**Explicit non-goals (v1):** real payment execution, real account blocking,
or automated chargeback filing; multi-PSP orchestration, Web3 rails,
breach-intelligence collection, or a universal agentic-commerce identity
signal; claims of production fraud-detection performance from synthetic
data; Arbiris governance-record exploration or evidence-pack assembly inside
this app (that stays the vendored SDK's own capability).

## Users and Jobs (PRD §3)

| User | Job |
|---|---|
| Fraud operator | Submit/select a payment, understand its facts, route, reasons, and current operational status. |
| Fraud reviewer | Safely claim and decide eligible cases, with conflict protection and an immutable record. |
| Administrator | View controlled configuration, integration health, access, and release provenance within server-enforced permissions. |
| Demonstrator | Run repeatable, truthfully labelled scenarios without implying live operational history. |

## Required Decision Flow (PRD §5, target — not fully built)

```
provider payment event
  → validate / canonicalise / version source facts
  → construct point-in-time feature snapshot
  → deterministic fraud and APP controls
  → calibrated-model score
  → PASS / CHALLENGE / HOLD recommendation
  → eligible contextual investigation only
  → authority check
  → oversight requirement
  → review where required
  → simulated action, operational history, and linked evidence delivery
```
"`PASS` is never synonymous with `RELEASE`. A low model score or investigator
recommendation cannot bypass a hard control or missing critical evidence."

## Current Core Flows (what actually runs today)

1. **Showcase investigation flow** (built): operator picks a scenario in
   `/transactions/investigation` → web calls `POST /showcase/investigations`
   → API loads the matching S01–S08 fixture, optionally runs a bounded
   tool-calling investigation (recorded or live Groq), and streams typed SSE
   events back → console renders the trace with evidence citations.
2. **Legacy custom-transaction flow** (built, local-only compatibility
   reference): `/transactions/new` → `POST /run` → legacy vendor pipeline
   (optional private Arbiris SDK) streams per-node output over SSE.
3. **Preset scenario flow** (built): `POST /run/preset/{scenario_id}` against
   the legacy A–F demo scenarios exposed by `GET /scenarios`.
4. **Model benchmark review** (built): `/insights` reads
   `GET /demo/model-summary`, an **accepted mechanics-only** Sparkov
   benchmark report — the only chart/metric surface backed by recorded
   evaluation data rather than a live/invented figure.
5. **Overview dashboard** (built): `/` and `/overview` render the shadcn
   dashboard with synthetic demo data, outside the Payments shell used by
   every other route.
6. **Stateless scoring (`POST /risk/score`) and stateful processing
   (`POST /transactions/{transaction_id}/process`)** (target, **not built**):
   named in the PRD/implementation plan as candidate operations only; exact
   paths/envelopes/status codes remain unresolved pending the canonical
   transaction, persistence, and identity proposals.

## Scenario Catalogue

**Target set S01–S08** (PRD §8, ADR-016 accepts the fixture values for
showcase use only):

| ID | Coverage | Acceptance condition |
|---|---|---|
| S01 | Trusted recurring payment | PASS recommendation, no invented action |
| S02 | High-value / high-velocity risk | HOLD cannot be bypassed |
| S03 | Account drain / new payee | APP hard control runs before fast release |
| S04 | Ambiguous contextual case | Bounded investigation → typed evidence + route (sole normal agent path) |
| S05 | Model/investigation outage | Truthful fail-safe HOLD, visible error state (explicit failure path) |
| S06 | Reviewer conflict | Stale review version fails without overwriting a decision |
| S07 | Duplicate process request | Same/resumed run; no second simulated action |
| S08 | Provider correction | New source revision, read-only replay, no repeat action |

S01–S03 and S06–S08 bypass the agent entirely; only S04 runs the agent
normally and S05 exercises its explicit incomplete/failure path. S06–S08
operational behavior (review/idempotency/replay) is deferred to F3–F6 — the
public API returns a stable redacted 503 for those today.

**Legacy A–F** (existing `GET /scenarios` presets, from the vendored SDK
example) are a separate, unmapped set: "Legacy API scenarios A–F are
characterised separately and mapped to this catalogue only through an
approved routing/scenario decision" — do not assume equivalence. A
same-named characterisation doc (`docs/proposals/legacy-scenario-characterisation.md`)
records only *candidate* overlaps (A~S02, B~S01, D/F~S03), each still
requiring an approved target-policy decision; C has no S01–S08 equivalent.

## Scope Boundaries

### Built and wired into runtime code
- SSE-streamed demo/showcase investigation endpoints, backed by synthetic
  fixtures only (S01–S05 runtime-ready; S06–S08 deferred).
- One optional live-provider integration (Groq), gated behind two
  independent off-by-default flags, with no fallback to a second LLM.
- CORS restricted to an explicit origin allowlist (never wildcard).
- No database or persistence layer; all state is in-memory, request-scoped,
  or read from committed fixture/JSON files.
- Azure Static Web Apps (console) + Azure Container Apps Consumption
  scale-to-zero (API) — **deployed and verified 2026-09-21** (see
  [`progress_tracker.md`](progress_tracker.md) for the release record).

### Present only as proposal/config — not runtime fact
- The six-entity canonical domain contract (`SourceEvent`,
  `CanonicalTransaction`, `FeatureSnapshot`, `Prediction`, `RunContext`,
  `OutcomeLabel`) — proposed (ADR-002), not accepted.
- PostgreSQL persistence, identity/roles/authentication, the operational
  `/risk/score` and `/transactions/{id}/process` API — all proposed
  (ADR-009, ADR-010, ADR-001/backlog P0-07/P0-08), not built. **MVP 1–3
  remain database-free by explicit design; no Azure database is
  authorised.**
- A numeric runtime fraud-model score or decision threshold — explicitly out
  of scope for the current showcase: "MVP 3 has no numeric runtime
  fraud-model score or decision threshold." Deferred to **F3a**.
- Plaid Sandbox: fixture data is labelled `source_class:
  "plaid_sandbox_derived"` for one narrow accepted case (S04's
  `get_account_activity_evidence`, ADR-019); there is no live Plaid API
  client in `server/`, and Plaid Sandbox is integration/feasibility
  evidence, never a labelled fraud-training corpus.
- Sparkov: **accepted only** as a checksum-verified **mechanics-only**
  benchmark corpus (`fraudTrain.csv` 1,296,675 rows / 7,506 positive;
  `fraudTest.csv` 555,719 rows / 2,145 positive) — cannot substantiate a
  production-performance claim. PaySim and IEEE-CIS were evaluated and
  **not pursued** (decision recorded 2026-09-22: PaySim's balance-drain
  columns are excluded by the source's own leakage warning; IEEE-CIS's
  Kaggle competition licence was never confirmed to permit this project's
  public-repo use).
- Stripe/Radar: not a selected provider integration anywhere; explicitly may
  never be used as a fraud training label (its score is Stripe's own
  payment-specific prediction, not independent ground truth).
- Azure: referenced only as a deployment target; no managed database,
  VNet, cache, queue, or production identity service is authorised.

### Deterministic Sandbox data plan (implementation prepared, not deployed)

The next data slice is intended to make scenario data time-aware and
repeatable without calling Plaid during an operator run. A controlled Plaid
Sandbox import would create a scenario-specific, versioned and sanitised
dataset in PostgreSQL. Scenario execution, replay and charts would then read
only that dataset and its derived daily aggregates.

- **Import boundary:** Plaid Sandbox is contacted only by an explicit setup
  or refresh job. It is never called from an operator scenario run, chart
  request or browser.
- **Scenario isolation:** every scenario has its own fixture version, stable
  seed, dated event history and expected derived facts. A run cannot append
  data to or otherwise affect another scenario.
- **Data boundary:** raw provider responses, access tokens, account IDs and
  transaction descriptions stay outside Git and outside the application
  store. The database contains only pseudonymised, sanitised events and
  derived aggregates needed for deterministic replay and display.
- **Time boundary:** a first S04 proof may use a proposed 180-day historical
  baseline plus dated incremental Sandbox events. The approved duration,
  fields and aggregation grain must be recorded in a fixture manifest before
  implementation.
- **Storage choice:** Neon PostgreSQL is selected for the Sandbox-only S04
  proof. It does not authorise a production deployment or alter the
  database-free showcase.

The repository contains an assumed-spec preparation slice: versioned
sanitised dataset and aggregate contracts, an idempotent Neon migration,
deterministic importer, repository, and a disabled-until-configured internal
aggregate endpoint. It requires a resolving ADR before it can be treated as an
accepted runtime contract. No Neon project, database URL, live Plaid access or
provider data is configured or committed.

### Incomplete/placeholder in the web app
- Routes `/transactions`, `/reviews`, `/rules/performance`, `/settings`
  render a generic `PlannedPage` placeholder.
- Deferred engineering increments (implementation plan §9.1, all "—" not
  started): I1 stateless scoring, I2 durable processing/actions, I3 typed
  investigation, I4 authenticated human review, I5 provider sync/monitoring/
  replay.

## MVP Staging (delivery plan, progress as of 2026-09-21)

| MVP | Goal | Status |
|---|---|---|
| MVP 0 — Local engineering foundation | Keep the synthetic showcase safe/reproducible | 9/9 ✓ |
| MVP 1 — Guided walkthrough | Explain the product, no setup/account | 6/6 automated ✓ (manual assistive-tech review pending) |
| MVP 2 — Live decision demonstration | One transparent simulated decision end-to-end | 6/6 ✓ |
| MVP 3 — Azure public showcase | Shareable cloud deployment + inspectable engineering story | 9/12 ✓ + 3 ◐ (Doppler config, budget-alert delivery, tour status step) |

"MVP 3 is complete when the public synthetic demo can be run reliably enough
for a portfolio review, costs are guarded, deployment limitations are
visible, and the project can be reproduced locally. It is not a
production-readiness claim." See
[`progress_tracker.md`](progress_tracker.md) for the F0–F6 technical-stage
table and the full Architectural Decisions Log.

## Showcase Technology Register (PRD §14 — "selected showcase stack, not a
production architecture approval")

Selected/deployed for the first public showcase: GitHub + Actions (CI
configured), Doppler (local usage exists, unused in the verified release),
Azure Static Web Apps (deployed 2026-09-21), Azure Container Apps Consumption
(deployed 2026-09-21). External data sources: Groq API (current, sole
optional live provider), Plaid Sandbox `/transactions/sync` (current,
notebooks/fixture-derivation only), Sparkov (current, offline mechanics
only), Stripe/Radar (not selected). **Deliberately deferred**: managed
PostgreSQL; Redis/cache/queue/worker scheduler; production
authentication/SSO/tenancy; production monitoring/SIEM/model registry;
payment-processor or bank-data production access.
