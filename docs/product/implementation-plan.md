# Fraud Risk showcase delivery plan

Status: single active candidate delivery plan, reconciled to the
recruiter-showcase boundary and Azure MVP 3 delivery on 2026-09-18. It does
not approve the candidate PRD, a contract, or post-Phase-0 implementation.

This plan consolidates the former console plan, dual-tier build plan, and ML
visualisation notes. Product requirements, decision flow, S01–S08, and I1–I5
scope remain in the PRD; model-specific evidence remains in the fast-path
technical record. This document owns delivery order, UI integration, and the
showcase completion checklist without duplicating those sources.

## Source material

- Candidate consolidated product requirements:
  `prd.md` (becomes authoritative only after approval)
- Canonical project rules: `../project-context.md`
- Current API implementation and existing-demo limits: `../../apps/api/README.md`
- Notebook/data gates: `../../notebooks/notebook-plan.md` and
  `../data-governance.md`
- Model evidence/limits:
  `../proposals/fast-path-fraud-model-technical-spec.md`

This monorepo's PRD, project context, contracts, and experiment records are the
current planning sources. Do not rely on a local attachment or a former
standalone-repository path as product authority.

## Cross-repository authority and delivery guardrails

The API repository is authoritative for backend capability, data contracts,
security, routing, authority, oversight, evidence, Plaid mapping, and delivery
approval. This frontend plan is authoritative only for presentation, navigation,
and client integration once those contracts exist.

- **Only API Phase 0 is approved.** Frontend shell and existing-demo integration
  can progress without extending the API, but no target backend endpoint, model,
  durable store, action flow, review mutation, or Plaid sync may be represented
  as approved or implemented before its Phase 0 exit gate and later scope are
  explicitly approved.
- **Existing demo versus target must remain visible.** The present `Sim B` can
  call an LLM for transactions that clear its pre-filter. The approved target
  moves only contextual/ambiguous or APP-concern investigation to the slow
  path; it is not yet the runtime contract.
- **The browser never supplies authority.** Authentication and server-derived
  actor/tenant context are prerequisites for the first non-local mutable
  operational endpoint, not a later UI hardening task.
- **Arbiris stays external.** This console may show linked record IDs and
  delivery/verification states. It does not retrieve or assemble evidence packs,
  expose governance records, or become an Arbiris dashboard.
- **Scenario IDs A–N are a coverage proposal.** Only A–F currently exist as
  API presets. G–N, including the unresolved Scenario L route, require the
  target scenario mapping approved in API Phase 0 before the UI treats them as
  runnable fixtures.

## Product definition

Build an operational fraud-risk console for three controlled user journeys:

1. Fraud operators monitor decisions, submit or select a transaction, and
   inspect its route and outcome.
2. Fraud reviewers claim cases and approve, override, reject, or request more
   information under optimistic concurrency.
3. Administrators manage rules, operational configuration, model promotion,
   access, and integrations within server-enforced permissions.

The console presents operational facts owned by the fraud API. It must not
become an Arbiris governance dashboard or evidence-pack builder. It may show
linked Arbiris record IDs, verification/delivery state, and outbound integration
health.

## Approved visual reference

The approved Rules Performance page is frozen as the visual starting point:

- Reference URL: `/rules-performance-reference.html`
- Reference source: `src/references/RulesPerformanceReference.tsx`
- Desktop baseline:
  `tests/payments-design-system.spec.ts-snapshots/rules-performance-desktop.png`
- Mobile baseline:
  `tests/payments-design-system.spec.ts-snapshots/rules-performance-mobile.png`
- Shared design contract: `../../apps/web/docs/design/payments-design-system.md`

The reference source is not the live product implementation. Do not edit it to
implement application behavior. Shared primitives may evolve only when the
reference visual tests remain green or an explicit design change is approved.

## Backend reality and UI policy

### Available now

| Endpoint | Frontend use |
| --- | --- |
| `GET /health` | Connection and demo-runtime status |
| `GET /scenarios` | Scenario selector |
| `POST /run` | Custom transaction run over SSE |
| `POST /run/preset/{scenario_id}` | Preset scenario run over SSE |

The current backend is an unauthenticated, single-operator demonstration. It
has no PostgreSQL operational store, durable review queue, model registry,
monitoring history, or production authentication.

