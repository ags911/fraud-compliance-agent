# Payment risk engine — candidate consolidated PRD

Status: **Candidate for approval — v0.3 review packet prepared**
Version: 0.3
Owner: Product owner: Darren Gidado (confirmation and approval pending)
Last reconciled: 2026-09-18

This document is the proposed single product reference for the payment-risk
engine and its operator console. It becomes the ground-truth PRD only after
the approval record below is completed. Until then, the API repository's
accepted Phase 0 artifacts remain authoritative for backend contracts.

### v0.3 reconciliation record

This revision incorporates the current project-wide data and model boundaries:

- Plaid Sandbox is limited to local, zero-retention schema and aggregate
  data-quality analysis. It does not approve a runtime connector, canonical
  transformation, feature set, training dataset, or payment action.
- Sparkov is accepted only as a checksum-verified mechanics benchmark. Its
  simulated labels and results cannot substantiate production performance,
  threshold, model-serving, or payment-action claims.
- Notebook 08's Logistic Regression and XGBoost harness is evaluation evidence
  only. It does not select a model, calibration method, operating threshold, or
  runtime release.
- Stripe/Radar is not a selected provider integration. Its score, risk level,
  or payment outcome is not independent fraud ground truth or a training label.
- The public recruiter showcase is limited to MVP 1–3: guided walkthrough,
  live synthetic decision demonstration, and Azure deployment. Durable
  operations, databases, production authentication, real provider data, and
  model release are deferred rather than implied by the showcase.

