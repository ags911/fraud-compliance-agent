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
| Benchmark Insights | `/insights` | Read-only API-backed Sparkov benchmark evidence: checksum-pinned dataset lineage, four deliberately narrow mechanics features, chronological partition counts, Logistic Regression/XGBoost metrics, and explicit non-deployable boundary. It may explore a recorded evaluation operating point, but cannot score a transaction, select a runtime threshold, configure policy, show drift, or make a production claim. |
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

Progress on 2026-09-19: MVP 0 has 9 of 9 items checked locally, MVP 1 has 6 of 6 automated
items checked (manual assistive-technology review remains), MVP 2 has 6 of 6, and MVP 3
has 3 of 12 completed/configuration-reviewed items plus 1 partial configuration item. Several
unchecked items have partial evidence, noted
in their rows.

### MVP 0 — Engineering foundation

| Status | Completion item | Engineering discipline | Verification | Evidence / next action |
| --- | --- | --- | --- | --- |
| ✓ | Root monorepo separates web, API, contracts, notebooks, infrastructure, and shared documentation. | Repository architecture | Manual review | Repository map and project context. |
| ✓ | `make check` and GitHub Actions build the web app, lint Python/notebooks, enforce public-function docstrings, and run API smoke/tests. | CI/CD and quality engineering | Automated gate | `Makefile` and `.github/workflows/verify.yml`. CI now has three jobs: the web job (macOS, matching the screenshot baselines), the API job with the private SDK, and an API job with no SDK and no secrets that mirrors a public clone. Actions are pinned to commit SHAs. Data-path quality gates and the accessibility checks run in the same gate. |
| ✓ | FastAPI exposes current demo health, scenario, model-summary, and streamed-run endpoints. | Backend API and SSE streaming | Automated API tests | `apps/api/server/main.py`. |
| ✓ | The web client contains API/SSE consumers for scenario listing, custom runs, preset runs, and benchmark evidence. | React integration and streaming state | Automated browser tests | `apps/web/src/lib/useAgentRun.ts` and `demo-model-summary.ts`. |
| ✓ | Synthetic-data, Plaid Sandbox, Sparkov, notebook, and model-promotion boundaries are documented. | Responsible AI and data governance | Manual review + policy tests | PRD, data governance, notebook plan, and project context. |
| ✓ | Move the model training and evaluation logic out of Notebook 08 into tested modules (data loading, features, training, evaluation), leaving the notebook as a thin runner. | ML engineering and evaluation | Automated unit/integration tests | Done 2026-09-19. `apps/api/modelling/` owns configuration, paths/revision, dataset loading and validation, partitioning, training, evaluation, Plotly diagnostics, report assembly, and run setup; the notebook is 112 lines of code calling it, with no function definitions, estimator, metric, seed, or digest logic (`tests/test_notebook_08_runner.py`). Seeds, hyperparameters, the threshold grid, and the synthetic fixture's shape moved to `config/fast-path-model-training.v1.json`. The report keeps its git revision, seed, and payload SHA-256 and adds the configuration version; the approved-mode write guard is unchanged and now tested at module level (`tests/test_modelling_report.py`). The API suite grows from 89 to 209 tests: 124 in the new `tests/test_modelling_*.py` and `tests/test_notebook_08_runner.py` files, replacing 7 that read the notebook's source. They cover output shapes, determinism, hand-checked metrics on tiny fixed data, the train-only fit boundary, contract and checksum refusals, figure safety labelling, a full synthetic run, and the rule that `server/` never imports the library. Behaviour is unchanged and was checked both ways: on synthetic data the refactored modules reproduce the previous notebook's evaluation output field for field, and approved mode was then re-run through the refactored notebook against the checksum-verified local Sparkov corpus. `docs/proposals/fast-path-model-release.candidate.json` is the output of that 2026-09-19 run; every metric, both 19-row threshold sweeps, and both 19-row slice tables are bit-for-bit identical to the 2026-09-18 artifact, and only the run timestamp, revision, the new `config_version` field, and the payload digest changed. |
| ✓ | Freeze a versioned showcase API contract for current request, response, error, and SSE-event shapes. | API contracts and schema design | Contract tests + schema validation | Done 2026-09-19. `docs/contracts/demo-api.v1.openapi.json` freezes the five current HTTP routes and is generated from typed FastAPI request, response, validation, and error declarations with `make api-contract`; `docs/contracts/demo-run-events.v1.schema.json` separately freezes the five node payloads, redacted stream errors, SSE framing, and exactly-one-terminal-event rule. `apps/api/tests/test_api_contract.py` rejects implementation drift, checks scope/prohibitions, and exercises representative responses. ADR-012 accepts only this legacy synthetic showcase boundary: it does not approve the future operational API, durable history, model serving, or payment action. Focused verification: 29 contract/endpoint/safeguard tests passed and the SSE artifact validated as Draft 2020-12 JSON Schema. |
| ✓ | Run browser-to-local-API end-to-end checks for scenarios A–F and the LLM outage. | End-to-end testing and agent safety | Opt-in local browser integration test | Completed 2026-09-19. `apps/web/tests/real-preset-matrix.spec.ts` runs the actual local FastAPI API (no request routing) through A–F, the default custom HOLD request, and an explicit click of “Simulate LLM outage” in Chrome. Each reaches terminal UI evidence without a processing error; the outage control visibly produces “Stage 2 unavailable — fail-safe.” An externally available non-outage provider path still needs separate credentials. The custom request now includes a visible synthetic 30-day baseline, stream `processing_failed` is mapped to plain language, and `index.html` links the shipped SVG favicon. |
| ✓ | Verify API error redaction and explicit cross-origin behavior locally. | API security and CORS | Automated API tests | Local tests cover explicit origins only, no wildcard, and a foreign origin receiving no grant (`apps/api/tests/test_demo_endpoints.py`). The stream emits only the stable error categories `processing_timeout` and `processing_failed`. The container image ships an explicit local-development `ALLOWED_ORIGINS` default, so a deployment that forgets to set its own origins fails closed rather than opening up. Public-host CORS smoke testing belongs to MVP 3 deployment verification. |