### Approved target, not yet available

| Capability | Expected API dependency |
| --- | --- |
| Risk scoring | `POST /risk/score` |
| Durable processing | `POST /transactions/{transaction_id}/process` |
| Investigation | Provisional: target contract must decide whether this is a separate endpoint or part of processing |
| Transaction detail | `GET /transactions/{transaction_id}` |
| Linked evidence | Provisional operational links/delivery status only; evidence-pack retrieval remains in Arbiris |
| Review queue and detail | `GET /reviews`, `GET /reviews/{review_id}` |
| Versioned review mutation | `POST /reviews/{review_id}/decision` |
| Model registry and promotion | Provisional read contract; promotion remains an approved release-process concern, not an assumed dashboard mutation |
| Model health and drift | `GET /monitoring/model-health`, `GET /monitoring/drift` |

Endpoint names in this table are integration placeholders rather than approved
contracts. Until a target contract exists, the frontend must show an honest
unavailable or planned state. It must not fabricate production model metrics,
queue counts, false-positive rates, durable action outcomes, or completed
oversight.

## Information architecture

Use the approved sidebar and top bar as a single `AppShell`, then map navigation
to product-owned routes:

| Navigation | Route family | Primary job |
| --- | --- | --- |
| Overview | `/overview` | Monitor volume, holds, challenges, review pressure, decision health, and model health |
| Transactions | `/transactions`, `/transactions/:id` | Search decisions and inspect the complete transaction lifecycle |
| Reviews | `/reviews`, `/reviews/:id` | Claim and decide human-review cases safely |
| Rules | `/rules`, `/rules/performance` | Inspect rule definitions, status, outcomes, and performance |
| Insights | `/insights/models`, `/insights/drift` | Inspect model lineage, calibration, latency, prediction drift, and feature drift |
| Settings | `/settings/*` | Manage roles, action limits, policies, and integrations; expose release-process model information only where the API contract permits it |

The first viewport on every route remains an operational surface: core controls
and useful results appear before explanatory material.

## Page contracts

### Overview

- Processed volume and transaction count.
- Held and challenged volume.
- Hold/block rate.
- Review queue count and oldest-case age.
- Estimated false-positive rate only when labelled outcomes exist; otherwise
  display `Unavailable` with the reason.
- Production model, version, drift state, and p95 scoring latency.
- Recent decisions table linking to transaction detail.

### Transactions

- Server-backed search, filters, sorting, and pagination.
- Columns: transaction ID, amount/currency, calibrated ML probability, risk
  band, route, final action, evidence state, and time.
- Detail sections: raw source facts, point-in-time feature snapshot,
  deterministic results, model score/version, reason codes, investigation and
  tool calls, authority, oversight/review, action outcome, and Arbiris links.
- Clearly distinguish a recommendation such as `PASS` from an executed action
  such as `RELEASE`.

### Reviews

- Queue states: `OPEN`, `CLAIMED`, `REQUESTED_INFO`, `DECIDED`, and `EXPIRED`,
  subject to the final API contract.
- Claim ownership and server-derived reviewer identity.
- Decisions carry `expected_review_version`; stale mutations receive a visible
  conflict state instead of overwriting another reviewer.
- Approvals bind to transaction version, action, amount/currency, policy scope,
  and expiry. The UI never implies that human approval expands agent authority.

### Rules

- Retain the approved page geometry and component contracts.
- Replace fixtures with rule IDs, versions, enabled state, match counts,
  outcomes, and performance series from a versioned API contract.
- Keep outcome status pills semantic and keep the chart palette independent
  where categories represent aggregates rather than row state.
- Preserve shared date-range state between the date control and chart presets.

### Insights

- Production model ID/version and artifact lineage.
- Thresholds with explicit meanings: evaluation threshold, low route boundary,
  and high route boundary.
- PR-AUC, recall, calibration, p95 latency, and measurement context.
- Prediction and feature drift with `warning`/`critical` thresholds sourced
  from configuration, never embedded in presentation code.

### Settings

- Role-aware access for `scorer_operator`, `fraud_reviewer`,
  `model_approver`, and `administrator`.
- Rule/policy versions, action limits, environment, and integration status.
- Model promotion is a privileged, attributable mutation with confirmation and
  resulting evidence. It does not belong in the general Insights read view.

