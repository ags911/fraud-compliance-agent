# Progress Tracker

> This is the repository's active delivery record, part of the canonical
> `context/` baseline. It was generated 2026-09-22 by reading the former
> `docs/product/implementation-plan.md` and `apps/api/docs/adr/` before both
> were archived under `docs/archive/` (historical only, do not reference for
> active development). Keep the tables below current as delivery status
> changes; a screen row's tick must continue to match a real route in
> `apps/web/src/ProductApp.tsx` or `apps/web/vite.config.ts`.

## Active Phase

**Brownfield documentation-consolidation baseline established.** This
`/context/` directory synthesizes the PRD (v0.3, candidate), the
implementation plan, all 20 ADR files, all 14 proposal docs, all 10
experiment records, the design-system docs, the two point-in-time audits,
and the vendored SDK's reference architecture, as of branch
`feature/overview-live-model-work`, 2026-09-22.

## MVP Completion Detail (progress dated 2026-09-21)

### MVP 0 — Local engineering foundation

No screens (infra-only). 9/9 ✓: monorepo separation; `make check`/CI (3
jobs: web, API+SDK, API-no-SDK); FastAPI health/scenario/model-summary/
streamed-run endpoints; web SSE consumers; documented data-governance
boundaries; model training/eval moved to `apps/api/modelling` (2026-09-19,
API suite 89→209 tests); frozen v1 API contract (2026-09-19, ADR-012);
browser-to-local-API E2E for A–F+outage; API error redaction/CORS verified
locally.

### MVP 1 — Guided product walkthrough

| Status | Screen | Route | Notes |
|---|---|---|---|
| ✓ | Overview | `/overview` | Shared app shell, zero state, guided tour, KPI strip; synthetic demo data labelled as representative. |
| ✓ | Benchmark Insights | `/insights` | Read-only Sparkov benchmark evidence; cannot score a transaction, show drift, or make a production claim. |
| ✓ | Not Found | `*` | Branded recovery screen for any unavailable route, no invented data. |
| ✓ | Rules Performance reference | `/references/rules-performance-reference.html` | Frozen design reference only, not a product screen or data source. |

6/6 automated ✓ (manual assistive-technology review pending): zero state/
welcome dialog/tour/labelling; mechanics-only benchmark; recovery;
visual-only reference; axe passes both widths; welcome-dialog/tour behavior
decided 2026-09-19 (on-page checklist removed, driver.js 4-step opt-in
tour).

### MVP 2 — Live decision demonstration

| Status | Screen | Route | Notes |
|---|---|---|---|
| ✓ | New transaction / decision run | `/transactions/new` | Streams validated SSE events from `POST /run`/`POST /run/preset/{scenario_id}`; every action simulated. |
| ✓ | Decision workspace | `/transactions/run/:runId` or an in-place run result | Node status, model/rule outputs, counterfactual result, signed-record state, outage/fail-safe path. |
| ✓ | Overview | `/overview` | Continues as entry point; must not manufacture aggregate history from a transient run. |

6/6 ✓: scenario/run/SSE consumption; preset/custom-run + LLM-outage routes;
dashboard merged into Overview route (2026-09-19, standalone `dashboard.html`
removed); loading/cancellation/error/outage verification; simulated-outcome
labelling; decision-workspace tour added.

### MVP 3 — Azure public showcase

| Status | Surface | Notes |
|---|---|---|
| ✓ | Web console | Azure Static Web Apps Free, verified at the public URL by workflow run `35611121637`. |
| ✓ | Demo API | Azure Container Apps Consumption, 0–1 replicas. |
| ✓ | Public-safe investigation | 3rd live-only tool `get_account_activity_evidence` added (ADR-018/019); budget 3 total/1 per tool. |
| ✓ | Delivery | GitHub Actions, Azure OIDC, run `35611121637`, commit `942f92b`. |
| ◐ | Cost/safety | Doppler config prepared but unused; budget-alert delivery unexercised. |
| ◐ | Screens | MVP 1–2 screens remain; manual keyboard/screen-reader review pending. |

