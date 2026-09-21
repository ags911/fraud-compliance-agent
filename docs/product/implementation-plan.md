# Fraud Risk showcase delivery plan

Status: single active candidate delivery plan, reconciled to the
recruiter-showcase boundary and Azure MVP 3 delivery on 2026-09-18. It does
not approve the candidate PRD, a contract, or post-Phase-0 implementation.

This plan consolidates the former console plan, dual-tier build plan, and ML
visualisation notes. Product requirements, decision flow, S01–S08, and I1–I5
scope remain in the PRD; model-specific evidence remains in the fast-path
technical record. This document owns delivery order, UI integration, and the
MVP acceptance and verification matrix without duplicating those sources.

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

## MVP roadmap

This is the canonical user-facing release roadmap. Each MVP defines its purpose,
scope, and release boundary; its completion and verification matrix follows
below. A screen is not considered delivered merely because the sidebar contains
its label: it needs a truthful state, a stated data contract, and recorded
verification.

### Release governance

The roadmap and the acceptance matrix are the two authoritative planning views:
the roadmap defines what may be released, and the matrix records evidence that
it is ready. A checkmark is evidence of a completed item, not a release
authorisation. Before any public release, name a single accountable person for
each role below; until then, the project owner is the decision-maker and no
unassigned role may silently approve its own work.

| Decision area | Accountable role | Required decision record | Release evidence |
| --- | --- | --- | --- |
| Scope, audience, and truthful product claims | Product owner | PRD or accepted plan change | MVP acceptance review against the roadmap |
| Public API shapes and compatibility | API owner | Versioned contract and ADR where cross-cutting | Contract tests and `make api-contract` review |
| Data source, mapping, enrichment, features, and model use | Data/model owner | Data-governance approval and versioned mapping/feature contract | Reproducible fixture and boundary tests |
| Public cloud, identity, secrets, cost, and release | Platform/release owner | Reviewed infrastructure change and deployment runbook | Pre-deploy gate plus deployed public smoke-test record |

No role or approval is invented by this table. Record named owners, the commit
or change request, date, and any accepted exception when the project gains a
team or public deployment surface.

### Acceptance commands and release criteria

Run the listed command from the repository root after a material change. Store
the command, commit SHA, date, environment, result, and any exception with the
release decision; passing automated tests alone never overrides the safety and
scope boundaries in the roadmap.

| Boundary | Reproducible command | Release criteria beyond the command |
| --- | --- | --- |
| MVP 0 — local engineering foundation | `make acceptance-mvp0` | Contracts are current, local error/CORS safeguards pass, and no public-host claim is made. |
| MVP 1 — guided walkthrough | `make acceptance-mvp1` | A human completes keyboard and screen-reader assistive-technology review before public sharing. |
| MVP 2 — live decision demonstration | `make acceptance-mvp2` | The command owns a local FastAPI process and runs A–F, the disclosed custom baseline, and the explicit LLM-outage path in the browser; all outcomes remain visibly simulated. |
| MVP 3 — pre-deploy | `make acceptance-mvp3-predeploy` | Review Bicep parameters, OIDC federation, secret references, budget recipient, approved public-runtime boundary, and exact web origin. |
| MVP 3 — deployed public showcase | `SHOWCASE_WEB_URL=… SHOWCASE_API_URL=… make acceptance-mvp3-public` | Record the public URL, health/cold-start/unavailable/retry journey, explicit CORS grant and foreign-origin rejection, deployment architecture/runbook, budget-alert delivery, and teardown owner. |

The MVP 3 public command deliberately cannot pass until Azure is configured; it
checks public health and CORS only and does not deploy, inject secrets, or
substitute for a manual public-demo journey. This keeps the currently local
showcase local without disguising an unperformed deployment check.

The screen and surface tables in the sections below carry the same `Status`
column as the completion checklists: ✓ means the screen or surface exists in the
repository today, and — means it is planned. A ✓ says the screen is built, not
that every requirement in its row is met; the completion checklist holds the
per-requirement evidence.