## MVP release plan and screen inventory

The F0–F6 sequence below describes technical dependency order. The MVPs are
the user-facing release slices built from that sequence. A screen is not
considered delivered merely because the sidebar contains its label: it needs a
truthful state and the data contract stated below.

### MVP 1 — Guided product walkthrough

Goal: let a recruiter, employer, or internal stakeholder understand the fraud
decision product without an account or a completed operational backend.

| Screen | Route | State and data in this MVP |
| --- | --- | --- |
| Overview | `/overview` | Shared app shell, persistent scenario selector, first-run zero state, guided demo, mock outcome mix, KPI strip, operational-health state, quick actions, and recent decisions. Values remain zero until an explicit scenario run. All demo content is labelled as representative data. |
| Benchmark Insights | `/insights` | Read-only API-backed Sparkov benchmark evidence: checksum-pinned dataset lineage, four deliberately narrow mechanics features, chronological partition counts, Logistic Regression/XGBoost metrics, and explicit non-deployable boundary. It must not show a transaction score, threshold, drift, or production claim. |
| Not Found | `*` | A branded recovery screen for any unavailable route, with a route back to Overview and no invented data or navigation state. |
| Rules Performance reference | `/rules-performance-reference.html` | Frozen design reference only. It supports visual comparison and is not a product screen or a data source. |

MVP 1 deliberately does **not** claim a live queue, live model monitoring, or
durable transaction history. Benchmark Insights is evaluation provenance—not
model monitoring—and remains explicitly synthetic/non-deployable. This is the
safe, portfolio-ready walkthrough that exists while the API remains a
single-operator demo.

### MVP 2 — Live decision demonstration

Goal: make the operator's core run observable against the Phase 0 API without
pretending that it is a production transaction store.

| Screen | Route | Required API data and behavior |
| --- | --- | --- |
| New transaction / decision run | `/transactions/new` | `GET /health`, `GET /scenarios`, `POST /run`, and `POST /run/preset/{scenario_id}`. Select or enter a transaction, start a run, stream validated SSE events, support cancellation/error state, and mark every action as simulated. |
| Decision workspace | `/transactions/run/:runId` or an in-place run result | `run_id`, `trace_id`, node status, deterministic results, model/rule outputs exposed by the current stream, counterfactual result, signed-record state, and the outage/fail-safe path. No hidden chain-of-thought. |
| Overview | `/overview` | Continues as the entry point. It may show the current demo scenario/run summary, but must not manufacture aggregate history from a transient run. |

A separate short guided tour for the decision workspace ships with this MVP (one tour per page, not one long tour across routes).

MVP 2 maps to F1–F2. It is successful when scenarios A–F and the LLM outage
can be run end to end with honest connection, loading, empty, and error states.

### MVP 3 — Azure public showcase

Goal: deploy the completed guided walkthrough and live decision demonstration
as one shareable Azure-based portfolio experience, without pretending it has a
durable financial-operation backend.

| Surface | Requirement in this MVP |
| --- | --- |
| Web console | Azure Static Web Apps hosts the synthetic React/Vite console. The API base URL is public configuration, never a secret. |
| Demo API | Azure Container Apps Consumption hosts the FastAPI demo with minimum replicas of zero. The UI exposes health, connection, cold-start, unavailable, and retry states. |
| Delivery | GitHub Actions validates builds/tests, then deploys through Azure OIDC. Bicep and a deployment runbook make the release reproducible. |
| Cost/safety | Doppler holds server-side secrets; no database, cache, VNet, real payment, or customer/provider data is deployed. A budget alert and free-grant review are documented. |
| Screens | MVP 1–2 screens are hosted unchanged: Overview, Benchmark Insights, New transaction/decision workspace, Not Found, and the frozen reference route. |

The guided tours gain a status step explaining API health and cold start.

MVP 3 is complete when a recruiter can follow the guided journey from a public
URL, inspect deployment/architecture documentation, and see the declared demo
limitations. It is not a production-readiness milestone.

### Deferred extension 1 — Core transaction operations

Goal: support real, durable operator work once the Phase 2 scoring and
transaction contracts are available.