9/12 ✓ + 3 ◐ (Doppler config, budget-alert delivery unexercised, tour
API-status step).

**Deliberate MVP 3 scope exclusions (not gaps)**: dashboard trends/
sparklines/Plaid-scored history → F3a/F6; "what would change the outcome?"
counterfactual → F3a; S06–S08 stateful behavior → F3–F6 (503 is expected
today); real Groq execution optional/unclaimed (recorded playback is
default).

## Technical Delivery Sequence (F0–F6)

| Status | Stage | Maps to |
|---|---|---|
| ✓ | F0 — Design and contract foundation | MVP 0 |
| ✓ | F1 — Application-shell foundation | MVP 1 |
| ✓ | F2 — Current API integration foundation | MVP 2 |
| ◐ | F3 — Fast-path operations foundation | Deferred extension 1 |
| ◐ | F3a — Approved source-to-score foundation | Deferred extension 1 |
| — | F4 — Investigation foundation | Deferred extension 2 |
| — | F5 — Human-review foundation | Deferred extension 2 |
| — | F6 — Monitoring/integration-health/replay/hardening | Deferred extension 3 |

"F3a is an explicit substage between F3 and F4, added so the source-to-score
chain cannot be hidden inside Plaid integration or dashboard work."

### F3a in progress: deterministic Sandbox event data

**Status: Sandbox-only S04 proof activated locally on 2026-09-23; not
accepted or publicly deployed.** The approach is an explicit import into a
versioned, sanitised Neon PostgreSQL scenario dataset. Scenario runs, replay
and charts read stored dated events and daily aggregates rather than calling
Plaid directly.

**Initial proof evidence:** commit `9f82a9b`; migration
`0001_sandbox_scenario_data.sql` applied; `S04:s04-sandbox-v1` imported; and
the internal `GET /sandbox/scenarios/S04/analytics` endpoint returned `200`
from a local API process with `DATABASE_URL` injected by Doppler. The initial
eight-event fixture is retained as a reviewed local input, but has been
superseded in Neon by the full Sandbox baseline described below.

**Implemented and activated extension:** migration
`0002_sandbox_baselines_and_appends.sql` is live in Neon. On 2026-09-24, the
explicit Plaid Sandbox sync import stored a 331-event sanitised common
baseline, dated 2026-06-29 through 2026-09-23, and materialised S01–S08. Each
scenario stores all 87 days in that boundary, including zero-activity days.
S01–S05 have one deterministic transaction-shaped fixture overlay (332 events
each); S06–S08 retain the 331-event baseline until a scenario-specific
simulated event is appended. The served API remains read only and never calls
Plaid.

**Verified runtime evidence:** `PsycopgScenarioRepository.read_analytics`
read S04's latest Neon dataset as baseline
`plaid-sandbox-e464225804a6e6d1`, with 87 daily aggregates and 332 events.
The import uses Doppler-provided `PLAID_SANDBOX_ACCESS_TOKEN` and
`SANDBOX_PSEUDONYMISATION_KEY`; neither value is committed.

**Dashboard wiring (2026-09-24):** Radar's scenario selector now reads the
Neon analytics for S01–S05 (Scenario tab stat cards and outbound chart). The
leftover 8-event `S04:s04-sandbox-v1` dataset was deleted from Neon (children
first, no appends referenced it), so S04 has only the Plaid-derived dataset.
Open defect: `replace_dataset()` deletes parent before child rows and fails
on re-import (see `architecture.md` §4 caveats).

**Next decision and delivery work:** add controlled append fixtures for
S06–S08 where future operational contracts supply transaction-shaped facts,
fix the `replace_dataset()` delete order, and ratify the
time-aware event schema, Plaid mapping, retention and persistence in an ADR.
Only then may the store be represented as an accepted runtime data source.