### MVP 0 — Local engineering foundation

Goal: keep the current synthetic showcase safe to change and reproducible on a
developer machine. It freezes the Phase 0 contract, local CORS/error boundary,
deterministic benchmark evidence, and the test gate. It does **not** establish a
public runtime, Azure identity, Plaid ingestion, production model serving, or
payment authority.

### MVP 1 — Guided product walkthrough

Goal: let a recruiter, employer, or internal stakeholder understand the fraud
decision product without an account or a completed operational backend.

| Status | Screen | Route | State and data in this MVP | Verification |
| --- | --- | --- | --- | --- |
| ✓ | Overview | `/overview` | Shared app shell, persistent scenario selector, first-run zero state, guided demo, mock outcome mix, KPI strip, operational-health state, quick actions, and recent decisions. Values remain zero until an explicit scenario run. All demo content is labelled as representative data. | `dashboard.spec.ts`, `welcome.spec.ts`, `tour.spec.ts`, axe in `accessibility.spec.ts`, and route and theme-scope checks in `payments-design-system.spec.ts`; `make acceptance-mvp1`. |
| ✓ | Benchmark Insights | `/insights` | Read-only API-backed Sparkov benchmark evidence: checksum-pinned dataset lineage, four deliberately narrow mechanics features, chronological partition counts, Logistic Regression/XGBoost metrics, and explicit non-deployable boundary. It may explore a recorded evaluation operating point, but cannot score a transaction, select a runtime threshold, configure policy, show drift, or make a production claim. | `benchmark-insights.spec.ts` with screenshot baselines, axe in `accessibility.spec.ts`, and `test_demo_model_summary.py`; `make acceptance-mvp1`. |
| ✓ | Not Found | `*` | A branded recovery screen for any unavailable route, with a route back to Overview and no invented data or navigation state. | axe in `accessibility.spec.ts` only; there is no dedicated behaviour test. |
| ✓ | Rules Performance reference | `/rules-performance-reference.html` | Frozen design reference only. It supports visual comparison and is not a product screen or a data source. | Visual baselines and computed-style contracts in `payments-design-system.spec.ts`. |

MVP 1 deliberately does **not** claim a live queue, live model monitoring, or
durable transaction history. Benchmark Insights is evaluation provenance—not
model monitoring—and remains explicitly synthetic/non-deployable. This is the
safe, portfolio-ready walkthrough that exists while the API remains a
single-operator demo.

### MVP 2 — Live decision demonstration

Goal: make the operator's core run observable against the Phase 0 API without
pretending that it is a production transaction store.

| Status | Screen | Route | Required API data and behavior | Verification |
| --- | --- | --- | --- | --- |
| ✓ | New transaction / decision run | `/transactions/new` | `GET /health`, `GET /scenarios`, `POST /run`, and `POST /run/preset/{scenario_id}`. Select or enter a transaction, start a run, stream validated SSE events, support cancellation/error state, and mark every action as simulated. | `live-decision.spec.ts` (mocked stream states), `real-preset-matrix.spec.ts` (real local API; runs under `make acceptance-mvp2`, skipped otherwise), `test_api_contract.py`, and axe in `accessibility.spec.ts`. |
| ✓ | Decision workspace | `/transactions/run/:runId` or an in-place run result | `run_id`, `trace_id`, node status, deterministic results, model/rule outputs exposed by the current stream, counterfactual result, signed-record state, and the outage/fail-safe path. No hidden chain-of-thought. | `live-decision.spec.ts` (signed-record baselines), `decision-workspace-tour.spec.ts`, and `real-preset-matrix.spec.ts`. |
| ✓ | Overview | `/overview` | Continues as the entry point. It may show the current demo scenario/run summary, but must not manufacture aggregate history from a transient run. | `dashboard.spec.ts` and `welcome.spec.ts`; `make acceptance-mvp2`. |