| Screen | Route | Required API data and behavior |
| --- | --- | --- |
| Overview | `/overview` | Server-backed processed/held/challenged volume, review pressure, recent decisions, model version, drift state, and p95 latency. False-positive rate stays `Unavailable` until labelled outcomes exist. |
| Transactions | `/transactions` | Durable transaction list with server search, filters, sorting, pagination, route/action distinction, evidence state, and links to detail. |
| Transaction detail | `/transactions/:id` | Point-in-time source facts, feature snapshot, deterministic controls, model score/version, reason codes, authority, action outcome, evidence links, and lifecycle timeline. |
| Rules performance | `/rules/performance` | Versioned rules, enabled state, match/outcome counts, and time series from the API. Preserve the approved visual contract and shared range state. |

This deferred extension maps primarily to F3. It requires durable data: a retry must never read
as a duplicate action, and `PASS` (recommendation) must remain distinct from
`RELEASE` (executed action).

### Deferred extension 2 — Investigation and human review

Goal: let fraud teams investigate ambiguous decisions and make accountable
human-review decisions.

| Screen | Route | Required API data and behavior |
| --- | --- | --- |
| Investigation view | `/transactions/:id/investigation` or a transaction-detail tab | Typed investigation status, tool calls/results, evidence factors, timeout/malformed-data states, counterfactual context, and fail-safe result. |
| Reviews queue | `/reviews` | Server-filtered queue with `OPEN`, `CLAIMED`, `REQUESTED_INFO`, `DECIDED`, and `EXPIRED` states when the contract confirms them. |
| Review detail | `/reviews/:id` | Claim state, server-derived reviewer identity, decision form, authority/oversight explanation, evidence, and versioned mutation outcome. |
| Decision audit trail | `/transactions/:id` | Review decisions and override outcomes surfaced in the existing lifecycle view, with links back to the review record. |

This deferred extension maps to F4–F5 and requires authentication. It is complete only when
optimistic-concurrency conflicts, forbidden actions, expiry, and evidence
pending states are visible and cannot be mistaken for success.

### Deferred extension 3 — Governance, intelligence, and operational hardening

Goal: give privileged users controlled configuration and give operators a
truthful view of model health, drift, integrations, and replay.

| Screen | Route | Required API data and behavior |
| --- | --- | --- |
| Models | `/insights/models`, `/insights/models/:id` | Production model/version, artifact lineage, calibration/recall/PR-AUC, threshold meanings, latency, and measurement context. |
| Drift | `/insights/drift` | Prediction and feature drift, configured warning/critical thresholds, time windows, and missing-data state. |
| Policy and rule settings | `/settings/policies`, `/settings/rules` | Versioned configuration, role-aware edit access, confirmation, audit result, and unavailable state until the API supports mutation. |
| Model release status | `/settings/models/:id` | Read-only promoted-model and release provenance by default. A promotion mutation is out of scope unless the API's approved release-process contract expressly delegates it to this console. |
| Integrations and environment | `/settings/integrations`, `/settings/environment` | Plaid/integration health, environment, action limits, connection state, and recovery guidance. |
| Replay comparison | `/transactions/:id/replay` | Immutable comparison of an historical decision against a selected policy/model context; replay never executes a payment action. |

This deferred extension maps to F6. It is a production-shaped research milestone, not an excuse to
move governance into the operator dashboard or display unverifiable metrics.

### MVP progression at a glance

| MVP | Primary user | Core question answered | Screens added or made live |
| --- | --- | --- | --- |
| MVP 1 | Recruiter, employer, stakeholder | “What does this product do?” | Overview, Not Found, frozen reference for comparison |
| MVP 2 | Demonstrator, fraud operator | “How does one decision run?” | New transaction, streamed decision workspace |
| MVP 3 | Recruiter, employer, stakeholder | “Can I inspect a deployed cloud implementation?” | Azure-hosted MVP 1–2 screens, deployment/runbook evidence, health/cold-start state |
| Deferred 1 | Fraud operator | “What has happened and why?” | Live Overview, Transactions, Transaction detail, Rules performance |
| Deferred 2 | Fraud reviewer | “Can I investigate and decide this safely?” | Investigation, Reviews queue, Review detail, audit trail |
| Deferred 3 | Administrator, model approver, operator | “Is the system healthy, controlled, and auditable?” | Models, Drift, Settings, Integrations, Replay |

## Showcase MVP completion checklist

