# Progress Tracker

> This is the repository's active delivery record, part of the canonical
> `context/` baseline. It was generated 2026-09-22 by reading the former
> `docs/product/implementation-plan.md` and `apps/api/docs/adr/` before both
> were archived under `docs/archive/` (historical only, do not reference for
> active development). Keep the Current State block and the tables below
> current as delivery status changes. Since 2026-09-27 the web app is one
> page, the Risk Console (`apps/web/index.html`); the MVP 1–3 screen tables in
> [`progress_history.md`](progress_history.md) are the dated record of what
> shipped then, not current routes.

## Current State (2026-11-10)

**Phase.** The portfolio release shipped on 2026-09-30 and all six features in
[`docs/scope/scope.md`](../docs/scope/scope.md) are done. The public showcase
(Azure Static Web Apps plus one Container App, with one guarded Neon database
under ADR-021) is live. The last commit on `main` is dated 2026-10-01.
Delivery stages: F0 to F2 and F4a done; F3, F3a and F4 partly built (local and
internal use, as recorded below); F5 and F6 not started. Specs 0001, 0002,
0004, 0006, 0008, 0009, 0010 and 0011 are Accepted; specs 0003, 0005 and 0007
still say In Progress in their own headers.

**In flight.** No feature spec is being built. Open pull requests on
2026-11-10: #50 (making `context/` authority wording consistent with
`AGENTS.md`), ten Dependabot dependency bumps, and the context-loading tidy
(tiered reads, ADR index, handoff rule, this tracker). Known open items: the
`showcase-first-spend-test` budget email is untested until first spend
(ADR-021), and manual assistive-technology review is pending.

**Next.** Not chosen in the repository: the owner picks. The documented
candidates are closing specs 0003, 0005 and 0007, F5 (human review) and F6
(monitoring, replay), and the deferred list in `docs/scope/scope.md`
(Companies House enrichment, sanctions screening, human review, health and
replay, WebSocket transport, new model training).

**Decisions.** ADRs: the index at `apps/api/docs/adr/README.md`. Data and
model choices: the Data & Model Decision Log below.

**History.** MVP tables, dated delivery records and audit history are in
[`progress_history.md`](progress_history.md); read them only for what shipped
when.

## Technical Delivery Sequence (F0–F6)

| Status | Stage | Maps to |
|---|---|---|
| ✓ | F0 — Design and contract foundation | MVP 0 |
| ✓ | F1 — Application-shell foundation | MVP 1 |
| ✓ | F2 — Current API integration foundation | MVP 2 |
| ◐ | F3 — Fast-path operations foundation | Deferred extension 1 |
| ◐ | F3a — Approved source-to-score foundation | Deferred extension 1 |
| ◐ | F4 — Investigation foundation | Deferred extension 2 |
| ✓ | F4a — AI operations overview | Deferred extension 2 |
| — | F5 — Human-review foundation | Deferred extension 2 |
| — | F6 — Monitoring/integration-health/replay/hardening | Deferred extension 3 |

"F3a is an explicit substage between F3 and F4, added so the source-to-score
chain cannot be hidden inside Plaid integration or dashboard work."