A separate short guided tour for the decision workspace ships with this MVP (one tour per page, not one long tour across routes).

MVP 2 maps to F1–F2. It is successful when scenarios A–F and the LLM outage
can be run end to end with honest connection, loading, empty, and error states.

### MVP 3 — Azure public showcase

Goal: deploy the completed guided walkthrough and live decision demonstration
as one shareable Azure-based portfolio experience, without pretending it has a
durable financial-operation backend.

| Status | Surface | Requirement in this MVP | Verification |
| --- | --- | --- | --- |
| — | Web console | Azure Static Web Apps hosts the synthetic React/Vite console. The API base URL is public configuration, never a secret. | `make acceptance-mvp3-predeploy`, then `make acceptance-mvp3-public` against the deployed URL. |
| — | Demo API | Azure Container Apps Consumption hosts the FastAPI demo with minimum replicas of zero. The UI exposes health, connection, cold-start, unavailable, and retry states. | `make acceptance-mvp3-public`: health, cold start, unavailable, and retry states. |
| ◐ | Public-safe investigation | Replace the public image's unavailable private-SDK run path with a repository-owned, scenario-only, bounded LangGraph investigation or its clearly labelled recorded demonstration playback. S01–S03 visibly emit an investigation-skipped event; S04 uses the accepted payee/device evidence tools; the budget is three total calls and one per tool; S05 injects a no-cost deterministic outage. Every provider/tool/output/timeout/budget failure remains `incomplete`, recommends fail-safe HOLD, leaves authority unevaluated and executes nothing. MVP 3 has no numeric runtime fraud-model score or threshold. | API and local browser consumption are complete under ADR-017. The client validates event shapes, one-run identity, sequence and terminal-result ordering before reporting completion; `run_mvp3_local_acceptance.sh` drives S01–S05 through the real SDK-free FastAPI route. Public deployment and controlled live-provider evaluation remain. |
| ◐ | Delivery | GitHub Actions validates builds/tests, then deploys through Azure OIDC. Bicep and a deployment runbook make the release reproducible. | The guarded, SHA-pinned workflow, pre-deploy gate, GHCR digest publication, runtime SWA token retrieval, and runbook are complete locally. Azure federation and a real deployment remain external checks. |
| ◐ | Cost/safety | Doppler holds server-side secrets; no database, cache, VNet, real payment, or customer/provider data is deployed. Recorded playback is continuously public; anonymous live Groq defaults off. A controlled window permits one concurrent run, two per observed client per 10 minutes, ten per process, 30 minutes maximum and a 45-second overall timeout. A budget alert and free-grant review are documented. | Accepted config, kill switch, socket-peer client key, admission/fallback tests and no-default-model boundary are implemented. Trusted Azure ingress, Doppler injection and budget-alert delivery remain deployment checks. |
| ◐ | Screens | MVP 1–2 screens remain available; the console gains explicit recorded/live labelling and the bounded S04/S05 evidence trace without adding review mutations. Not Found and the frozen reference route remain unchanged. | Built locally at `/transactions/investigation`, a separate surface so the legacy A–F workspace stays until an explicit cutover decision. Browser tests cover evidence/citations, deterministic skips, incomplete fail-safe handling, provider/model labelling, redacted errors, strict event validation, terminal-result enforcement, explanation reset between runs, retry and WCAG A/AA. The opt-in local matrix drives S01–S05 through FastAPI without request interception. Public-URL verification and the manual screen-reader review remain. |

The showcase investigation tour opens on a demo API status step explaining health and
cold start. The sidebar status is a real liveness probe: it reports checking, waking,
ready or unavailable, and no longer asserts a hard-coded "All systems operational".

MVP 3 is complete when a recruiter can follow the guided journey from a public
URL, inspect deployment/architecture documentation, and see the declared demo
limitations. It is not a production-readiness milestone.

### Deferred extension 1 — Core transaction operations