This is the operational source of truth for the recruiter-showcase delivery
state. A checked item has repository evidence as of 2026-09-19; an unchecked
item is planned, requires fresh verification, or needs a decision before it
can be claimed. Re-run the relevant check after a material change rather than
relying on a historical tick.

Progress on 2026-09-19: MVP 0 has 5 of 8 items checked, MVP 1 has 5 of 6, MVP 2 has
2 of 6, and MVP 3 has 0 of 10. Several unchecked items have partial evidence, noted
in their rows.

### MVP 0 — Engineering foundation

| Status | Completion item | Evidence / next action |
| --- | --- | --- |
| ✓ | Root monorepo separates web, API, contracts, notebooks, infrastructure, and shared documentation. | Repository map and project context. |
| ✓ | `make check` and GitHub Actions build the web app, lint Python/notebooks, enforce public-function docstrings, and run API smoke/tests. | `Makefile` and `.github/workflows/verify.yml`. CI now has three jobs: the web job (macOS, matching the screenshot baselines), the API job with the private SDK, and an API job with no SDK and no secrets that mirrors a public clone. Actions are pinned to commit SHAs. Data-path quality gates and the accessibility checks run in the same gate. |
| ✓ | FastAPI exposes current demo health, scenario, model-summary, and streamed-run endpoints. | `apps/api/server/main.py`. |
| ✓ | The web client contains API/SSE consumers for scenario listing, custom runs, preset runs, and benchmark evidence. | `apps/web/src/lib/useAgentRun.ts` and `demo-model-summary.ts`. |
| ✓ | Synthetic-data, Plaid Sandbox, Sparkov, notebook, and model-promotion boundaries are documented. | PRD, data governance, notebook plan, and project context. |
| — | Freeze a versioned showcase API contract for current request, response, error, and SSE-event shapes. | Add an accepted contract under `docs/contracts/`. |
| — | Run browser-to-local-API end-to-end checks for scenarios A–F and the LLM outage. | API level run 2026-09-19 (real pipeline, in process): A–F each returned HTTP 200 `text/event-stream`, five nodes in order (`data_ingest`, `sim_a`, `sim_b`, `counterfactual`, `evidence_pack`), one terminal `done`, and no error events. The outage flag changes nothing offline: external investigation is disabled by default, so every run is an outage run, and `sim_b` fails safe to HOLD for all six (A, D, F already HOLD at `sim_a`; B, C, E passed `sim_a` with scores 0, 63, 65). The non-outage path needs a live provider key. Browser run on 2026-09-19 against a real local API (nothing mocked): preset A completed end to end, showing Sim A 100/HOLD, Sim B "Stage 2 unavailable — fail-safe" HOLD, and a signed record marked "verification not performed"; Benchmark insights served the real Sparkov figures; with the API stopped, the console showed "Demo scenarios unavailable" and "Benchmark evidence unavailable". **Known defects found:** (1) the console's default custom transaction (category `TRANSFER_OUT` with velocity 3) fails after the first stage with `processing_failed`, because the vendored SDK example formats a missing 30-day average (`sim_a.py` line 173); (2) that failure appears as the raw code `processing_failed` instead of a plain-language message; (3) `/favicon.ico` returns 404 because `index.html` does not link the shipped `favicon.svg`. Presets B–F have not yet been driven through the browser. |
| — | Verify API error redaction and cross-origin configuration against the public-showcase environment. | Local defaults are tested: explicit origins only, no wildcard, and a foreign origin receives no grant (`apps/api/tests/test_demo_endpoints.py`). The stream emits only the stable error categories `processing_timeout` and `processing_failed`. Deployed configuration is still to test. |

### MVP 1 — Guided product walkthrough