F4a (added 2026-09-29 at the owner's request) is a substage between F4 and
F5: an LLM written overview of the Risk Console's main dashboard, built on
F4's bounded provider path. Scoped as feature 5 and designed in spec 0011
under ADR-026 (accepted 2026-09-29). Built, verified and tested; spec 0011
Accepted on 2026-09-30. The public deployment serves the template overview:
the deploy workflow leaves `SHOWCASE_OVERVIEW_LIVE_ENABLED` at its false
default.

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

**Dashboard wiring (2026-09-24):** Risk Console's scenario selector now reads the
Neon analytics for S01–S05 (Scenario tab stat cards and outbound chart). The
leftover 8-event `S04:s04-sandbox-v1` dataset was deleted from Neon (children
first, no appends referenced it), so S04 has only the Plaid-derived dataset.
Fixed 2026-09-27: `replace_dataset()` now deletes child rows before the parent,
so re-import works (see `architecture.md` §4 caveats).

**Next decision and delivery work:** add controlled append fixtures for
S06–S08 where future operational contracts supply transaction-shaped facts,
and ratify the
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
Spec 0003 (ratified 2026-09-24) has since replaced appends with an overlay on
the imported data, per browser ownership, limits, a 7 day sweep and an in API
worker, all built locally; its `verify.md` passed all 28 steps on 2026-09-27. The API contract,
a public database ADR and worker deployment still require decisions before
any public use.

**Spec [0004](../docs/specs/0004-score-route-feed-payments/index.md), slices 1
and 2 implemented locally, 2026-09-24 (spec In Progress).** Feed payments are
decided at run start by each scenario's deterministic rule; revealed non PASS
payments become saved `Live feed` cases; Risk Console's "Recommendations over time"
reads real decided counts (mock removed) and the Cases tab refreshes during a
feed. Migration `0006_feed_decisions.sql` is live in Neon. Verified live
against Neon and in the browser (`verify.md` fully ticked); fresh model review
approved with nits, all fixed (`docs/reviews/2026-09-24-feature-overview-live-model-work.md`).
ADR-024 accepted Slice 3's display-only Sparkov score boundary on 2026-09-28.
The committed `sandbox-portable-xgb-v1` XGBoost JSON artifact is trained from
the owner-local Sparkov corpus and loaded by a standard-library tree walker;
the rule table remains the only decider. Pinned artifact hashes, parity and
tamper-refusal tests, image validation and drawer copy are implemented. The
remaining spec verification is a local-Neon manual persistence inspection.

### F4 built locally: durable investigation cases

**Spec [0002](../docs/specs/0002-durable-investigation-cases/index.md) —
Accepted as a feature on 2026-09-27** (built locally; `/check verify` passed
all 40 steps against a local API and Neon). The public showcase stays database
free. Scope is F4
only, narrowed to a durable record of completed runs; 19 acceptance
criteria, three Tracer Bullet slices. ADR-020 accepted `showcase-cases.v1` and case
persistence for local and internal use on 2026-09-27; any
public enablement additionally needs ADR-021 (Proposed), a rate
limit, an expiry sweep and a hosting/secrets plan. [ADR-021 was accepted
and enabled on 2026-09-28.]

**Proposed regulatory-reference increment:** F4 may add a curated, dated FCA
Handbook extract corpus and bounded RAG retrieval to support cited S04
evidence. Each case would retain the corpus version, provision/source link,
and retrieved excerpts so replay remains reproducible. It is not legal advice
and cannot alter deterministic controls, authority, or human review. The
current tool allowlist does not include it. A live FCA API or MCP connector is
explicitly deferred to F6, where source terms, freshness, caching,
availability, monitoring, and replay would need their own approved design.
The agreed UI placement is an S04 case-detail Regulatory references panel and
matching trace event, not a Risk Console chart or generic Handbook chat. F6's Risk Console
Health tab may show corpus version, last review, and retrieval availability;
it must not claim FCA compliance.

**Dashboard implications for F5–F6** (agreed direction, not designed): Risk Console
stays the overview and links into product routes. F5's review queue belongs
on `/reviews` (S06 stale version shown as a case-page error); F6 adds a Risk Console
Health tab (freshness, dataset versions, provider status) and a read-only
replay/compare view on the case page (S08, "Replay, no action taken"). The
single "Run showcase" button does not fit S06–S08; their actions belong on the
case page and review queue, and the selector would group Decisions (S01–S05)
and Operations (S06–S08). Risk Console's Model tab overlaps the planned `/insights`.

## To do

Small, agreed follow ups that belong to no active spec yet. Tick an item, or
move it into a spec, when it is picked up.

**Risk Console guided tour** ([spec 0007](../docs/specs/0007-radar-guided-tour.md), built
locally 2026-09-24 with six steps covering only what Risk Console has today; a
seventh, "Raised by model", came with F3 on 2026-09-29). Add a step
only when its surface ships, and split the tour per tab if it grows past about
seven steps:
- [ ] F5 human review: point at the review queue (`/reviews`) or the case
  actions once they exist. Risk Console and the case page have no decision buttons yet.
- [ ] F6: a step for Risk Console's Health tab once it exists.
- [ ] S06 to S08: when the scenario picker groups Decisions and Operations
  scenarios, give Operations scenarios their own steps in place of the live
  feed and Run showcase steps, which do not apply to them.

**Mixed feed and feed lifecycle** (specs [0008](../docs/specs/0008-mixed-feed.md)
and [0009](../docs/specs/0009-visible-feed-lifecycle.md), 2026-09-25). A
scenario's feed routes every payment to one outcome, because `feed_decision()` is
per scenario (S01 PASS, S02/S03 HOLD, S04 CHALLENGE, S05 HOLD). Risk Console therefore
opens on a Mixed feed (`MIX`) that interleaves S01 to S05 payments, each carrying
its source scenario, fixture version, and that scenario's decision. The auto-start
waits for a visible tab, stops after 120 seconds hidden, and cancels on `pagehide`
with `keepalive`.

**Risk Console Operations brief** (proposed follow-up, 2026-09-26). Add an optional,
read-only dashboard summary that turns the currently available, sanitised Risk Console
data into a short evidence-linked brief: what changed, what needs attention,
and which displayed patterns explain it. It must distinguish facts from
suggestions, link every statement to its source card/case/time range, and must
not recommend or imply authority for an individual payment decision.
- [ ] Define the brief's approved input surface, evidence links, refresh
  behaviour, and empty/unavailable states in a feature spec before build.
- [ ] Keep suggested follow-ups operational and safe (for example, inspect a
  visible case group), never a payment-routing instruction.

## Architectural Decisions Log

The ADR folder is the decision log: see the index at
[`apps/api/docs/adr/README.md`](../apps/api/docs/adr/README.md) (one line per
ADR, 000 to 026, with status). Do not copy ADR titles, statuses or decisions
into this file. Full per-ADR invariants are preserved in
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

**Retired** (2026-09-28, product owner decision). `docs/product/prd.md` v0.3
never completed its §12 approval record and is archived at
`docs/archive/docs/product/prd.md`. It is superseded by `context/`, which is
the canonical product, architecture and delivery source, together with the
accepted ADRs and contracts. The four questions the PRD left open stay open
and need their own ADRs: the primary provider adapter and canonical schema;
the training target, corpus, label maturity and leakage safe partitions;
calibration, threshold, route policy, release criteria and rollback; and
authentication, tenancy, persistence, evidence delivery and hosting.
