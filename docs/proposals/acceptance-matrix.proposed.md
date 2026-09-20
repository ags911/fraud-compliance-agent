# Phase 0 acceptance matrix — proposed

Status: **Proposed; not the accepted `docs/contracts/acceptance-matrix.md`**  
Version: `0.1-proposed`  
Scope: PRD v0.3 requirements, Phase 0 findings and F3/F3a preparation

This matrix identifies present evidence and future gates without pre-filling a
passing outcome. “Implemented” means an executable repository check exists;
“specified” means the test is named but cannot run until its dependency is
approved and built.

## Functional requirements

| Requirement | Decision / proposed contract | Verification | State | Earliest delivery |
| --- | --- | --- | --- | --- |
| FR-01 canonical facts | ADR-002/003; proposed canonical schema | Positive/negative six-entity schema tests; future provider mapping tests | Draft tests implemented; mapping pending | F3a |
| FR-02 point-in-time features | ADR-002/003/005; enrichment proposal | Snapshot schema tests; future as-of/leakage/parity tests | Draft schema test implemented; feature set pending | F3a |
| FR-03 deterministic controls | ADR-006 | Future route truth-table tests | Specified; policy pending | F3 |
| FR-04 typed recommendation | ADR-005/006/011; proposed operational API | Prediction schema rejects action enums; future API consumer test | Draft test implemented; API pending | F3/F3a |
| FR-05 bounded investigation | ADR-006/008/014/015; accepted public-showcase HTTP and SSE contracts; candidate runtime configuration | Exact scenario-only request and HTTP errors, ordered S01/S04/S05 transcripts, three-tool allowlist and rejection, call budget, same-run evidence citation, stable failure reasons, incomplete-state enforcement, controlled-window/provider/migration boundaries, redaction and authority non-bypass tests; later operational tests | Cross-application contract accepted; scenario runtime values and implementation remain pending; full Phase 3 pending | MVP 3 bounded slice / F4 |
| FR-06 authority and oversight | ADR-006/008/010 | Future authority/oversight matrix tests | Specified; decisions pending | F3/F5 |
| FR-07 durable idempotent processing | ADR-009 | Future real-PostgreSQL concurrency and crash tests | Failure matrix proposed; no database | F3 |
| FR-08 authenticated human review | ADR-009/010 | Future role, claim, expiry and optimistic-lock tests | Identity outline proposed; no auth | F5 |
| FR-09 evidence delivery | ADR-007/008/009 | Future SDK round-trip, signature, manifest and retry tests | Specified; SDK decisions pending | F3/F5 |
| FR-10 truthful UI states | ADR-011 plus accepted demo ADR-012 | Existing demo/browser failure tests; future operational consumer tests | Demo implemented; operational contract pending | MVP 2 / F3+ |
| FR-11 read-only replay | ADR-002/009/011 | Future correction/replay PostgreSQL and browser tests | Draft S08 invariant test implemented | F3/F6 |

## Phase 0 review findings

| Finding | Required resolution | Proposed evidence | Gate state |
| --- | --- | --- | --- |
| R1 pending oversight is not completed oversight | ADR-006/008 | Pending/completed/missing-evidence fixtures and SDK compatibility test | Pending |
| R2 authority denial survives review | ADR-006/009/010 | Revalidation and denied-authority route tests | Pending |
| R3 APP controls precede fast release | ADR-006 | Low-model/high-APP and hard-HOLD/agent-PASS tests | Pending |
| R4 training/live feature feasibility | ADR-002–004 | Mapping, availability, as-of and parity tests | Draft evidence only |
| R5 measurable calibration/thresholds/latency | ADR-005/006/011/014 | MVP 3 no-score/no-threshold contract assertions; later frozen temporal evaluation and measurement protocol | MVP 3 boundary accepted for preparation; F3a corpus/model decisions pending |
| R6 durability/replay/disconnect semantics | ADR-009/011 | PostgreSQL failure injection and reconnection tests | Failure matrix proposed |
| R7 SDK mapping and delivery ownership | ADR-001/007/008/014 | Public-image negative private-SDK check, first-party investigation boundary tests, and later signing SDK package/schema round-trip tests | Public investigation direction selected; detailed SDK/signing boundaries pending |

## Current executable checks

| Check | What it proves | What it does not prove |
| --- | --- | --- |
| `tests/test_proposed_canonical_domain.py` | Proposed Draft 2020-12 schemas are well formed; valid/invalid fixtures behave as declared | Contract acceptance, provider fidelity or runtime suitability |
| `tests/test_f3_preparation_artifacts.py` | Accepted synthetic S01–S08 coverage and metadata; exact MVP 3 three-tool allowlist; three-call/no-repeat budget; stable incomplete-failure contract; no-score/no-threshold and no-action policy; exact recorded S04 payee/device evidence; deterministic S05 outage; and explicitly deferred S06–S08 operational behavior | Runtime loader/routing behavior, account-activity evidence, later F3a scoring policy, S06–S08 stateful implementation, or A–F equivalence |
| `tests/test_proposed_showcase_investigation_controls.py` | Candidate live mode defaults off; exact access limits; Groq-only server credential/model policy; validated output/no-raw-logging boundary; no second-LLM fallback; local-only legacy coexistence; four cutover gates; explicit cutover; active-code/dependency removal with characterization/history preservation | Runtime admission/provider implementation, configured model choice, actual migration evidence and cutover decision, trusted Azure ingress parsing, provider spending enforcement or durable quota |
| `tests/test_public_showcase_api_contract.py` | Accepted scenario-only request and redacted HTTP errors; ordered terminal SSE semantics; S01 skip, S04 two-tool grounded result and S05 no-provider incomplete failure; no caller prompt/model, runtime score, threshold or action | Application implementation, live-provider quality, browser consumption or deployment |
| `tests/test_api_contract.py` | Current showcase HTTP/SSE implementation matches accepted ADR-012 artifacts | Operational F3 contract |
| `tests/test_modelling_*.py` | Reproducible mechanics-only evaluation library behavior | Released model, threshold or performance claim |

## Promotion conditions

Promote this matrix to `docs/contracts/acceptance-matrix.md` only when ADR-002
through ADR-011 have named approval records, accepted schema/API/event versions
exist, every current check records a passing command at the gate revision, and
each future check has an owning implementation phase. Do not copy this proposal
into contracts while decisions remain pending.