| Status | Completion item | Evidence / next action |
| --- | --- | --- |
| ✓ | Overview has a first-run zero state, persistent scenario control, a first-visit welcome dialog that offers an opt-in guided tour, and synthetic-data labelling. | `apps/web/src/Overview.tsx`. |
| ✓ | Benchmark Insights presents mechanics-only evaluation evidence rather than a live-model claim. | `ModelBenchmark.tsx` and API model-summary route. |
| ✓ | A branded Not Found recovery state exists. | `ProductApp.tsx`. |
| ✓ | The approved Rules Performance reference remains a visual comparison, not live operational data. | Reference route and design-system rules. |
| — | Perform and retain screenshot/accessibility checks for every MVP 1 route at desktop and narrow widths. | Automated axe WCAG 2 A/AA checks (`apps/web/tests/accessibility.spec.ts`) now run on Overview, Benchmark insights, Analyse a transaction, a planned page, and Not found at desktop and narrow widths. Fixed 2026-09-19: unnamed selects and switches, unlabelled inputs, a keyboard-inaccessible scroll region, and a dangling `aria-controls`. Every rule passes except colour contrast, an open design-token decision. Six pairs are below 4.5:1: `#79797d` on white (4.33, sidebar status); `#788796` on white (3.68) and `#a7b0bf` on white (2.18), the pending pipeline stages on Analyse a transaction (the Overview checklist that shared them was removed); `#ce4761` on `#fbeff1` (3.98, "Simulate LLM outage"); `#5f708a` on `#fbeff1` (4.48); `#8f9bad` on white (2.81, run id). Screenshot baselines exist for Overview, Benchmark insights, the record panel, and the design references, but not for Not found, planned pages, or the full Analyse a transaction page. The Overview baselines were re-recorded on 2026-09-19 after the checklist was removed; the previous ones still showed the earlier "Kepler" branding and disabled navigation, which the 0.2% screenshot tolerance had hidden. Manual keyboard and screen-reader review is still needed. |
| ✓ | A first-visit welcome dialog offers a guided tour or skipping it, the answer is remembered for the browser session, and the tour is available afterwards from "How this demo works". | Decision 2026-09-19: the on-page "Getting started" checklist was removed because it took dashboard space, so the Overview opens straight into the KPIs. The welcome dialog states that the data is synthetic and that nothing can approve, release, or execute a payment; it is modal, answered by Skip, Take the tour, or Escape, and does not return on reload, navigation, or Reset (it does in a new session). The tour is an opt-in four-step spotlight (driver.js: choose, run, inspect, go deeper) with Next and Back that also follows the user's real actions, leaves the highlighted control and the open scenario menu clickable, and respects reduced motion. Covered by `apps/web/tests/welcome.spec.ts` (10 tests at each width) and `apps/web/tests/tour.spec.ts` (11 at each width). |

### MVP 2 — Live decision demonstration

| Status | Completion item | Evidence / next action |
| --- | --- | --- |
| ✓ | Web code can request current scenarios and consume the API's POST/SSE run flow. | `useAgentRun.ts`. |
| ✓ | API exposes preset and custom-run routes, including the simulated LLM-outage path. | `apps/api/server/main.py`. |
| — | Connect the final dashboard scenario control to the API-backed run flow, or document the standalone-workspace boundary. | Decide which surface is hosted as the canonical run experience. Proposed 2026-09-19 (not yet approved): keep the boundary. The header scenario control drives the synthetic dashboards (Overview and the shadcn dashboard), and the input panel on `/transactions/new` drives the live API run. Both read one scenario list mapped to S01–S08 so they cannot drift apart. |
| — | Verify loading, cancellation, connection failure, malformed stream, API error, and outage states in the browser. | Partly covered by browser tests with a mocked API (`apps/web/tests/live-decision.spec.ts`): a run needs an explicit terminal event, an HTTP failure is not treated as a stream, and cancellation does not report a completed outcome. Verified live in the browser on 2026-09-19 against a real API: connection failure ("unavailable" messages), the LLM-outage fail-safe HOLD (preset A), and an API error (`processing_failed`, shown as a raw code). Loading is not yet captured. Run the remaining matrix, including presets B–F. |
| — | Confirm every visible outcome is labelled simulated and no UI presents ephemeral data as durable history. | Review all MVP 2 states and copy. |
| — | Add a short guided tour of the decision workspace on `/transactions/new`. | One tour per page, started from that page's own help entry and reusing the Overview tour's pattern (opt-in, Next/Back, never auto-starts). It is not one long tour across routes: a route change unmounts the highlighted elements, so a cross-route tour is fragile. The Overview tour's last step, "Go deeper", already points here. |

### MVP 3 — Azure public showcase