Goal: support real, durable operator work once the Phase 2 scoring and
transaction contracts are available.

| Status | Screen | Route | Required API data and behavior | Verification |
| --- | --- | --- | --- | --- |
| — | Overview | `/overview` | Server-backed processed/held/challenged volume, review pressure, recent decisions, model version, drift state, and p95 latency. False-positive rate stays `Unavailable` until labelled outcomes exist. | Planned: API contract tests for the durable transaction model, and browser tests once the Phase 2 contract exists. |
| — | Transactions | `/transactions` | Durable transaction list with server search, filters, sorting, pagination, route/action distinction, evidence state, and links to detail. | Planned: API contract tests for the durable transaction model, and browser tests once the Phase 2 contract exists. |
| — | Transaction detail | `/transactions/:id` | Point-in-time source facts, feature snapshot, deterministic controls, model score/version, reason codes, authority, action outcome, evidence links, and lifecycle timeline. | Planned: API contract tests for the durable transaction model, and browser tests once the Phase 2 contract exists. |
| — | Rules performance | `/rules/performance` | Versioned rules, enabled state, match/outcome counts, and time series from the API. Preserve the approved visual contract and shared range state. | Planned: API contract tests for the durable transaction model, and browser tests once the Phase 2 contract exists. |

This deferred extension maps primarily to F3 and F3a. It requires durable data:
a retry must never read as a duplicate action, and `PASS` (recommendation) must
remain distinct from `RELEASE` (executed action).

### Deferred extension 2 — Investigation and human review

Goal: let fraud teams investigate ambiguous decisions and make accountable
human-review decisions.

| Status | Screen | Route | Required API data and behavior | Verification |
| --- | --- | --- | --- | --- |
| — | Investigation view | `/transactions/:id/investigation` or a transaction-detail tab | Typed investigation status, tool calls/results, evidence factors, timeout/malformed-data states, counterfactual context, and fail-safe result. | Planned: authenticated API and browser tests for conflict, expiry, and forbidden-action states. |
| — | Reviews queue | `/reviews` | Server-filtered queue with `OPEN`, `CLAIMED`, `REQUESTED_INFO`, `DECIDED`, and `EXPIRED` states when the contract confirms them. | Planned: authenticated API and browser tests for conflict, expiry, and forbidden-action states. |
| — | Review detail | `/reviews/:id` | Claim state, server-derived reviewer identity, decision form, authority/oversight explanation, evidence, and versioned mutation outcome. | Planned: authenticated API and browser tests for conflict, expiry, and forbidden-action states. |
| — | Decision audit trail | `/transactions/:id` | Review decisions and override outcomes surfaced in the existing lifecycle view, with links back to the review record. | Planned: authenticated API and browser tests for conflict, expiry, and forbidden-action states. |

This deferred extension maps to F4–F5 and requires authentication. It is complete only when
optimistic-concurrency conflicts, forbidden actions, expiry, and evidence
pending states are visible and cannot be mistaken for success.

### Deferred extension 3 — Governance, intelligence, and operational hardening

Goal: give privileged users controlled configuration and give operators a
truthful view of model health, drift, integrations, and replay.

| Status | Screen | Route | Required API data and behavior | Verification |
| --- | --- | --- | --- | --- |
| — | Models | `/insights/models`, `/insights/models/:id` | Production model/version, artifact lineage, calibration/recall/PR-AUC, threshold meanings, latency, and measurement context. | Planned: contract tests once the model, drift, and replay contracts exist. |
| — | Drift | `/insights/drift` | Prediction and feature drift, configured warning/critical thresholds, time windows, and missing-data state. | Planned: contract tests once the model, drift, and replay contracts exist. |
| — | Policy and rule settings | `/settings/policies`, `/settings/rules` | Versioned configuration, role-aware edit access, confirmation, audit result, and unavailable state until the API supports mutation. | Planned: contract tests once the model, drift, and replay contracts exist. |
| — | Model release status | `/settings/models/:id` | Read-only promoted-model and release provenance by default. A promotion mutation is out of scope unless the API's approved release-process contract expressly delegates it to this console. | Planned: contract tests once the model, drift, and replay contracts exist. |
| — | Integrations and environment | `/settings/integrations`, `/settings/environment` | Plaid/integration health, environment, action limits, connection state, and recovery guidance. | Planned: contract tests once the model, drift, and replay contracts exist. |
| — | Replay comparison | `/transactions/:id/replay` | Immutable comparison of an historical decision against a selected policy/model context; replay never executes a payment action. | Planned: contract tests once the model, drift, and replay contracts exist. |