### MVP 1 — Guided product walkthrough

| Status | Completion item | Engineering discipline | Verification | Evidence / next action |
| --- | --- | --- | --- | --- |
| ✓ | Overview has a first-run zero state, persistent scenario control, a first-visit welcome dialog that offers an opt-in guided tour, and synthetic-data labelling. | Product UX and React state | Automated browser tests | `apps/web/src/Overview.tsx`. |
| ✓ | Benchmark Insights presents mechanics-only evaluation evidence rather than a live-model claim. | ML evaluation and responsible AI | Automated browser/API tests | `ModelBenchmark.tsx` and API model-summary route. |
| ✓ | A branded Not Found recovery state exists. | Frontend routing and resilience UX | Automated browser tests | `ProductApp.tsx`. |
| ✓ | The approved Rules Performance reference remains a visual comparison, not live operational data. | Design systems and scope control | Visual regression tests | Reference route and design-system rules. |
| ✓ | Perform and retain screenshot/accessibility checks for every MVP 1 route at desktop and narrow widths. | Accessibility and visual regression testing | Automated axe + screenshots; manual AT pending | Automated axe WCAG 2 A/AA checks now pass without a colour-contrast exception on Overview, Benchmark insights, Analyse a transaction, a planned page, and Not found at both widths. The Payments muted, warning, destructive, sidebar, disabled-form, and pending-pipeline treatments were corrected at their shared token/component sources. Updated visual baselines cover the benchmark and signed-record panels. Manual keyboard and screen-reader review remains prudent before a public launch. |
| ✓ | A first-visit welcome dialog offers a guided tour or skipping it, the answer is remembered for the browser session, and the tour is available afterwards from "How this demo works". | User onboarding and interaction design | Automated browser tests | Decision 2026-09-19: the on-page "Getting started" checklist was removed because it took dashboard space, so the Overview opens straight into the KPIs. The welcome dialog states that the data is synthetic and that nothing can approve, release, or execute a payment; it is modal, answered by Skip, Take the tour, or Escape, and does not return on reload, navigation, or Reset (it does in a new session). The tour is an opt-in four-step spotlight (driver.js: choose, run, inspect, go deeper) with Next and Back that also follows the user's real actions, leaves the highlighted control and the open scenario menu clickable, and respects reduced motion. Covered by `apps/web/tests/welcome.spec.ts` (10 tests at each width) and `apps/web/tests/tour.spec.ts` (11 at each width). |