| Status | Completion item | Evidence / next action |
| --- | --- | --- |
| — | Add reviewed Bicep under `infra/azure/` for only Azure Static Web Apps and Azure Container Apps Consumption. | No Azure resource definition exists yet. |
| — | Add GitHub Actions deployment through Azure OIDC. | Never commit Azure credentials or service-principal secrets. |
| — | Configure Doppler `showcase` values and host-side secret injection. | Verify no provider secret reaches Vite/browser output. |
| — | Configure Container Apps with minimum replicas zero and no database, VNet, cache, queue, or always-ready instance. | Document region and current free-grant limits. |
| — | Create and verify a budget alert. | Record that alerts notify but do not cap Azure consumption. |
| — | Deploy both applications and set explicit API allowed origins. | Verify health, cold-start, unavailable, retry, and local-demo fallback. `apps/web/public/staticwebapp.config.json` provides the single-page-app fallback and ships in the build, but it has not been tested on Azure. |
| — | Publish Azure architecture, runbook, teardown steps, and a public-demo smoke-test result. | Link the reviewed infrastructure artifacts and deployed URL. |
| — | Add an API status step to the guided tour for the health and cold-start state. | The first request to a scale-to-zero API can be slow, so explain the connection, cold-start, unavailable, and retry states where the UI shows them. It extends the per-page tours, not a new cross-route tour. |
| — | Rebuild the dashboard's trends and time-series chart from approved Plaid-derived fixtures scored by the decision engine. | The dashboard shows no sparklines or time-series chart until then: there is no recorded run history, and a generated series would misrepresent the demo. Real inputs come from Plaid Sandbox through the approved canonical mapping and sanitised fixtures for S01–S08, and the held, challenged, and passed outcomes come from our own engine, because Plaid supplies no fraud outcomes. Totals, sparklines, and the chart must all come from that one set. Sparkov stays benchmark evidence on Benchmark Insights only, labelled as such. |
| — | Add a read-only "Explain this decision" panel to the decision workspace (a dashboard-level "Explain" preview already exists on `/dashboard.html`: fixed and keyword questions answered only from the figures on screen, each citing its source card, labelled Preview with no language model), with fixed questions such as "Why was this held?" and "What would change the outcome?". | Answers come deterministically from the run's own evidence (reason codes, rule results, model factors, trace, counterfactual), so it cannot invent facts. It is not a free-text chatbot: that would need a PRD showcase-register entry (use case, owner, synthetic-data boundary, removal path), rate limits, and a budget cap, and an LLM could only rephrase evidence, never decide. |

## Frontend architecture

### Shell and routing

- Convert the current multi-entry product prototype into one application entry
  with client-side routes. Keep design-system and reference HTML entries outside
  the product router.
- Build `AppShell` from the approved sidebar, top bar, responsive sheet, and
  content-width rules.
- Derive active navigation and breadcrumbs from the route rather than local
  booleans.
- Keep search state and table filters in the URL so views can be bookmarked and
  revisited.

### Data boundary

- Create one typed API client using `VITE_API_BASE_URL`; route components do not
  call `fetch` directly.
- Validate external payloads at the boundary with shared/generated schemas once
  the Phase 0 contracts are frozen.
- Use TanStack Query for cache, refetch, mutations, and invalidation. Keep
  ephemeral component state in React.
- Retain the current fetch-stream SSE parser for demo POST streams, but move it
  behind a run service with explicit HTTP-status handling, cancellation, typed
  event validation, and reconnect behavior when durable run IDs arrive.
- Carry `trace_id`, `run_id`, and `transaction_id` through request state, error
  surfaces, detail links, and support diagnostics.

### Dense data components

- Use the shared shadcn table for simple detail grids.
- Use TanStack Table for server-backed operational lists requiring sorting,
  filtering, pagination, and column state.
- Use the shared Recharts wrapper for quantitative views.
- Preserve the approved Satoshi/Inter typography split and semantic design
  tokens; pages consume components rather than restating literal values.

### Authentication and authorization

- Add authentication before connecting any non-local mutable review, action, or
  model-promotion endpoint.
- Treat the server as authoritative for actor, tenant/firm, permissions, and
  record access. Client-side hiding is usability only, not enforcement.
- Keep the local bypass explicit, visibly labelled, and impossible in deployed
  configuration.

### State and failure behavior