This deferred extension maps to F6. It is a production-shaped research milestone, not an excuse to
move governance into the operator dashboard or display unverifiable metrics.

### Dependencies, risks, and release blockers

This register records material dependencies that repository tests cannot close.
Review it at each release decision; an unresolved blocker prevents the affected
scope from being called complete, rather than being converted into an optimistic
checkmark.

| Dependency or risk | Affected boundary | Owner to name | Required resolution or evidence |
| --- | --- | --- | --- |
| Azure subscription, Entra OIDC federation, and a monitored budget-alert recipient are absent. | MVP 3 public release | Platform/release owner | Provision through the reviewed runbook; run and record the public acceptance command. |
| The private Arbiris SDK cannot be placed in the public container image; its SDK-free API replacement and browser integration are complete locally but unverified on Azure. | MVP 3 live-run surface | API and product owners | Complete public-container execution and the explicit legacy cutover gate in `docs/proposals/public-showcase-investigation.proposed.md`. |
| The current contract is an accepted legacy synthetic Phase 0 boundary only. | Any Phase 2+ operational work | API owner | Publish a new accepted operational contract; do not extend the demo contract by implication. |
| Plaid supplies source facts, not fraud labels or final outcomes. | F3a and later trends | Data/model owner | Approve canonical mapping, sanitisation, fixture provenance, feature snapshot, score/route semantics, and source-to-score tests. |
| Sparkov is mechanics-only evaluation evidence, not a runtime scoring source. | Benchmark and model claims | Data/model owner | Preserve its non-deployable label and use an approved served-model decision before runtime scoring. |
| Automated accessibility passes do not replace assistive-technology review. | MVP 1 and MVP 3 | Product owner | Retain keyboard and screen-reader findings, fixes, and accepted residual issues. |

## MVP acceptance and verification matrix

This is the operational companion to the roadmap above, not a second release
plan. It records the acceptance criteria, engineering discipline, verification
type, and evidence for every MVP completion claim. A checked item has repository
evidence as of 2026-09-20; an unchecked item is planned, needs fresh
verification, or requires an external decision. Re-run the relevant check after
a material change rather than relying on a historical tick.