The v0.3 review checklist and sign-off record are maintained in
[Section 12.1](#121-review-checklist-and-approval-procedure) below so PRD
scope and its approval state cannot drift apart.

## 1. Authority and document hierarchy

| Rank | Artifact | Authority |
| --- | --- | --- |
| 1 | This PRD, once approved | Product scope, requirements, non-goals, release acceptance. |
| 2 | Accepted API ADRs and contracts | Canonical data, model target, routing, authority, oversight, evidence, security, and persistence semantics. |
| 3 | API Phase 0 backlog and PRD review | Required decision work and blockers until ADRs/contracts are accepted. |
| 4 | Dual-tier build plan | Proposed technical delivery shape derived from this PRD. |
| 5 | Fraud Risk Console implementation plan | Frontend routes, UI states, and presentation sequence. |

An implementation plan may not silently override an accepted contract. Any
change to a requirement, scenario, policy boundary, or data source must carry a
PRD/ADR version and a migration or compatibility decision.

## 2. Product statement

Provide an auditable payment-risk orchestration service that recommends safe
payment routes, investigates only eligible contextual cases, and makes any
simulated action subject to independent authority, oversight, and human-review
controls.

The product is not positioned as a replacement for a payment service
provider's fraud network. Its first release proves a transparent, controlled
operating model for one provider-shaped payment flow.

### Showcase positioning

This is a public recruiter/employer showcase, not a production financial
service. It should feel production-shaped through clear architecture,
contract-first interfaces, typed state, testing, data boundaries, operational
states, and deployment documentation—but it deliberately uses synthetic
scenarios and simulated actions. It must not collect real customer data,
execute a payment, make a compliance claim, or imply a live fraud-performance
result.

The showcase succeeds when a reviewer can select a scenario, understand its
origin and limitations, follow a transparent decision/review journey, inspect
the engineering evidence, and run the project locally without private data.
The selected technologies, hosted services, and external APIs are recorded in
the [showcase technology and service register](#14-showcase-technology-and-service-register).

## 3. Users and jobs

| User | Job |
| --- | --- |
| Fraud operator | Submit/select a payment, understand its facts, route, reasons, and current operational status. |
| Fraud reviewer | Safely claim and decide eligible cases, with conflict protection and an immutable record. |
| Administrator | View controlled configuration, integration health, access, and release provenance within server-enforced permissions. |
| Demonstrator | Run repeatable, truthfully labelled scenarios without implying live operational history. |

## 4. Scope

### In scope

- One provider adapter and canonical payment-event schema.
- Point-in-time feature derivation and deterministic fraud/APP controls.
- A candidate calibrated tabular-model interface. The proposed evaluation starts
  with Logistic Regression as a benchmark and XGBoost as the primary tabular
  candidate; final selection follows the approved dataset/model decision and
  frozen evaluation protocol.
- Typed `PASS`, `CHALLENGE`, and `HOLD` recommendations.
- Bounded contextual investigation only for permitted ambiguous or APP-risk
  cases.
- Simulated actions, authority/oversight controls, durable history, and review.
- Versioned synthetic fixtures and later provider/Plaid integration testing.
- A React operator console using the approved design system.

### Non-goals for v1

- Real payment execution, real account blocking, or automated chargeback filing.
- Multi-PSP orchestration, Web3 rails, breach-intelligence collection, or a
  universal agentic-commerce identity signal.
- Claims of production fraud detection performance from synthetic data.
- Arbiris governance-record exploration or evidence-pack assembly in this app.

## 5. Required decision flow

```text
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

`PASS` is never synonymous with `RELEASE`. A low model score or investigator
recommendation cannot bypass a hard control or missing critical evidence.

## 6. Functional requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| FR-01 | Validate provider facts into a versioned canonical transaction with source, event, availability, and ingestion times. | Valid/invalid contract fixtures and API tests. |
| FR-02 | Derive only eligible point-in-time features, preserving unavailable/unknown separately from zero or false. | Feature-availability matrix and snapshot-hash tests. |
| FR-03 | Evaluate applicable deterministic fraud and APP controls before fast release. | Route truth-table tests, including low-model/high-APP cases. |
| FR-04 | Return a typed recommendation with model/policy/rule versions and explainable factors. | `POST /risk/score` contract and decision-workspace test. |
| FR-05 | Allow contextual investigation only for an approved eligible route; use typed, allowlisted, time-bounded tools. | Tool-contract, timeout, redaction, and failure tests. |
| FR-06 | Require independent authority and oversight evaluation before a simulated action. | Authority/oversight matrix tests; recommendation/action distinction in UI. |
| FR-07 | Create durable, idempotent processing records; duplicate processing never creates a second action. | PostgreSQL integration and failure-injection tests. |
| FR-08 | Support authenticated, versioned human review with claim ownership, expiry, conflict handling, and revalidation. | Role and stale-review concurrency tests. |
| FR-09 | Emit and retain permitted linked evidence/delivery state without claiming completed review or exposing Arbiris-only capabilities. | Evidence mapping, signature verification, and pending-review fixtures. |
| FR-10 | Show operators truthful loading, unavailable, error, pending, conflict, and completed states. | Browser and API-contract tests for each state. |
| FR-11 | Support read-only historical replay with original lineage and no repeated action. | Replay and source-correction tests. |

## 7. Data, model, and tool requirements

### 7.1 Data classes

Every field used by the product is classified per source as `observed`,
`derived`, `unavailable`, or `simulated`. The product must preserve source
revision, timestamp precision, provenance, freshness, and known-at-scoring
state.

| Source or capability | Initial role | Constraint |
| --- | --- | --- |
| Provider payment event | Primary v1 decision input | Choose one adapter and map its revisions before building controls. |
| Plaid | Account/transaction enrichment and integration testing | Not an authority for a pre-action route; full sync follows the approved later scope. |
| Device/session telemetry | Optional future input | Requires an approved collector, consent, retention, quality, and feature contract. |
| IP/domain intelligence | Optional future tool | Requires licensed source, freshness, privacy, outage and redaction contract. |
| Internal baseline retrieval | Bounded contextual tool | Requires allowlisted corpus, access control, citations/evidence factors, and tool budgets. |
| Agent credential | Simulated until a trusted issuer is integrated | Requires verification, issuer trust, expiry, and replay controls. |

### 7.2 Model and evaluation policy

- The training target—unauthorised fraud, APP scam, or another approved target—
  is selected before training. An APP control remains independent when the model
  does not predict APP risk.
- The tabular model algorithm, features, calibration method, thresholds, and
  promotion criteria are decisions, not assumptions. XGBoost is a candidate.
- Performance reports declare the data source, label maturity, chronological
  splits, calibration set, untouched test set, prevalence, and measurement
  boundary.
- Synthetic Faker/numpy data is valid for fixture generation, engineering, and
  pipeline exercises. Rule-generated labels cannot substantiate independent
  fraud-model performance claims.

### 7.3 Plaid notebook deliverable

Use the ordered, **sanitised, reproducible Jupyter notebook** workstream in the
monorepo as Phase 0 discovery evidence, not as production ingestion service or
model-training evidence. The complete scope, gates, and structures are in the
[notebook plan](../../notebooks/notebook-plan.md).

The notebook must:

1. Use Sandbox/custom-user or redacted fixture data only; never commit secrets,
   access tokens, PII, or live account exports.
2. Demonstrate `/transactions/sync` pagination, cursor persistence model,
   added/modified/removed records, pending-to-posted linkage, corrections,
   account scope, amount direction, currency, and date precision.
3. Produce a checked-in field-mapping and feature-availability table for
   provider, Plaid, scenarios, replay, and candidate training data.
4. Save only sanitised deterministic fixtures and assertions to the repository.
5. Prove that missing device/payee/session facts are missing—not silently
   manufactured from Plaid data.

Notebook outputs become input to the Plaid ADR and contract tests. Production
sync/retry/reconciliation moves into tested FastAPI services, not notebook cells.

### 7.4 Current data and model evidence boundary

The Plaid mapping artifact is accepted only for the narrow Sandbox analysis
boundary described above. It does not establish canonical money, direction,
event-time, account, category, payee, or source-revision semantics. Those
require accepted contracts before implementation.

Sparkov supports a reproducible mechanics benchmark only. The current Notebook
08 experiment records a candidate evaluation with Logistic Regression and
XGBoost under a checksum-verified local dataset contract; it does not approve
a target, corpus, features, calibration, threshold, model artifact, or runtime
integration. Future model work remains gated by the corpus/label, feature,
leakage, evaluation, and release decisions in the notebook plan and fast-path
technical specification.

## 8. Scenario and acceptance catalogue

| ID | Required coverage | Acceptance condition |
| --- | --- | --- |
| S01 | Trusted recurring payment | PASS recommendation with no invented action. |
| S02 | High-value / high-velocity risk | HOLD cannot be bypassed. |
| S03 | Account drain/new payee | APP hard control runs before fast release. |
| S04 | Ambiguous contextual case | Investigation is bounded and results in typed evidence and route. |
| S05 | Model/investigation outage | Truthful fail-safe HOLD and visible operational error state. |
| S06 | Reviewer conflict | Stale review version fails without overwriting a decision. |
| S07 | Duplicate process request | Same/resumed run; no second simulated action. |
| S08 | Provider correction | New source revision and read-only replay; no repeat action. |

Legacy API scenarios A–F are characterised separately and mapped to this
catalogue only through an approved routing/scenario decision.

## 9. Showcase MVP stages and deferred engineering increments

The recruiter showcase is deliberately completed in three MVP stages. Each is
useful and demonstrable on its own. The later engineering increments remain
valuable architecture evidence, but are not required for the public showcase.

| Showcase MVP | Goal | Included capability | Explicit exclusion |
| --- | --- | --- | --- |
| MVP 1 — Guided walkthrough | Explain the product with no setup or account | Overview zero state, guided onboarding, deterministic scenario selection, benchmark provenance, Rules Performance reference, and Not Found | Live transaction history, persistent queues, real model claims, or provider data |
| MVP 2 — Live decision demonstration | Show one transparent simulated decision end-to-end | FastAPI scenario run, SSE trace, loading/error/outage state, typed factors, simulated outcome, and no hidden reasoning | Durable run history, review mutations, real payment execution, or model serving |
| MVP 3 — Azure public showcase | Give recruiters a shareable cloud deployment and inspectable engineering story | Azure Static Web Apps console, Azure Container Apps scale-to-zero API, GitHub Actions/OIDC deployment, Doppler secrets, health/cold-start state, architecture/runbook | Database, queue/cache, production auth, VNet, real customer/provider data, or production SLA |

MVP 3 is complete when the public synthetic demo can be run reliably enough for
a portfolio review, costs are guarded, deployment limitations are visible, and
the project can be reproduced locally. It is not a production-readiness claim.
The current checked/unchecked implementation evidence is maintained in the
[showcase MVP completion checklist](implementation-plan.md#showcase-mvp-completion-checklist).

### 9.1 Deferred engineering increments

| Increment | Backend capability | Console surface |
| --- | --- | --- |
| API Phase 0 | Contracts, ADRs, characterisation, fixtures, tests, gate packet | Existing demo clearly labelled; shell and unavailable states only. |
| Proposed I1 | Stateless scoring | New transaction and decision workspace. |
| Proposed I2 | Durable processing and simulated actions | Overview, transactions list, transaction detail. |
| Proposed I3 | Typed investigation | Investigation timeline in transaction detail. |
| Proposed I4 | Authenticated human review | Reviews queue/detail and conflict UI. |
| Proposed I5 | Provider/Plaid sync, monitoring, replay | Integrations, model/drift only where data exists, replay comparison. |

Each deferred increment requires explicit scope approval after the Phase 0
gate. I1–I5 are not recruiter-showcase MVP stages and do not imply an approved
API delivery phase.

### 9.2 Fast-path model technical record

The proposed model strategy, current harness status, real-data requirements,
evaluation evidence, and deferred monitoring plan are maintained in
[the fast-path model technical specification](../proposals/fast-path-fraud-model-technical-spec.md).
It is a proposal, not a release or model-selection approval.

## 10. Non-functional and safety requirements

- Authentication precedes every exposed mutable operational endpoint.
- Server-derived actor, tenant, permission, and ownership are authoritative.
- SSE is a display transport; durable processing survives browser disconnects.
- Mutations specify authorization, idempotency/concurrency behavior, safe error
  categories, and pending/committed/evidence-pending states.
- Latency targets state their boundary: inference-only versus complete request;
  hardware, warmup, concurrency, sample size, and percentiles are recorded.
- The UI never displays hidden chain-of-thought, raw provider exceptions, fake
  model metrics, fake queue counts, or completed oversight that has not occurred.

## 11. Traceability

| Requirement group | API Phase 0 artifact | Backend test | Frontend evidence |
| --- | --- | --- | --- |
| FR-01–02 | ADR-002, ADR-003 | Schema/mapping fixtures | Transaction facts and feature snapshot states. |
| FR-03–06 | ADR-006 | Route, authority, oversight tests | Recommendation, action, investigation, and review-state rendering. |
| FR-07–08 | ADR-009, ADR-010 | PostgreSQL/idempotency/concurrency tests | Lifecycle, retry, conflict, forbidden, and expiry states. |
| FR-09 | ADR-007, ADR-008 | Evidence/signature/manifest tests | Linked-record/delivery state only. |
| FR-10–11 | ADR-011 | Contract, replay, and error tests | Loading, unavailable, error, replay, and accessibility tests. |

## 12. Approval record

| Approval | Person | Date | Revision | Status |
| --- | --- | --- | --- | --- |
| Product owner | Darren Gidado (confirmation pending) | — | 0.3 | Pending product-scope review |
| API/architecture reviewer | Unassigned | — | 0.3 | Pending contract and architecture review |
| Data/ML reviewer | Unassigned | — | 0.3 | Pending data/model-gate review |
| Security/governance reviewer | Unassigned | — | 0.3 | Pending security and governance review |

Approval requires completion of the v0.3 checklist below, named reviewers,
and a committed revision SHA. Each reviewer may approve their stated scope,
approve with recorded conditions, or reject it with required changes. A pending
table, a proposed artifact, or a mechanics benchmark is not approval to
implement post-Phase-0 services.

### 12.1 Review checklist and approval procedure

This review checklist makes PRD approval concrete. It records what each named
reviewer must decide, the evidence they must inspect, and the boundaries that
remain unapproved. It is not a substitute for an accepted API contract, ADR,
model release, or production authorisation.

| Reviewer | Must approve or reject | Evidence to inspect | Approval does **not** authorise |
| --- | --- | --- | --- |
| Product owner | Product statement, users, v1 scope/non-goals, S01–S08, demo positioning, and incremental delivery intent | PRD sections 2–9 and 13–14 | Real payment execution, production launch, data/model selection, or implementation beyond separately accepted gates |
| API/architecture reviewer | Monorepo boundaries, provider-neutral contract-first direction, recommendation/authority separation, and I1–I5 sequencing | PRD sections 1, 5–6, 9–11; `docs/contracts/`; `docs/project-context.md` | Canonical schema, endpoint semantics, persistence model, or runtime adapter where a contract/ADR remains absent |
| Data/ML reviewer | Data-source limits, target/label separation, model non-authority, Notebook 01–10 gates, and mechanics-only Sparkov interpretation | PRD section 7; notebook plan; fast-path specification; Experiment 08 record | A production corpus, label policy, model family, calibration, threshold, model release, or performance claim |
| Security/governance reviewer | Secret/PII controls, provider-data boundary, authority/oversight separation, free-tier demo limitation, and error/redaction policy | PRD sections 10 and 13–14; `docs/data-governance.md`; `docs/project-context.md` | Sensitive-data hosting, a production security posture, credentials in the browser, or a live payment action |

The following are intentionally not resolved by PRD approval and need their
own accepted contract or ADR before related implementation begins:

1. Primary provider adapter, canonical event schema, money normalisation,
   direction, event-time, source-revision, and idempotency semantics.
2. Training target; corpus; label maturity/lineage; feature schema;
   point-in-time/online parity; and leakage-safe partitions.
3. Calibration method, operating threshold, route policy, review capacity,
   authority/oversight matrix, model release criteria, and rollback process.
4. Authentication, tenancy, persistence/recovery, evidence delivery, provider
   retries/reconciliation, and any production hosting/security decision.

To approve this PRD, each reviewer records `approved`, `approved with
conditions`, or `rejected` with a dated decision reference. Conditions or
rejections that affect scope, safety, architecture, or delivery require a new
PRD revision; never alter a signed revision in place. When all required roles
approve the same committed revision, record its Git SHA in the table above and
change this document's status to **Approved ground-truth PRD**.

## 13. Hosting, cost, and latency strategy

### 13.1 Deployment policy

The first public demonstration should be low-cost and reproducible, but it is
not a production risk service. A `$0/month` configuration is a best-effort
portfolio/demo target, not a latency, availability, privacy, or data-residency
guarantee. Plan selection, quotas, regions, terms, and pricing are revalidated
at each release.

No real customer data, payment credentials, Plaid access tokens, production
secrets, or regulated operational workload may be placed on a free-tier service
without a separate security, privacy, procurement, and reliability decision.

### 13.2 Initial demonstration topology

```text
Azure Static Web Apps (React console)
  → Azure Container Apps Consumption (FastAPI demo API, scale-to-zero)
      → deterministic synthetic scenario fixtures
      → in-process validation and current bounded demo workflow
      → optional Groq-backed demonstration investigation when configured
      → ephemeral run state only; no deployed database or provider adapter
```

Keep Tier 1 and Tier 2 inside the modular monolith for the first vertical
slice. Split them only after profiling demonstrates a real isolation, scale, or
reliability need. A request that needs a hard safety decision must not depend on
an LLM response, a cache hit, or a background audit write being successful.

### 13.3 Hosting candidates and constraints

| Layer | Demo candidate | Permitted use | Constraint / decision |
| --- | --- | --- | --- |
| Static console | Azure Static Web Apps Free | Public synthetic React/Vite console | Free plan is appropriate for this personal showcase; it has no SLA and is not a production financial-service hosting decision. |
| FastAPI demo API | Azure Container Apps Consumption | Public synthetic FastAPI API with scale-to-zero | Monthly free grants reduce cost but do not guarantee $0. Use minimum replicas of zero, no VNet/database/cache, a budget alert, and visible cold-start state. |
| Secrets | Doppler | Local and showcase environment variables | Keep service tokens and provider keys out of Git, browser code, logs, and Bicep parameters. |
| Investigation provider | Groq API, optional | Existing bounded demonstration investigation | Never required for hard controls; display an honest unavailable/outage state when unconfigured. |
| Operational store | None in MVP 1–3 | Deterministic fixtures and ephemeral single-run state | Container-local disk is not durable storage and must not be presented as transaction history. |

Do not use automated “keep warm” pings to circumvent scale-to-zero or free-tier
behaviour. Instead, disclose cold-start behaviour in the demo, make the UI show
a connection/warming state, and allow an in-person local fallback. Do not move
an Azure account to pay-as-you-go when an absolute zero-spend constraint is
required; budget alerts inform but do not cap consumption.

### 13.4 Latency and reliability requirements

- `Tier 1 inference latency` means only in-process model prediction after a
  validated feature vector is ready. It is not an end-to-end API promise.
- `Risk-score request latency` separately includes validation, feature lookup,
  hard controls, persistence decisions, and network calls. Report p50/p95/p99
  with region, hardware, warmup, concurrency, request volume, and cache state.
- Preload an approved model artifact at process startup only after model/package
  integrity checks. Optimisations such as `orjson`, NumPy conversion, or a
  compiled model are benchmark candidates, not substitutes for a measurement
  protocol.
- No `Access-Control-Allow-Origin: *` for authenticated or sensitive APIs.
  Use explicit allowed origins, server-side secrets, least-privilege service
  credentials, and redacted structured errors.
- Durable process/action/evidence state follows its approved commit/recovery
  contract. It cannot be silently deferred to a best-effort asynchronous write
  merely to improve perceived scoring latency.

### 13.5 Demonstration acceptance criteria

1. A cold API is visibly identified as warming; no latency promise is displayed
   before the measurement protocol has run.
2. S01–S05 complete using synthetic fixtures without public credentials in the
   browser or repository.
3. Azure Static Web Apps and Azure Container Apps deployments are reproducible
   from reviewed infrastructure code and a GitHub Actions OIDC workflow.
4. API origin, secrets, error redaction, health status, plan, region, free-grant
   limits, and budget-alert configuration are verified in the deployed environment.
5. Moving to customer, commercial, or sensitive data triggers a new deployment
   and security review rather than reusing the portfolio topology.

## 14. Showcase technology and service register

Status: **Selected showcase stack — not a production architecture approval**  
Scope: recruiter/employer demonstration using synthetic scenarios and simulated
actions.

The first public release demonstrates one coherent journey: a recruiter selects
a deterministic synthetic scenario; the console calls the demo API and shows
typed progress, factors, safety state, and simulated outcome; then the reviewer
can inspect the architecture, data/model limits, tests, and deployment setup.

Do not add a production database, authentication system, queue, cache, payment
processor, or external risk feed unless a visible showcase requirement cannot
be met without it.

### 14.1 Current repository technologies

| Category | Technology | Showcase responsibility | Boundary |
| --- | --- | --- | --- |
| Web | React 19, TypeScript, Vite | Browser console and static build | No backend imports or secrets in browser code. |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, Lucide, Motion | Accessible dashboard components and motion | Follow the approved Payments design system. |
| Guided tour | driver.js (MIT) | Opt-in spotlight tour of the Overview demo (choose a scenario, run it, inspect the results, go deeper to Analyse a transaction and Insights), offered from a first-visit welcome dialog and the help dialog | Browser only; it never starts by itself and no data leaves the page. Styled with the Payments tokens. Removal path: delete `apps/web/src/lib/useOverviewTour.ts` and its styles; the Getting started checklist still works without it. |
| Charts | Recharts; Plotly in notebooks | Console charts and offline evaluation diagnostics | Label synthetic/mechanics-only data honestly. |
| API | Python 3.13 (pinned in `apps/api/.python-version`; `>=3.11` supported), FastAPI, Uvicorn, Pydantic/FastAPI models | Typed demo routes, validation, SSE progress, and health | Current routes are demo routes, not the future operational contract. |
| Agent workflow | LangGraph and Groq SDK | Bounded demonstration investigation | Optional per demo run; no LLM may make a payment decision. |
| Governance SDK | Pinned Arbiris SDK | Existing signed-record demonstration | Do not edit `apps/api/vendor` outside an explicit SDK upgrade. |
| Quality | GitHub Actions, Ruff, Pytest, TypeScript build, Playwright, axe-core (`@axe-core/playwright`) | Build, lint, test, design, and automated accessibility evidence | CI does not make product or safety decisions. axe-core is a dev-only test library with no runtime dependency; it supplements, and does not replace, manual accessibility review. |
| Data science | Jupyter, Pandas, scikit-learn, XGBoost, Plotly | Feasibility and mechanics-only evaluation | Notebooks never promote a runtime model. |

### 14.2 Selected services for the first public showcase

| Service | Status | Why it earns its place | Configuration / safety rule | Fallback |
| --- | --- | --- | --- | --- |
| GitHub + GitHub Actions | Selected; CI configured | Public code, reviewable history, and automated quality checks | Synthetic-only repository; never put tokens in logs or committed files | Local `make check` before a demo. |
| Doppler | Selected; local usage exists | Keeps provider/API credentials and deployment values out of Git | Use named `dev` and `showcase` configs; browser code never receives service tokens | Ignored local `.env` from `.env.example`. |
| Azure Static Web Apps | Selected for web deployment; not configured | Static Vite deployment, TLS, preview environments, and a shareable Azure URL | Static synthetic console; API base URL is a public, non-secret build setting | Local Vite preview. |
| Azure Container Apps Consumption | Selected for API deployment; not configured | FastAPI container with scale-to-zero and an inspectable cloud-runtime story | Minimum replicas zero; no database, VNet, cache, or production claim. Free grants can be exceeded, so budget alerts and cost review are mandatory | Local FastAPI run for an in-person demo. |

### 14.3 External APIs and data sources

| Product / API | Status | Showcase use | Explicitly not used for |
| --- | --- | --- | --- |
| Groq API | Current; optional per run | Existing LangGraph slow-path demonstration when configured | Autonomous action, hidden reasoning display, or hard-control dependency. |
| Plaid Sandbox `/transactions/sync` | Current; notebooks only | Local, zero-retention schema/lifecycle observation and feasibility evidence | Runtime connector, customer data, canonical approval, model training, or demo dependency. |
| Sparkov simulated corpus | Current; offline mechanics only | Checksum-verified Notebook 08 evaluation mechanics | Production performance, thresholds, model serving, or payment action. |
| Stripe / Radar | Not selected | None unless separately approved | Training labels, fraud truth, payment processing, or hidden dependency. |

### 14.4 Deliberately deferred services

| Service/capability | Why deferred |
| --- | --- |
| Managed PostgreSQL | Add only when durable history/review state becomes a visible showcase capability; it is not in MVP 1–3. |
| Redis/cache, queue, worker scheduler | No bounded showcase requirement currently needs distributed state or asynchronous scale. |
| Production authentication/SSO and tenancy | A public single-operator showcase must not create a fake enterprise-security claim. |
| Production monitoring, SIEM, paging, feature store, model registry | Not credible to imitate without actual operations and a released model. Show health, logs, tests, contracts, and notebooks instead. |
| Payment processor or bank-data production access | The showcase uses simulated actions and must never use real financial data or payments. |

Before adding a dependency, record its visible journey, data class, owner,
cost/free-tier limitation, required secret names, and unavailable-service
fallback in this section. Update related CI/deployment documentation when that
choice changes.

Sources: [Azure Static Web Apps plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans),
[Azure Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing),
[Azure free account details](https://azure.microsoft.com/en-us/pricing/free-trial/),
[Doppler CLI documentation](https://docs.doppler.com/docs/cli), and
[Plaid Sandbox overview](https://plaid.com/docs/sandbox/).