**Implemented local extension, 2026-09-24:** migration
`0003_sandbox_simulation_runs.sql` is live in Neon. It adds durable,
scenario-scoped run and scheduled-event records. The local worker command
`run_sandbox_simulation_worker.py` advances due events idempotently; internal
API endpoints create and read run state and expose read-only SSE notices. A
live Neon S02 run completed all three scheduled high-velocity events, proving
the append and aggregate path end to end. S01–S05 have transaction-shaped
schedules. S06–S08 remain workflow cases, not fabricated transaction streams.
This is still an assumed, internal Sandbox design. The API contract, reset
lifecycle, worker deployment, and dashboard integration require ratification.

**Spec [0004](../docs/specs/0004-score-route-feed-payments/index.md), slices 1
and 2 implemented locally, 2026-09-24 (spec In Progress).** Feed payments are
decided at run start by each scenario's deterministic rule; revealed non PASS
payments become saved `Live feed` cases; Radar's "Recommendations over time"
reads real decided counts (mock removed) and the Cases tab refreshes during a
feed. Migration `0006_feed_decisions.sql` is live in Neon. Verified live
against Neon and in the browser (`verify.md` fully ticked); fresh model review
approved with nits, all fixed (`docs/reviews/2026-09-24-feature-overview-live-model-work.md`).
Slice 3, the display only Sparkov model score, is blocked on an ADR approving
the runtime score, its history features, the raw Sparkov source and the
`xgboost` runtime dependency.

### F4 designed, not started: durable investigation cases

**Spec [0002](../docs/specs/0002-durable-investigation-cases/index.md) —
Proposed (accepted by the engineer as a design on 2026-09-24).** Scope is F4
only, narrowed to a durable record of completed runs; 19 acceptance
criteria, three Tracer Bullet slices. Prerequisites before it is a runtime
contract: an ADR accepting `showcase-cases.v1` and case persistence; any
public enablement additionally needs an ADR revisiting ADR-016, a rate
limit, an expiry sweep and a hosting/secrets plan.

**Proposed regulatory-reference increment:** F4 may add a curated, dated FCA
Handbook extract corpus and bounded RAG retrieval to support cited S04
evidence. Each case would retain the corpus version, provision/source link,
and retrieved excerpts so replay remains reproducible. It is not legal advice
and cannot alter deterministic controls, authority, or human review. The
current tool allowlist does not include it. A live FCA API or MCP connector is
explicitly deferred to F6, where source terms, freshness, caching,
availability, monitoring, and replay would need their own approved design.
The agreed UI placement is an S04 case-detail Regulatory references panel and
matching trace event, not a Radar chart or generic Handbook chat. F6's Radar
Health tab may show corpus version, last review, and retrieval availability;
it must not claim FCA compliance.

**Dashboard implications for F5–F6** (agreed direction, not designed): Radar
stays the overview and links into product routes. F5's review queue belongs
on `/reviews` (S06 stale version shown as a case-page error); F6 adds a Radar
Health tab (freshness, dataset versions, provider status) and a read-only
replay/compare view on the case page (S08, "Replay, no action taken"). The
single "Run showcase" button does not fit S06–S08; their actions belong on the
case page and review queue, and the selector would group Decisions (S01–S05)
and Operations (S06–S08). Radar's Model tab overlaps the planned `/insights`.

## To do

Small, agreed follow ups that belong to no active spec yet. Tick an item, or
move it into a spec, when it is picked up.

**Radar guided tour** ([spec 0007](../docs/specs/0007-radar-guided-tour.md), built
locally 2026-09-24 with six steps covering only what Radar has today). Add a step
only when its surface ships, and split the tour per tab if it grows past about
seven steps:
- [ ] F5 human review: point at the review queue (`/reviews`) or the case
  actions once they exist. Radar and the case page have no decision buttons yet.