### MVP 2 — Live decision demonstration

| Status | Completion item | Engineering discipline | Verification | Evidence / next action |
| --- | --- | --- | --- | --- |
| ✓ | Web code can request current scenarios and consume the API's POST/SSE run flow. | Event-driven frontend engineering | Automated browser tests | `useAgentRun.ts`. |
| ✓ | API exposes preset and custom-run routes, including the simulated LLM-outage path. | Agent orchestration and API design | Automated API tests | `apps/api/server/main.py`. |
| ✓ | Connect the final dashboard scenario control to the API-backed run flow, or document the standalone-workspace boundary. | Application state architecture | Automated browser tests + manual architecture review | Decided and implemented 2026-09-19: the boundary stays, and the surfaces were merged so it is a boundary between *kinds of run*, not between two dashboards. The shadcn dashboard is now the Overview route (`/` and `/overview`); the standalone `dashboard.html` entry is gone. Its scenario control reads and writes the same `DemoSessionProvider` state as the Payments pages, so the header control and the page can no longer disagree, and one provider now serves every route. The synthetic scenario run stays on the Overview; the live API run stays on `/transactions/new`, which the Overview links to from its tabs and quick actions. |
| ✓ | Verify loading, cancellation, connection failure, malformed stream, API error, and outage states in the browser. | Resilience testing and failure handling | Automated browser tests | `live-decision.spec.ts` covers terminal-event enforcement, HTTP failure, cancellation, malformed/incomplete stream handling, and redacted plain-language processing errors. The real local A–F matrix confirms browser/API integration. |
| ✓ | Confirm every visible outcome is labelled simulated and no UI presents ephemeral data as durable history. | Responsible AI UX and safety boundaries | Targeted browser assertions + manual review | Decision workspace boundary and tour copy explicitly describe synthetic, simulated, transient evidence and state that no payment can be approved, released, or executed. |
| ✓ | Add a short guided tour of the decision workspace on `/transactions/new`. | User onboarding and explainability UX | Automated browser tests | Implemented as an opt-in three-step Driver.js tour of scenario controls, streamed decision flow, and signed-record boundary; covered by `decision-workspace-tour.spec.ts`. |

### MVP 3 — Azure public showcase