Progress on 2026-09-21: MVP 0 has 9 of 9 items checked locally, MVP 1 has 6 of 6 automated
items checked (manual assistive-technology review remains), MVP 2 has 6 of 6, and MVP 3
has 5 of 12 completed/configuration-reviewed items plus 5 partial items. Several
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
| ✓ | Perform and retain screenshot/accessibility checks for every MVP 1 route at desktop and narrow widths. | Accessibility and visual regression testing | Automated axe + screenshots; manual AT pending | Automated axe WCAG 2 A/AA checks now pass without a colour-contrast exception on Overview, Benchmark insights, Analyse a transaction, Showcase investigation, a planned page, and Not found at both widths. The Payments muted, warning, destructive, sidebar, disabled-form, and pending-pipeline treatments were corrected at their shared token/component sources. The shell now exposes one `main` landmark plus a labelled primary-navigation landmark, with targeted `landmark-no-duplicate-main` and `region` checks at both widths. Updated visual baselines cover the benchmark and signed-record panels. Manual keyboard and screen-reader review remains prudent before a public launch. |
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
| ✓ | Build the public-safe investigation runtime. | Agent orchestration and safety engineering | Automated API, contract, graph, provider-boundary, admission and container tests | Done 2026-09-20 under ADR-017. `server/showcase_investigation/` validates accepted fixtures/config, serves deterministic S01–S03, recorded/live S04 and deterministic S05, and refuses deferred S06–S08 with the stable 503. Live defaults off and requires a secret plus an operator model present in a server-side allowlist. `test_showcase_investigation_runtime.py` covers routing, schema, evidence, citations, failures and admission, and `test_public_showcase_api_contract.py` now drives the served route so the accepted HTTP contract's request values and redacted 422/503 envelopes cannot drift from the implementation; container CI exercises recorded S04 and proves the first-party package ships without the private SDK. Browser consumption is built on its own route and tracked by the Screens row. |
| ◐ | Add GitHub Actions deployment through Azure OIDC. | Cloud IAM and CI/CD | Automated local/static gate plus Bicep compilation in CI; cloud execution blocked | `.github/workflows/deploy-showcase.yml` is manual, environment-protected, restricted to `main`, SHA-pins every action, publishes an SDK-free GHCR image by immutable digest, uses OIDC with no Azure client secret, runs `what-if`, retrieves the SWA token only at runtime, and executes public acceptance. Azure subscription, Entra federation, protected environment configuration, and the first run remain. |
| ◐ | Configure Doppler `showcase` values and host-side secret injection. | Secrets management | Configuration complete; credentials and runtime verification blocked | The official pinned fetch action accepts an optional read-only `DOPPLER_TOKEN`; Bicep exposes the Groq key only as a Container Apps secret reference and never to Vite. Recorded-only deployment works without Doppler. No model identifier has been approved, no value has been invented, and `SHOWCASE_LIVE_ENABLED` remains hard-coded false. |
| ✓ | Define Container Apps scale-to-zero and no-extra-services configuration. | Serverless operations and cost control | Configuration review only | The reviewed Bicep encodes 0–1 replicas, 0.25 vCPU/0.5 GiB, HTTPS ingress, explicit SWA origin, and no logs workspace; it is not yet deployed. |
| ◐ | Prepare a budget-alert configuration. | FinOps and cloud governance | Configuration review only; deployment verification blocked | The subscription Bicep prepares 80% and 100% monthly-email alerts. It records that alerts notify but do not cap Azure consumption; verification awaits a subscription and monitored mailbox. |
| — | Deploy both applications and set explicit API allowed origins. | Cloud deployment | Not started — Azure credentials required | Verify health, cold-start, unavailable, retry, and local-demo fallback. `apps/web/public/staticwebapp.config.json` provides the single-page-app fallback and ships in the build, but it has not been tested on Azure. |
| — | Verify API error redaction and cross-origin configuration against the public-showcase environment. | Application security and CORS | Not started — Azure deployment required | Confirm that only stable redacted errors reach the browser, the deployed Static Web Apps origin is granted, and a foreign origin is rejected. |
| ◐ | Publish Azure architecture, runbook, teardown steps, and a public-demo smoke-test result. | Technical documentation and operations | Runbook complete; public smoke test blocked | `infra/azure/README.md` records one-time least-privilege bootstrap, protected variables, GHCR visibility, Doppler keys, deploy verification, rollback, and teardown. Add the workflow run, immutable image digest, deployed URLs, alert-delivery evidence, and teardown owner after Azure exists. |
| ◐ | Add an API status step to the guided tour for the health and cold-start state. | Reliability UX | Automated browser tests | Built 2026-09-21. `useApiHealth` probes `/health`; the sidebar reports checking, waking, ready or unavailable and exposes Retry after an unavailable result. The showcase investigation tour opens on that status and explains cold start; `showcase-explain.spec.ts` covers ready, unavailable, slow wake-up and unavailable-to-ready retry. **Remaining gap:** this is a new per-page tour on the showcase route rather than an extension of the existing tours, which still have no status step. |
| ✓ | Add a read-only "Explain this decision" panel to the decision workspace (a dashboard-level "Explain" preview already exists on the Overview route: fixed and keyword questions answered only from the figures on screen, each citing its source card, labelled Preview with no language model), with fixed questions such as "Why was this held?" and "What would change the outcome?". | Explainability and evidence-grounded UX | Automated browser tests | Built 2026-09-21 on the showcase investigation route, not the legacy workspace, because that is where evidence-grounded runs live. Answers come deterministically from the run's own events (execution mode, tool evidence, claims and their citations, authority and simulated action), so it cannot invent facts. `showcase-explain.spec.ts` covers each answer, its cited source, the refusal of anything outside the run, the disabled state before a run completes, and WCAG A/AA after answering. A counterfactual "what would change the outcome" answer is deliberately absent: MVP 3 has no runtime score or threshold to derive one from. It is not a free-text chatbot: that would need a PRD showcase-register entry (use case, owner, synthetic-data boundary, removal path), rate limits, and a budget cap, and an LLM could only rephrase evidence, never decide. |