- [ ] F6: a step for Radar's Health tab once it exists.
- [ ] S06 to S08: when the scenario picker groups Decisions and Operations
  scenarios, give Operations scenarios their own steps in place of the live
  feed and Run showcase steps, which do not apply to them.

**Mixed feed and feed lifecycle** (specs [0008](../docs/specs/0008-mixed-feed.md)
and [0009](../docs/specs/0009-visible-feed-lifecycle.md), 2026-09-25). A
scenario's feed routes every payment to one outcome, because `feed_decision()` is
per scenario (S01 PASS, S02/S03 HOLD, S04 CHALLENGE, S05 HOLD). Radar therefore
opens on a Mixed feed (`MIX`) that interleaves S01 to S05 payments, each carrying
its source scenario, fixture version, and that scenario's decision. The auto-start
waits for a visible tab, stops after 120 seconds hidden, and cancels on `pagehide`
with `keepalive`.

## Architectural Decisions Log (`apps/api/docs/adr/`, ADR-000 through ADR-019)

Status legend from `docs/adr/README.md`: "`Proposed` means reviewable but
not authorised; only an accepted ADR and its versioned contracts may govern
implementation."

| ADR | Title | Status | Decision (one line) |
|---|---|---|---|
| 0000 | Template | N/A | Defines required ADR sections; "an author must not fill in approval on someone else's behalf" |
| 0001 | Application, SDK and package boundary | Proposed | This app owns fraud orchestration/contracts/persistence; consumes the pinned Arbiris SDK via packaged interfaces only, never the SDK's `examples/` |
| 0002 | Canonical domain contract | Proposed | Six-entity separation (`SourceEvent`/`CanonicalTransaction`/`FeatureSnapshot`/`Prediction`/`RunContext`/`OutcomeLabel`); money = integer minor units + ISO currency |
| 0003 | Plaid mapping and feature feasibility | Proposed | Continues local, zero-retention Sandbox analysis; mapping/feature artifacts remain candidates only |
| 0004 | Fraud target and corpus | Proposed | Keeps F3 deterministic-only until a licensed corpus with mature labels is approved; Sparkov is mechanics-only evidence, not a label source |
| 0005 | Model artifact and evaluation contract | Proposed | Freezes chronological partitions/calibration/metrics/threshold-selection protocol once ADR-004 resolves; XGBoost is a candidate, not a predetermined winner |
| 0006 | Routing, authority and oversight | Proposed (sub-decisions accepted 2026-09-20) | Deterministic controls precede model routing; recommendations ≠ actions; **MVP 3 has no numeric runtime score/threshold** |
| 0007 | Telemetry and signed evidence | Proposed | Separates operational telemetry from material signed evidence; Arbiris owns signing/generic evidence storage |
| 0008 | Inventory, oversight-pack linkage | Proposed | Represents review lifecycle as separate operational facts; Arbiris owns agent inventory/evidence-pack assembly |
| 0009 | PostgreSQL transitions and recovery | Proposed | PostgreSQL as proposed F3 store; idempotency/action-uniqueness/review-version DB constraints; no DB configured yet |
| 0010 | Identity, roles and deployment | Proposed | Provider-neutral actor/role outline; synthetic identities local-only; deployed bypass forbidden |
| 0011 | Operational acceptance and versioning | Proposed | Freezes versioned domain schemas/OpenAPI/event contracts once ADR-002–010 accepted |
| 0012 | Freeze the current showcase API contract | **Accepted** (2026-09-19) | Accepts `demo-api.v1.openapi.json` + `demo-run-events.v1.schema.json` for the legacy showcase surface only |
| 0013 | Adopt local-first F3 boundaries | **Accepted for F3 preparation only** (2026-09-20) | 8 local-first defaults; authorises preparation/review artifacts only, not an operational endpoint/DB/auth/model-serving |
| 0014 | Adopt public-safe showcase investigation boundary | **Accepted for scoped preparation only** (2026-09-20) | Repository-owned SDK-free bounded investigation as planned MVP 3 runtime; S04 sole normal path, S05 its failure path; tool allowlist/budget/failure-contract/live-window D1–D10 decisions |
| 0015 | Freeze the public-showcase investigation contract | **Accepted** (2026-09-20) | Accepts `public-showcase-api.v1.openapi.json` + `public-showcase-events.v1.schema.json` |
| 0016 | Accept public-showcase S01–S08 fixtures | **Accepted** (2026-09-20) | Accepts `fixtures/s01-s08/scenarios.v1.json` as sole canonical fixture packet; S06–S08 behavior deferred |
| 0017 | Implement public-showcase runtime | **Accepted** (2026-09-20) | Implements `apps/api/server/showcase_investigation/`; live mode off by default; no model identifier invented |
| 0018 | Accept Plaid Sandbox-derived showcase fixture enrichment rules | **Accepted for its narrow boundary; superseded in part by 0019** (2026-09-22) | 6 derivation rules for a future `scenarios.v2` packet; found S01/S02 rules have no runtime effect |
| 0019 | Accept Plaid Sandbox-derived S04 account-activity evidence | **Accepted** (2026-09-22) | Widens `EvidenceItem.source_class` to include `plaid_sandbox_derived`; adds one S04 evidence item; fixture packet → v1.1 |