Every data surface provides loading, empty, error, stale, and success states.
Mutation surfaces additionally cover conflict, forbidden, expired,
revalidation-failed, accepted/pending, and committed-with-evidence-pending where
the backend contract permits those states. Raw backend exception strings are
never rendered directly.

## Delivery sequence

### F0 — Preserve the design and define contracts

Status: reference clone created; visual regression coverage exists.

- Keep the reference route immutable.
- Add a frontend API capability map tied to the Phase 0 contract artifacts.
- Define generated/shared TypeScript schemas only after the backend contracts
  are approved.
- Gate: the reference route and current Rules Performance route render
  identically on desktop and mobile.

### F1 — Build the real application shell

- Introduce the product router and `AppShell`.
- Convert sidebar items to real links with route-derived active state.
- Add global error handling, route loading states, connection status, and URL
  search/filter conventions.
- Keep the existing demo console available during migration.
- Gate: keyboard, mobile-sheet, responsive, accessibility, and visual shell
  tests pass.

### F2 — Integrate what the API supports today

- Rehouse scenario selection and custom run submission in the approved shell.
- Present streamed nodes as a transaction decision workspace.
- Show real Sim A, Sim B, counterfactual, signed-record, outage, and
  evidence-path data; label all payment actions as simulated.
- Do not manufacture aggregate dashboard history from one transient run.
- Gate: scenarios A–F and the LLM outage can be demonstrated end to end.

### F3 — Fast-path operations

Dependency: backend Phase 2 contracts and endpoints, including authentication
before any exposed mutable operational request.

- Add score/process workflows, transaction list/detail, recent decisions, and
  overview metrics backed by PostgreSQL state.
- Surface model, policy, feature, run, and evidence lineage.
- Gate: retries do not imply duplicate actions, `PASS` and `RELEASE` remain
  distinct, and fast-path UI has no LLM dependency.

### F4 — Investigation workspace

Dependency: backend Phase 3.

- Add typed investigation status, tool calls/results, evidence factors, and
  fail-safe outcomes to transaction detail.
- Gate: ambiguous-only slow path, timeout/malformed-data states, and the
  Phase-0-approved scenario mapping are represented without hidden
  chain-of-thought. G/H/L/N remain proposed coverage IDs until then; Scenario
  L must not bypass a hard HOLD through investigation.

### F5 — Human review and authority

Dependency: backend Phase 4 plus authentication.

- Add review queue/detail, claiming, versioned decisions, role gates,
  authority/oversight explanations, and override outcomes.
- Gate: stale review conflicts and unauthorized actions cannot appear
  successful; scenarios J/K are demonstrable.

### F6 — Monitoring, Plaid, replay, and hardening

Dependency: backend Phases 5–6.

- Connect overview/model-health/drift data and Plaid operational states.
- Add immutable replay comparison without action execution.
- Complete security, observability, performance, browser, accessibility, and
  cross-route visual regression coverage.
- Gate: scenarios A–N and the seven portfolio demo flows are coherent across
  the console.

## First implementation slice

The next safe build should be F1 plus the smallest part of F2:

1. Create the routed `AppShell` from the approved reference.
2. Make Overview, Transactions, Reviews, Rules, Insights, and Settings real
   routes, with unavailable states where APIs do not exist.
3. Move the existing scenario runner into `/transactions/new` or an equivalent
   operator route without changing its backend behavior. This is bounded to the
   pre-existing unauthenticated demo endpoints; it does not authorize target
   API implementation beyond Phase 0.
4. Add typed health/scenario/run services and visible connection/error states.
5. Keep `/rules-performance-reference.html` unchanged for side-by-side review.

This produces a truthful working application immediately while preserving the
backend Phase 0 gate and avoiding speculative data or unsupported workflows.

## Definition of frontend done

- All product routes use the approved shell and shared design contracts.
- All displayed operational data comes from a typed, versioned API contract.
- Roles and mutation outcomes reflect server authorization.
- Recommendation, authority, oversight, review, action, and evidence states are
  visually and semantically distinct.
- Loading, empty, error, conflict, unavailable, and partial-evidence states are
  tested.
- The console exposes no hidden chain-of-thought and does not absorb Arbiris
  governance responsibilities.
- Desktop and mobile visual baselines, keyboard journeys, API contract tests,
  and critical end-to-end scenarios pass.
