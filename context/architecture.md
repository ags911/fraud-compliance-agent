# Architecture

> Supplementary synthesis — see the authority note at the top of
> [`project_overview.md`](project_overview.md). `docs/architecture/system-architecture.md`
> is explicit that it "describes structure only, does not approve anything";
> where it disagrees with the PRD, the delivery plan, or `docs/project-context.md`,
> those win. ADR status markers (**Proposed** / **Accepted** / **Accepted for
> preparation only**) are preserved exactly as recorded in
> `apps/api/docs/adr/README.md` — do not treat a Proposed ADR's content as
> built.

## 1. Tech Stack (code-verified, unchanged from prior audit)

**`apps/web`**: React 19.3.0, Vite 8.3.0 (6-entry multi-build — `index.html`
at the web root plus five design/visual-reference pages grouped under
`apps/web/references/`, see [`ui_context.md`](ui_context.md#reference-pages)),
React Router
7.18.4 (client-side only), Tailwind CSS 4.3.3 (CSS-first, no
`tailwind.config.*`), shadcn/ui (`radix-nova` style) + Radix UI + cva +
lucide-react, `cn` npm package for class merging, Recharts 3.10.1, date-fns,
driver.js (tours), Motion. No state-management or data-fetching library — raw
`fetch()` in hand-written hooks, React Context for cross-route state.
TypeScript ~7.0.2 (no compiler-level `strict`; `any` banned via oxlint
instead). Testing: Playwright only (E2E, visual regression, axe-core
accessibility) — no unit-test runner.

**`apps/api`**: FastAPI 0.141.1, Uvicorn 0.52.4, Pydantic 2.13.5, LangGraph
1.2.11 (legacy pipeline only), Groq SDK 1.7.0 (sole live LLM integration). No
Anthropic/OpenAI SDK. Python ≥3.11 declared, pinned 3.13 via `.python-version`
and Docker base image. `uv` dependency management; `ruff` (`extend-select =
["I", "S"]`, zero per-file ignores on `server/`). pytest. No ORM/database
anywhere in the dependency tree.

**PRD's own technology table (§14.1)** additionally lists: Plotly (data
science/notebooks), Jupyter/Pandas/scikit-learn/XGBoost (data science), and
the optional pinned **private Arbiris SDK** as the "governance SDK" — see §5
below for why that SDK is documented separately.

## 2. System Boundaries

- **Web ↔ API**: communicate only through accepted versioned contracts under
  `docs/contracts/` (never through proposals under `docs/proposals/`, even
  when a proposal is far along). Current accepted contracts:
  `demo-api.v1.openapi.json` + `demo-run-events.v1.schema.json` (legacy
  showcase surface, ADR-012, frozen by API drift tests) and
  `public-showcase-api.v1.openapi.json` + `public-showcase-events.v1.schema.json`
  (public investigation, ADR-015). `model-training-contract.v1.json` and
  `demo-model-summary.v1.json` are narrower accepted exceptions (mechanics
  benchmark only). **Not yet accepted**: canonical transaction schema,
  feature-snapshot schema, an operational OpenAPI, an acceptance matrix —
  these exist only as `docs/proposals/*.proposed.md` drafts.
- **Route construction**: every FastAPI route lives directly on the app
  instance in `apps/api/server/main.py` (no `APIRouter`). Current routes:
  `GET /health`, `GET /scenarios`, `GET /demo/model-summary`,
  `POST /showcase/investigations` (SSE), `POST /run` (SSE),
  `POST /run/preset/{scenario_id}` (SSE), plus the internal (hidden from the
  OpenAPI, `include_in_schema=False`) `GET /sandbox/scenarios/{scenario_id}/analytics`.
  Proposed internal routes (spec 0002, not built): `GET /cases`,
  `GET /cases/{case_id}`. Target/candidate routes (not
  built): `POST /risk/score`, `POST /transactions/{id}/process`,
  `GET /transactions/{id}`, `GET /reviews`, `GET /reviews/{id}`,
  `POST /reviews/{id}/decision`, `GET /monitoring/model-health`,
  `GET /monitoring/drift`.
- **Showcase investigation subsystem** (`apps/api/server/showcase_investigation/`):
  `models.py`, `settings.py`, `admission.py`, `provider.py`
  (`GroqInvestigationProvider`), `graph.py`, `fixtures.py`, `errors.py`,
  `runtime.py`. Implemented under **ADR-017** against the contracts accepted
  in ADR-015/016.
- **Legacy pipeline boundary**: `/run`, `/run/preset/{scenario_id}`,
  `/scenarios` require the optional vendored `arbiris-sdk` submodule; absent
  it, they 503 while `/health`, `/demo/model-summary`, and
  `/showcase/investigations` remain available.
- **Offline modelling boundary**: `apps/api/modelling/` (Sparkov benchmark
  library) is never imported by `server/` — enforced by
  `test_modelling_boundaries.py`. Its parameters live in the **accepted**
  `config/fast-path-model-training.v1.json`.
- **No background jobs/queue/worker** exists; all work is synchronous
  per-request, bounded by concurrency/timeout/tool-budget controls.
- **No database** (see §4). This is deliberate through MVP 1–3; PostgreSQL
  is a *proposed* F3 store only (ADR-009).

## 3. Proposed Canonical Domain Model (ADR-002 — **Proposed, not accepted**)

Six entities, each with an explicit "must not contain" boundary:

| Entity | Purpose | Must not contain |
|---|---|---|
| `SourceEvent` | Immutable observation | Derived risk features, operational outcome |
| `CanonicalTransaction` | Normalised point-in-time payment fact | Model label, recommendation, reviewer decision, executed action |
| `FeatureSnapshot` | Versioned features from eligible facts as of a cutoff | Future facts/labels |
| `Prediction` | Model/rule output tied to a snapshot + versions | Authority/oversight claim, executed-action claim |
| `RunContext` | Correlation/replay/idempotency metadata | Untrusted customer context as evidence |
| `OutcomeLabel` | Later truth/disposition observation | Use as an online feature input |

Core proposed invariants: money is integer minor units + ISO 4217 currency
(no floats, no implicit currency conversion); direction is an explicit field,
never a sign; `event_time`/`available_at`/precision are required and unknown
time is never guessed (a date-only Plaid value cannot fabricate an intraday
feature); `field_availability` distinguishes `observed`/`derivable`/
`unavailable`/`simulated` — absent data is never coerced to zero/false;
corrections create a new linked revision, never overwrite history; raw
provider customer/account IDs are pseudonymised before persistence and never
committed to Git fixtures. Schema draft: `fixtures/contracts/canonical-domain.v0.proposed.{valid,invalid}.json`
(contract-review examples only, not accepted payloads). This entire model
remains gated behind ADR-002 acceptance plus the resolution of P0-03/P0-04.

## 4. Proposed Operational Persistence (ADR-009 — **Proposed**; design only, no database configured)

PostgreSQL is the *proposed* F3 operational store (local container first, no
managed Azure database authorised). Proposed entities: transaction revision,
feature snapshot, prediction, processing run, review-queue state, review
decision, simulated action, evidence delivery. Key proposed invariants: same
idempotency key + fingerprint resumes one run; a different fingerprint on the
same key fails with a stable conflict; at most one simulated action per
approved transaction/run scope; a review decision is immutable once
submitted, and a stale version never overwrites it; browser disconnect never
cancels a durable run; replay never writes a second action. A proposed run
state machine (`none → ACCEPTED → PROCESSING → PENDING_REVIEW/COMPLETED_NO_ACTION → DECIDED → ACTION_PENDING → ACTION_COMMITTED → EVIDENCE_PENDING/FAILED`)
exists as draft vocabulary only — "state names are proposed vocabulary, not
accepted API enums."

### Implemented deterministic Sandbox store (not accepted runtime)

The deterministic source-to-score slice uses a two-phase data path:

```
explicit Plaid Sandbox import or refresh
  → sanitise and validate dated scenario events
  → versioned PostgreSQL scenario dataset and daily aggregates
  → deterministic scenario replay, API aggregates and charts
```

The import is a controlled preparation operation, not part of scenario
execution. After a dataset version is accepted, the operator flow must read
only the stored event and aggregate records. This avoids per-run provider
latency, rate limits and changing Sandbox data, and permits reproducible
time-based charts.

The store must retain the minimum fields needed to preserve point-in-time
semantics: pseudonymised scenario and account references, source revision,
event time, available time, time precision, direction, amount in integer
minor units, currency, permitted category or payee facts, provenance and
fixture version. It must not retain raw provider payloads, access tokens,
transaction descriptions or provider customer and account identifiers.

Web consumption: Radar's Scenario tab fetches the analytics for whichever
S01–S05 scenario is selected (no longer S04 only) and fills zero days across
`time_boundary` (`sandboxDailyActivitySeries` in
`apps/web/src/lib/sandbox-scenario-analytics.ts`, matching what the importer
writes). `read_analytics` serves the **newest imported** dataset per scenario
(`ORDER BY imported_at DESC`), so re-importing an older fixture would shadow
the Plaid-derived dataset. The web type `SandboxScenarioAnalytics` mirrors the
v1 contract, including `baseline_version`, `overlay_version` and
`enrichment_version` `s04-enrichment-v1 | sandbox-enrichment-v2`.

Known caveats: `replace_dataset()` deletes the parent `sandbox_datasets` row
before its referencing `sandbox_transactions`/`sandbox_daily_aggregates`, so
re-importing an existing fixture version fails with a foreign-key violation
(the append path deletes children first; fix: children first, plus
appends once migration 0002 applies, with a regression test).
`scripts/apply_sandbox_migrations.py` globs only `*_sandbox_*.sql` and keeps
no applied-migration record, so every migration must be rerunnable.

Each scenario dataset is isolated by scenario ID and fixture version. An
import or replay for one scenario must not mutate another scenario. The
2026-09-24 explicit import created a 331-event sanitised common baseline dated
2026-06-29 through 2026-09-23 and materialised isolated S01–S08 datasets with
all 87 calendar days, including zero-activity days. S01–S05 have one
transaction-shaped deterministic overlay; S06–S08 retain the baseline until a
controlled scenario-local append is supplied. Aggregation grain and retention
still require explicit approval.

#### Proposed durable investigation cases (spec 0002 — **Proposed**, not built)

[`docs/specs/0002-durable-investigation-cases/`](../docs/specs/0002-durable-investigation-cases/index.md)
designs F4 as a durable **record** of completed runs (not durable
processing, which stays F3/ADR-009). The API wraps its own SSE output in
`main.py` (runtime untouched), buffers identity-bearing events, validates them
against `public-showcase-events.v1`, and on the `done` frame commits one
`showcase_cases` row plus append-only `showcase_case_events` in one
transaction (3 s limit, shielded thread) — the stream is never altered and a
storage failure only means "Not saved". Cases are scoped to an anonymous
`X-Showcase-Browser-Id` (localStorage UUID; a scoping key, not auth), private
to that browser, 30 days / 50 cases, behind `SHOWCASE_CASES_ENABLED`
(default off; the public showcase stays database-free per ADR-016). Radar's
Session tab becomes Cases; case detail lives at `/transactions/:caseId`. It
needs an ADR accepting `showcase-cases.v1` before it is a contract.

#### Implemented local deterministic simulation runtime

The current local service now has a worker command, internal simulation-run
API, and browser subscription endpoint. The runtime introduces one durable, scenario-scoped
simulation run. A run has a fixed dataset revision, seed, ordered schedule,
current sequence, state (`pending`, `running`, `completed`, `failed`, or
`cancelled`), and a reset lineage. Scheduled events are immutable and unique
by `(simulation_run_id, sequence)`; their append record is the idempotency
boundary. A worker advances due events from the stored schedule. It never
calls Plaid, and each successful append recomputes only the affected scenario
features and daily aggregates in the same database transaction.

The browser receives a read-only SSE stream of run state and appended-event
notices, then reads the updated analytics representation. It cannot supply an
event body, alter a schedule, or write to another scenario. Reconnection uses
the durable sequence cursor, rather than re-emitting events. Starting a new
run is explicit and must either use a new isolated dataset revision or reset
to a declared baseline; it must never silently rewrite the historical record.
This local implementation needs a versioned API contract, an accepted
persistence decision, and an operational worker deployment decision before it
can be deployed or described as accepted runtime behaviour.

This is a proposed extension of ADR-002, ADR-003 and ADR-009. It neither
authorises a database nor changes the accepted database-free public showcase
contracts.

For the first proof, Neon PostgreSQL is the selected Sandbox-only managed
PostgreSQL implementation. The permitted enrichment surface is a versioned
`FeatureSnapshot`, not additional transaction fields: sanitised category
bucket; pseudonymised payee reference; UTC day of week and weekend marker;
UTC hour only when its precision is supplied; prior transaction count and
mean amount; amount relative to that mean; one-day and seven-day count and
amount velocity; and prior payee and category counts. Each value records its
availability. Raw descriptions and merchant names, provider identifiers,
access tokens, invented fraud labels and numeric risk scores are excluded.

## 5. Accepted Architecture Invariants (from Accepted ADRs — these ARE built rules)

**Routing/authority/oversight precedence (ADR-006, product-owner accepted
2026-09-20)**: invalid/unknown policy → fail-safe HOLD, no investigation;
hard deterministic control → HOLD, no investigation, explicit
`investigation_skipped` trace; clear low-risk → PASS, no investigation,
`investigation_skipped` trace; approved ambiguous route (S04) → bounded
investigation with ≥2 distinct read-only tool calls; deterministic outage
fixture (S05) → incomplete/failed investigation, fail-safe HOLD, no external
call; a valid agent recommendation is preserved separately from the
authority outcome, which stays outside the graph. **"Hard HOLD cannot be
bypassed by model or investigation output."**

**Public-showcase investigation boundary (ADR-014/015/016/017 — accepted for
this narrow boundary)**:
- Tool allowlist: `get_payee_evidence`, `get_account_activity_evidence`,
  `get_device_session_evidence` — read-only, schema-validated,
  server-allowlisted, bound to the current scenario. Policy/scoring/
  authority/mutation/external-provider/case-memory tools are excluded by
  design.
- Budget: **at most 3 tool calls total, at most 1 call per tool**; S04
  requires ≥2 distinct calls. Budget exhaustion without a valid
  evidence-grounded recommendation leaves the investigation incomplete.
- Failure contract (exact, applies to provider-unavailable, tool-failed,
  invalid-output, timeout, and tool-budget-exhausted): `investigation_status=incomplete`,
  fail-safe `HOLD` recommendation, `authority_status=not_evaluated`, no
  simulated action, one stable redacted `failure_reason`. **"A failed
  investigation cannot appear successfully completed."**
- Evidence grounding: every visible recommendation claim must cite an
  evidence ID returned in that same run; an unknown/missing citation is
  `invalid_output`. No hidden chain-of-thought is requested or stored.
- Live-provider controls: Groq is the sole optional live provider,
  credential + allowlisted model server-side, provider + model ID recorded
  per run, schema-validated structured output only, no raw
  prompt/response/reasoning/exception logging, no LLM fallback. Controlled
  window: **1 concurrent investigation, 2 per observed client per 10
  minutes, 10 per process-enablement window, 30-minute maximum window,
  45-second overall timeout**; client key from trusted ingress metadata
  only; counters are process-local and reset on restart — "safety settings,
  not performance/availability/cost/capacity claims."
- Recorded playback is continuously public; live mode defaults off and
  needs an explicit server-side kill-switch enablement.

**Legacy A–F / private-SDK migration gating (restated across ADR-013/014,
PRD, project-context.md)**: the private-SDK A–F workflow is a local-only
compatibility reference until the S01–S08 contracts/fixtures are accepted
and the repository-owned runtime's evaluation, browser-acceptance, and
public-container boundary checks all pass. Passing those gates does not
auto-trigger cutover — an explicit decision is still required; retirement
then removes the legacy workflow from the active app/dependency path while
preserving its characterization docs and Git history.

**Contract-freeze invariants (ADR-012, ADR-015 — accepted)**: no route may
approve/release/execute a payment; SSE failures expose only
`processing_timeout`/`processing_failed` (never raw provider/pipeline
errors); a terminal SSE event is not evidence of durable processing,
persistence, review, or action; a successful stream ends in exactly one
named `done` event with JSON data `{}`.

## 6. Full ADR Log

See [`progress_tracker.md`](progress_tracker.md) for the complete
ADR-by-ADR Architectural Decisions Log (ADR-000 template through ADR-019,
each with status/summary/invariants). Status summary: **0001–0011 Proposed**;
**0012 Accepted**; **0013 Accepted for F3 preparation only**; **0014
Accepted for scoped preparation only**; **0015–0017 Accepted**; **0018
Accepted for its narrow boundary, superseded in part by 0019**; **0019
Accepted**.

## 7. Vendored Arbiris SDK — Reference Architecture Only (NOT this repo's design)

`apps/api/vendor/arbiris-sdk/` is an optional, pinned git submodule (current
reviewed pin `27844250f926fe0ade2250dd99975c7283defc80`) for a **separate
product** — "Arbiris," an AI-agent compliance-infrastructure SDK for
FCA-regulated financial services, with its own README, AGENTS.md,
`docs/project-context.md`, dashboard, and ADRs. **It must never be modified**
except for an explicit pin/upgrade task, and its A–F legacy workflow must
never become a public-runtime dependency of this repo. Cite its architecture
only as external reference, never as this repo's own design:

- **AARF** (Agentic Audit and Accountability Reference Framework) is the
  SDK's own published open standard (CC BY 4.0) for AI-agent audit trails —
  an intent-record schema, ECDSA P-256 signing, human-oversight tiers,
  evidence-pack spec, and SM&CR governance mapping. Two schema generations
  coexist: v0.1 (frozen) and v0.2/v0.3 (current). `apps/api/server/records.py`
  in *this* repo reads AARF-shaped records — genuine provenance, but AARF
  itself remains vendor-owned IP.
- The SDK's own architecture (`docs/architecture/{agent,sdk}-technical-design.md`):
  a LangGraph pipeline (`DataIngest → SimA → SimB → HumanReview →
  Counterfactual → EvidencePack`), an `ArbirisClient`/`IntentRecordBuilder`/
  `IntentRecordSigner` component chain, PostgreSQL + row-level-security
  persistence, a planned Next.js 16 + Auth0 dashboard. **This repo's own
  ADR-001 explicitly states the direction is to move generic Arbiris
  governance capabilities (signing, evidence storage) into this repository
  over time, rather than depending on the vendor package long-term** — so
  some conceptual overlap with ADR-009 (PostgreSQL) and ADR-010
  (identity/roles) is intentional convergent thinking, not duplication; each
  remains independently decided and unaccepted in *this* repo.
- **FCA review findings** (`docs/reviews/fca-review-findings.md`, vendor-owned):
  a real regulatory-framing review found the SDK's signing/tamper-detection
  technically strong, but flagged that SMF accountability must name an
  individual (not a bare function code), that stated retention periods must
  be labelled as the SDK's own recommendation rather than a regulatory
  mandate (COBS/SYSC 9 don't prescribe them), and that an "Agent Inventory"
  concept was under-represented. Preserved here as a labelled external
  reference only — it is a finding about Arbiris, not about this repo.
- The "A–F" legacy scenario naming used throughout this repo's own docs
  originates from the vendored SDK's own demo agent design.

## 8. System Architecture Diagram Content (`docs/architecture/system-architecture.md`)

Diagrams are D2, rendered to SVG, regenerated via `make architecture-diagrams`,
checked in CI. **Build-state legend** used on every node: **Built**
(implemented + tested), **Planned** (approved in PRD/plan, not built),
**Proposed** (under review, no contract/implementation/commitment) — "mixing
what runs with what's planned is how a demo becomes a false claim."

- **Containers**: browser console, application service, offline evaluation
  workflow, contracts. The API is a **modular monolith on purpose** — the
  PRD keeps the deterministic tier and investigation tier in one process
  until profiling shows a real need to split, so a safety decision never
  waits on a network hop. **There is no database; run state is ephemeral.**
- **Pipeline stages and guardrails**: Ingestion (unavailable stays
  unavailable, never manufactured) → Intelligence (deterministic controls
  before any model-assisted assessment; a low score cannot bypass a hard
  control) → Orchestration (a recommendation is not an action; browser never
  supplies authority) → Action (every payment action is simulated; duplicate
  processing never creates a second action) → Monitoring (no invented
  trend/accuracy/false-positive figure; zero/empty/Unavailable are correct
  answers until real recorded data exists).
- **Data/model lifecycle**: three reproducibility properties — dataset
  pinned by SHA-256 (not just described), parameters live in
  `config/fast-path-model-training.v1.json` (not a notebook cell), and the
  output is a signed-off artifact recording git revision/seed/config
  version/payload digest. The gate blocks any path from a trained model to a
  payment decision; the benchmark is labelled "Sparkov mechanics" wherever
  it appears.
- **Trust boundaries**: browser carries no authority (roles/tenancy
  server-derived); the LLM is an untrusted, optional, bounded, timed-out
  contributor whose unavailability fails safe to HOLD; provider data,
  tokens, raw errors, PII, and model reasoning are all sensitive — the
  stream emits only stable categories (`processing_timeout`,
  `processing_failed`), never a provider's raw message.
- **Open decisions listed explicitly** (so their absence isn't oversight):
  no provider adapter selected; no operational store; public API deployed
  recorded-only (live mode has no approved model/secret yet); no approved
  model target or threshold; two console shells coexist (Overview shadcn vs.
  Payments shell) pending a migration decision; authentication is absent.

## 9. Deployment Architecture (Azure — verified 2026-09-21)

- **Topology**: React console → Azure Static Web Apps (Free); FastAPI demo
  API → Azure Container Apps Consumption, scale-to-zero (0–1 replicas, 0.25
  vCPU/0.5 GiB, UK South). No database/cache/queue/VNet in the resource
  group. `infra/azure/` holds reviewable Bicep (`subscription.bicep`,
  `main.bicep`) plus non-secret params; `.github/workflows/deploy-showcase.yml`
  builds the SDK-free image, publishes to GHCR by digest, authenticates via
  Azure OIDC (no client secret), runs `what-if`, deploys.
- **Release record**: source commit `942f92bf996fa6dfbbb1f229aca043d6d1b3beb1`,
  workflow run `35611121637`, web
  `https://thankful-grass-0e239cb1e.4.azurestaticapps.net`, API
  `https://fraud-compliance-showcase-api.happysmoke-49a5708a.uksouth.azurecontainerapps.io`,
  image `ghcr.io/ags911/fraud-compliance-agent-api@sha256:7ff33d7dce13f072b948e6a74f47a809ffba40884105af0dbe80d99d04ce8756`.
  `SHOWCASE_LIVE_ENABLED` is hard-coded `false` in the deployment template;
  no provider secret/model is configured. Subscription budget: monthly,
  £10-equivalent, 80%/100% alerts to a monitored mailbox (delivery
  unexercised — neither threshold crossed yet).
- **Verified checks**: `/health` 200; recorded S04 200 with two tool
  calls/results + one terminal `run_result`; live-requested S05 returned
  labelled recorded playback (200, deterministic incomplete fail-safe);
  invalid request → 422 `invalid_request` only; deployed origin got CORS
  grant, a foreign origin got none; Chrome loaded the SPA directly with no
  console errors.
- **Full record**: [`docs/archive/docs/audits/2026-09-21-mvp3-azure-release.md`](../docs/archive/docs/audits/2026-09-21-mvp3-azure-release.md)
  (archived, historical only).
  Doppler injection is prepared (`GROQ_API_KEY`, `SHOWCASE_GROQ_MODEL`,
  `SHOWCASE_GROQ_ALLOWED_MODELS`) but unused by this release; no model has
  been approved.

## 10. Data Governance Rules (`docs/data-governance.md`, current policy, not proposed)

**Storage classes**: schema/manifest/synthetic-fixture/experiment-record may
be committed to `docs/`/`fixtures/`/`config/`; sanitised small examples may
be committed exceptionally to `fixtures/` with documented source
class/transformations; raw provider/sandbox exports, processed/training
data, and model artifacts/checkpoints may **never** be committed — they live
in approved secure storage only. `data/`, `artifacts/`, `models/` are
git-ignored as defence-in-depth ("ignoring a file does not make it safe to
store on an unmanaged device or share externally").

**Required lineage** for every experiment/candidate model: git commit +
code/config revision; dataset/fixture manifest ID + source class + time
boundary; feature/schema version + transformations; metrics/cohort checks/
limitations/decision; artifact URI + checksum if one exists; named owner +
approval state.

**Promotion boundary**: "No notebook result, candidate configuration, or
locally trained artifact is a runtime model by default." Promotion needs an
approved target, data basis, evaluation criteria, release record, rollback
approach, and the corresponding contract/policy version.

**Proposed case retention** (spec 0002, not policy until built and
ratified): showcase cases kept 30 days and at most 50 per anonymous browser
ID; synthetic data only; stored content is the contract events (no prompts,
raw provider responses or reasoning).

**Accepted Plaid Sandbox boundary** (the one rule in this doc marked
accepted): local, zero-retention Sandbox analysis only — a notebook may hold
a response in memory long enough to produce a sanitised schema/aggregate
table; it must never write raw responses, identifiers, tokens, or per-row
customer-like data to the repo, notebook output, or an unmanaged local
export.