| Status | Completion item | Engineering discipline | Verification | Evidence / next action |
| --- | --- | --- | --- | --- |
| ✓ | Containerise the API with a reviewed Dockerfile and a `.dockerignore`, and build it in CI. | Containers and software supply chain | Automated container CI | Done 2026-09-19. `apps/api/Dockerfile` is a two-stage build on digest-pinned `python:3.13-slim` and `ghcr.io/astral-sh/uv:0.11.8`, installing from the lockfile with `uv sync --frozen --no-dev` and running as non-root uid 10001 on port 8000. The private SDK is excluded, so the run routes answer 503 and `/health` and `/demo/model-summary` work; the offline `modelling` library is excluded too, because the wheel target now contains `server` only. The root `.dockerignore` is an allowlist, so nothing private can enter the context by being added later. The build context is the repository root so the two sanitised evidence files can be copied in, and the model-summary route reads them through the new `FCA_EVIDENCE_ROOT` setting (without it the packaged API served 503 for its own benchmark evidence). The `container` CI job builds the image, starts it, and checks health, the served benchmark digest against the committed report, the non-root uid, and the absence of private or offline packages. Verified locally on linux/amd64: 302 MB, `/health` and `/demo/model-summary` both 200, digest `38dec6a0…` matching the repository. **Defect found and fixed during this work:** with the uv cache mounted, the project wheel was reused from cache and the image shipped stale application code; the project install step now runs without that cache and forces a reinstall, and the CI digest check would catch a regression. |
| ✓ | Add reviewed Bicep under `infra/azure/` for only Azure Static Web Apps and Azure Container Apps Consumption. | Infrastructure as code and Azure | Configuration review only | `infra/azure/` contains parameterised subscription (resource group and budget) and resource-group (SWA, Container Apps Consumption, scale-to-zero) templates plus non-secret examples. No resource has been provisioned. |
| — | Add GitHub Actions deployment through Azure OIDC. | Cloud IAM and CI/CD | Not started — Azure credentials required | The OIDC and token-handling runbook is prepared in `infra/azure/README.md`; a deploy workflow remains blocked until an Azure subscription, Entra federation, and an approved public runtime for the private SDK exist. Never commit Azure credentials or service-principal secrets. |
| — | Configure Doppler `showcase` values and host-side secret injection. | Secrets management | Not started — deployment credentials required | Verify no provider secret reaches Vite/browser output. |
| ✓ | Define Container Apps scale-to-zero and no-extra-services configuration. | Serverless operations and cost control | Configuration review only | The reviewed Bicep encodes 0–1 replicas, 0.25 vCPU/0.5 GiB, HTTPS ingress, explicit SWA origin, and no logs workspace; it is not yet deployed. |
| ◐ | Prepare a budget-alert configuration. | FinOps and cloud governance | Configuration review only; deployment verification blocked | The subscription Bicep prepares 80% and 100% monthly-email alerts. It records that alerts notify but do not cap Azure consumption; verification awaits a subscription and monitored mailbox. |
| — | Deploy both applications and set explicit API allowed origins. | Cloud deployment | Not started — Azure credentials required | Verify health, cold-start, unavailable, retry, and local-demo fallback. `apps/web/public/staticwebapp.config.json` provides the single-page-app fallback and ships in the build, but it has not been tested on Azure. |
| — | Verify API error redaction and cross-origin configuration against the public-showcase environment. | Application security and CORS | Not started — Azure deployment required | Confirm that only stable redacted errors reach the browser, the deployed Static Web Apps origin is granted, and a foreign origin is rejected. |
| — | Publish Azure architecture, runbook, teardown steps, and a public-demo smoke-test result. | Technical documentation and operations | Partially documented; public smoke test blocked | Link the reviewed infrastructure artifacts and deployed URL. |
| — | Add an API status step to the guided tour for the health and cold-start state. | Reliability UX | Not started | The first request to a scale-to-zero API can be slow, so explain the connection, cold-start, unavailable, and retry states where the UI shows them. It extends the per-page tours, not a new cross-route tour. |
| — | Rebuild the dashboard's trends and time-series chart from approved Plaid-derived fixtures scored by the decision engine. | Data engineering and observability | Not started | The dashboard shows no sparklines or time-series chart until then: there is no recorded run history, and a generated series would misrepresent the demo. Real inputs come from Plaid Sandbox through the approved canonical mapping and sanitised fixtures for S01–S08, and the held, challenged, and passed outcomes come from our own engine, because Plaid supplies no fraud outcomes. Totals, sparklines, and the chart must all come from that one set. Sparkov stays benchmark evidence on Benchmark Insights only, labelled as such. |
| — | Add a read-only "Explain this decision" panel to the decision workspace (a dashboard-level "Explain" preview already exists on the Overview route: fixed and keyword questions answered only from the figures on screen, each citing its source card, labelled Preview with no language model), with fixed questions such as "Why was this held?" and "What would change the outcome?". | Explainability and evidence-grounded UX | Not started | Answers come deterministically from the run's own evidence (reason codes, rule results, model factors, trace, counterfactual), so it cannot invent facts. It is not a free-text chatbot: that would need a PRD showcase-register entry (use case, owner, synthetic-data boundary, removal path), rate limits, and a budget cap, and an LLM could only rephrase evidence, never decide. |

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