The following omissions are deliberate scope decisions, not incomplete MVP 3
implementation:

- Dashboard trends, sparklines, and Plaid-scored history are deferred to F3a/F6.
  They require an approved served model and durable, provenance-bearing run
  history; manufacturing a time series from ephemeral showcase runs would be
  misleading.
- A “what would change the outcome?” counterfactual is deferred to F3a. MVP 3
  has no approved runtime score, calibration, or threshold from which to derive
  one, so the deterministic Explain panel does not invent an answer.
- S06–S08 stateful behavior remains deferred to F3–F6. Until the operational
  transaction, review, idempotency, and replay contracts are accepted, the
  public API's stable redacted `503` is the expected result.
- Real Groq execution is optional and remains unclaimed until an operator has
  supplied an approved allowlisted model and run the controlled-window
  evaluation. Recorded playback is the continuously available MVP 3 default.

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

## Technical delivery sequence

“F” means **Foundation stage**: an internal technical capability stage, not a
user-facing MVP or release. F3a is an explicit substage between F3 and F4,
added so the source-to-score chain cannot be hidden inside Plaid integration or
dashboard work. Together these stages explain what must be available before a
later roadmap release can truthfully ship.

Status uses the same evidence rule as the MVP matrix: ✓ is complete, ◐ has
repository-backed preparation but has not passed its gate, and — is not
started. A proposal alone can justify ◐ only when its boundary and next gate are
explicit; it can never justify ✓.