Full per-ADR invariants are preserved in
[`architecture.md`](architecture.md#5-accepted-architecture-invariants-from-accepted-adrs--these-are-built-rules).

## Data & Model Decision Log

- **Corpus decision (2026-09-22)**: continue with **Sparkov**
  (CC0, `fraudTrain.csv` 1,296,675 rows/7,506 positive, SHA-256
  `fd7139200dbfcbed0b6742bbe05a4f1abce532c4fef20918228a651647a3e75d`;
  `fraudTest.csv` 555,719 rows/2,145 positive, SHA-256
  `12d553ab19440c752d2531ee1af44bb64f12cc3d3839f1649f19e81c230545f0`).
  **PaySim** (CC BY-SA 4.0 confirmed, but its balance-drain columns are
  excluded by the source's own leakage warning) and **IEEE-CIS** (real
  labels, but Kaggle competition licence never confirmed for public-repo
  use) were evaluated and **not pursued** — kept only as comparison
  records.
- **Notebook 08 v1 (mechanics-only, accepted contract `model-training-contract.v1.json`)**:
  chronological train/cal/test = 1,037,340/259,335/555,719, test prevalence
  0.386%. Logistic Regression: PR-AUC 0.1354, ROC-AUC 0.8324, Brier 0.0889.
  XGBoost: PR-AUC 0.4319, ROC-AUC 0.9789, Brier 0.0489. Report:
  `docs/proposals/fast-path-model-release.candidate.json`
  (`candidate_evaluation_pending_review`).
- **Notebook 08 v2, richer features (proposed, 2026-09-22, separate from
  accepted v1)**: 33 point-in-time features (amount/time-of-day, merchant
  category, card-history comparison, 1h/1d/7d velocity) — no name/address/
  DOB/job fields. All-33-feature model reached PR-AUC 0.961, ROC-AUC 0.9992;
  shuffled-label leakage control showed no structural leak (PR-AUC ≈ base
  rate); monthly stability 0.939–0.973. Verdict: "a real pipeline result but
  on simulated data only — cannot rule out it reflects Sparkov's generator
  patterns rather than real fraud signal." Report:
  `docs/proposals/fast-path-model-richer-features.proposed.json` (`proposed`).
  **No promotion for either version.**
- **Model architecture choice (comparison only, not release)**:
  class-balanced Logistic Regression as transparent benchmark, XGBoost as
  primary tabular candidate — Random Forest was briefly used for mechanics
  comparison and explicitly removed; CatBoost/LightGBM and graph/deep models
  remain deferred challengers.
- **Notebook/experiment status 01–08**: completed, proposal artifacts
  prepared, review pending on each. **09 (slow-path investigation
  evaluation) and 10 (monitoring/champion-challenger) are draft — not run**,
  blocked on unaccepted fixtures/protocol/release contracts.
- **Plaid Sandbox showcase-fixture decision (2026-09-22)**: Option A
  (hybrid recorded/sanitised derivation) chosen; only S04's
  `get_account_activity_evidence` tool actually changed runtime behavior
  (ADR-019) — S01/S02 derivation rules from ADR-018 turned out to affect
  fields the runtime never reads.

## Audit History (point-in-time evidence, not living status)

### 2026-09-18 repository audit — remediated

Findings at audit time, all subsequently remediated per the doc's own
update note: **P1** — UI claimed "Signature verified" without verifying
anything (`RecordPanel.tsx`) → fixed, now shows signed-not-verified;
**P1** — SDK submodule declared at the wrong path (`apps/api/.gitmodules`
instead of root) → fixed, SDK now a real root gitlink pinned at
`27844250f926fe0ade2250dd99975c7283defc80`; **P1** — repository inventory
generation was machine-state-dependent (leaked `__pycache__`) → fixed, now
based on tracked files, local/git-ignored, removed from CI; **P1** —
`/run`/`/run/preset` were unauthenticated and unbounded → acceptable only
for isolated local demo, addressed by the later public-showcase boundary
design (recorded playback default, live mode gated); **P2** — invalid
financial inputs accepted (negative amounts, `NaN`) → addressed via
`StrictFiniteModel` bounds; **P2** — HTTP/stream failures could report as
success → addressed in `useAgentRun.ts`; **P2** — a Stripe dashboard capture
with a real account identifier was candidate commit material → removed;
**P2** — web quality gates (`npm run check:payments-design`) not enforced
and one check was failing → promoted into `make check`/CI. Verified 2026-09-18:
`make check` passed, 43 Playwright tests (1 mobile-only skip), 21 API tests,
no known dependency vulnerabilities.

### 2026-09-21 MVP 3 Azure release — verified

Recorded-only public showcase deployed and verified. Full detail (URLs,
commit, image digest, verification checks, residual/deferred items) is in
[`architecture.md`](architecture.md#9-deployment-architecture-azure--verified-2026-09-21)
and the source record,
[`docs/archive/docs/audits/2026-09-21-mvp3-azure-release.md`](../docs/archive/docs/audits/2026-09-21-mvp3-azure-release.md)
(archived, historical only).
"This record captures the first successful Azure release of the synthetic,
database-free recruiter showcase. It is deployment evidence, not a
production readiness, fraud-performance, zero-cost, or live-provider
claim."

## Vendored SDK Linkage (reference only — see `architecture.md` §7)

This repo's own ADR-001 names a stated direction of moving generic Arbiris
governance capabilities (signing, evidence storage) into this repository
over time rather than depending on the vendor package long-term. ADR-009
(PostgreSQL) and ADR-010 (identity/roles) are independently decided but
conceptually echo the vendored SDK's own PostgreSQL+RLS / Auth0+firm_id
design. ADR-008 explicitly scopes agent inventory/evidence-pack assembly to
the vendor package, not this repo. None of this makes the vendored SDK's
architecture part of this repo's accepted design.

## PRD Approval Status

`docs/product/prd.md` v0.3 remains **"Candidate for approval"** — pending
product-owner confirmation and three unassigned reviewer roles
(API/architecture, data/ML, security/governance). Until its §12 approval
record is complete, "the API repository's accepted Phase 0 artifacts remain
authoritative for backend contracts." Four categories are explicitly *not*
resolved by PRD approval alone even once granted: the primary provider
adapter/canonical schema; training target/corpus/label maturity/leakage-safe
partitions; calibration/threshold/route policy/release criteria/rollback;
authentication/tenancy/persistence/evidence-delivery/hosting.