| Status | Foundation stage | Capability and deliverable | Inputs / dependencies | Verification gate | Maps to release |
| --- | --- | --- | --- | --- | --- |
| ✓ | F0 — Design and contract foundation | Preserve the immutable reference route; maintain the Phase 0 capability map and accepted contract artifacts. | Existing reference and accepted Phase 0 API contract. | Reference and Rules Performance routes match at desktop and mobile; contract tests pass. | MVP 0 |
| ✓ | F1 — Application-shell foundation | Product router, `AppShell`, route-derived navigation, global loading/error/connection states, and URL search/filter conventions. | F0 design and contract boundary. | Keyboard, responsive/mobile-sheet, accessibility, and visual shell tests pass. | MVP 1 |
| ✓ | F2 — Current API integration foundation | Scenario/custom-run submission and streamed decision workspace in the approved shell; Sim A/B, counterfactual, signed record, outage, and evidence path remain visibly simulated. | Current Phase 0 API only. No aggregate history is manufactured from a transient run. | A–F and the LLM outage complete end to end with truthful loading, error, and terminal states. | MVP 2 |
| ◐ | F3 — Fast-path operations foundation | Durable score/process workflows, transaction list/detail, recent decisions, overview metrics, and model/policy/feature/run/evidence lineage. Preparation started under ADR-013: operational API, PostgreSQL and provider-neutral identity outlines are reviewable. ADR-016 accepts S01–S08 synthetic facts for MVP 3 only; it does not implement or approve F3 stateful behavior. | Accepted Phase 2 operational contract, PostgreSQL state, and authentication before any exposed mutation. These remain unresolved dependencies. | Retries cannot look like duplicate actions; `PASS` (recommendation) remains distinct from `RELEASE` (executed action); no LLM dependency. | Deferred extension 1 |
| ◐ | F3a — Approved source-to-score foundation | Plaid Sandbox source facts flow through canonical mapping, sanitised reproducible fixtures, approved enrichment, immutable feature snapshots, an approved served model, then deterministic routing. That approved path produces provenance-bearing scored run history for later dashboard totals and time series; MVP 3 does not manufacture it. Preparation includes proposed ADR-003–005, six draft domain schemas, valid/invalid contract fixtures, the separately accepted synthetic showcase packet and a proposed acceptance matrix; no runtime connector, feature pipeline or model service exists. Sparkov remains mechanics-only evaluation evidence. | F3 operational transaction contract plus explicit data-governance and model approvals. Raw provider/customer data never enters public assets, test snapshots, or the browser bundle. These dependencies remain unresolved. | Fixture-to-route tests prove mapping validation, sanitisation, lineage/version capture, idempotency, recommendation/action separation, and fail-safe handling for unavailable enrichment or model service. | Deferred extension 1 |
| — | F4 — Investigation foundation | Typed investigation status, tool-call/result evidence, factors, and fail-safe outcomes in transaction detail. The bounded SDK-free MVP 3 investigation may provide reusable interfaces, but does not by itself complete F4. | Backend Phase 3. | The slow path is ambiguous-only; timeout/malformed-data states and approved scenario mapping are visible without chain-of-thought. Proposed G/H/L/N remain unclaimed; L cannot bypass a hard HOLD. | Deferred extension 2 |
| — | F5 — Human-review foundation | Review queue/detail, claiming, versioned decisions, role gates, authority/oversight explanation, and override outcomes. | Backend Phase 4 and authentication. | Stale conflicts and unauthorised actions never appear successful; scenarios J/K are demonstrable. | Deferred extension 2 |
| — | F6 — Monitoring, integration-health, replay, and hardening foundation | Model health/drift, operational state for the F3a source integration, immutable replay, provenance-backed dashboard trends, and security/observability/performance/browser/accessibility/visual hardening. | Backend Phases 5–6, durable run history, and the approved F3a source-to-score path. It does not create a second Plaid ingestion or scoring path. | A–N and the seven portfolio demo flows are coherent across the console; replay never executes a payment action; every displayed time series reconciles to the same durable source records. | Deferred extension 3 |

## Next safe F3 preparation slice

ADR-013 records the product owner's local-first boundary. The next work remains
contract preparation—not operational endpoint implementation:

1. Review the proposed operational API, PostgreSQL and identity outlines and
   resolve their open questions through the reserved ADR-002/009/010 path.
2. Reconcile the accepted showcase-only S01–S08 facts with the future canonical
   transaction and operational contracts without silently promoting them to
   provider, model or stateful-operation truth; do not map A–F by similarity.
3. Specify valid/invalid schemas, idempotency and concurrency transitions,
   protected operations and stable error/event categories.
4. Freeze accepted artifacts only through P0-09 with contract tests and a web
   consumer check.
5. Keep the accepted legacy demo contract unchanged. Implement the separately
   accepted public-showcase contracts and fixtures behind their own route and
   tests before changing the public image or MVP 3 user path.

F3 remains ◐ until its operational contract, persistence and identity decisions
are accepted and its runtime verification gate passes. F3a is also ◐ because
its decision/schema/fixture packet now exists, but no Plaid runtime connector,
eligible feature pipeline, approved corpus/model or fraud-model service has been
approved.

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
