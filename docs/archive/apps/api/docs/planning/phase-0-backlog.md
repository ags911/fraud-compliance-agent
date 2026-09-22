# Phase 0 backlog — Fraud Intelligence & Agentic Risk Platform

Prepared: 2026-09-13. Status: proposed task definitions, ready for review.

This artifact prepares Phase 0; it does not mark its work complete or approve the exit gate. Task IDs below are local planning identifiers, not existing GitHub issues. Owners are roles to assign, not claims of appointment. External issues, PRs and board changes require a separate delivery step and duplicate check.

Baseline and assessment: [Phase 0 PRD review](phase-0-prd-review.md). Architecture decisions use the [ADR template](../adr/0000-template.md).

## Scope and limits

Phase 0 produces approved decisions, canonical contract artifacts, deterministic characterization/contract tests, and a reviewable gate packet. It does not train models, migrate the runtime away from the SDK example, build an operational database, implement real actions, deploy endpoints, or complete later phases.

Tiny contract-only SDK probes and test fixtures are in scope for Phase 0 execution. New production services, schema-generation changes, generic Arbiris features and full ingestion are not. Preserve existing user changes. Never make passing a legacy test equivalent to approving its policy behavior.

AARF v0.3 is the framework; signed intent records use `AARF-0.2`. Policy classifications in this sandbox are demonstrative and must be labeled accordingly. Do not represent a project-owner review as a real regulated firm's SMF attestation.

## Task order and dependencies

| ID | Issue-sized task | Depends on | Proposed owner | Size |
|---|---|---|---|---|
| P0-01 | Characterize the existing API and scenarios | None | Backend/test lead | 1–2 days |
| P0-02 | Draft canonical event, transaction and feature contracts | None | Backend/data lead | 1–2 days |
| P0-03 | Validate Plaid mapping and feature availability | P0-02 draft | Data/integration lead | 1–2 days |
| P0-04 | Select the prediction target, corpus and evaluation design | P0-02 draft | ML lead | 2–3 days |
| P0-05 | Specify routing, action authority and oversight | P0-01, P0-02 draft, P0-04 target | Risk/engineering owner | 1–2 days |
| P0-06 | Specify AARF mapping and governance artifacts | P0-05 | SDK/governance owner | 1–2 days |
| P0-07 | Specify durable processing and reviewer concurrency | P0-05, P0-06 | Backend lead | 1–2 days |
| P0-08 | Define package, authentication and repository ownership | P0-01, P0-05 | Technical owner | 0.5–1 day |
| P0-09 | Freeze contracts and write acceptance specifications | P0-02 through P0-08 | Test/technical lead | 1–2 days |
| P0-10 | Assemble and review the Phase 0 exit packet | P0-01 through P0-09 | Project owner/reviewers | 0.5–1 day |

Sizes are planning estimates of focused effort, not calendar commitments. Corpus access and SDK interpretation may change them. P0-03 and P0-04 can use the same draft independently; both feed the frozen contract in P0-09. If a decision changes a dependency, reopen the affected artifact before sign-off.

## P0-01 — Characterize the existing API and scenarios

Purpose: preserve useful behavior while identifying deliberate changes needed for the new platform.

Deliverables: `docs/contracts/legacy-baseline.md`, isolated fixtures, and `tests/characterization/`. Read the pinned SDK's existing `fraud_compliance_agent_v2` tests before adding overlapping coverage. Record API/SDK SHAs and the environment needed to reproduce results.

Acceptance criteria:

- Cover A–F: Sim A scores/outcomes, Sim B outcomes under fixed provider replies, graph route, counterfactual presence, emitted records and evidence-pack invocation/output.
- Test both SSE endpoints, invalid scenario, stable terminal behavior and provider outage. Distinguish current raw error exposure from the target redacted contract; do not endorse it by accident.
- Verify real SDK serialization/signing with known test keys and outputs isolated from user records. Stub LLM/translation and Plaid calls; never call funded providers in characterization tests.
- Freeze or normalize clocks/UUIDs only for comparisons; verify each actual signature against its original payload and correct key. Do not compare random signature bytes as snapshots.
- Document known gaps, including the current route after Sim B, timestamp-free history and inferred oversight declarations. Maintain a separate target-behavior matrix for approved changes.

Test expectations: deterministic local `uv run pytest tests/characterization`; repeatability without secrets or network; meaningful record verification rather than only “a JSON file exists.” Define the command when the tests are implemented. This planning task has not run that suite.

Exit evidence: test report, baseline fixture inventory and list of intended behavior changes. No runtime extraction in this task.

## P0-02 — Draft canonical contracts

Purpose: prevent source facts, derived features, labels and execution state from being conflated.

Deliverables: draft contract document and schema fixtures for `SourceEvent`, `CanonicalTransaction`, `FeatureSnapshot`, `Prediction`, `RunContext` and `OutcomeLabel`; ADR-002.

Acceptance criteria:

- Define source ID versus internal transaction ID, customer/account/payee references, event time, availability/ingestion time, timestamp precision, source revision and correction lineage.
- Define money with decimal/minor-unit semantics, direction and currency; specify negative/zero values and conversion policy. GBP authority limits cannot silently apply numerically to other currencies.
- Derive features from eligible historical facts. Represent unknown/not-supported separately from zero/false; document nullable features, valid ranges and imputation ownership. Timestamp-free legacy fixtures remain explicitly synthetic/legacy.
- Keep labels and reviewer outcomes outside online model features. Distinguish fraud truth from operational recommendation, reviewer disposition and simulated action outcome.
- Define ordered feature names, data types, categorical encoding, schema version, as-of cutoff and snapshot hash. A public API's arbitrary `customer_context` is not automatically trusted evidence.

Test expectations: schema examples for valid, missing, unsupported, negative, non-finite, mismatched-currency and timestamp-precision cases; expected validation outcomes. Executable freezing occurs in P0-09 after source/corpus feasibility checks.

Exit evidence: draft schema and decision log, ready for mapping and dataset review.

## P0-03 — Validate Plaid mapping and feature availability

Purpose: make the proposed live demonstration possible without fabricated source facts.

Deliverables: field-mapping table; `docs/contracts/feature-availability.md`; sanitized input/output fixtures; ADR-003.

Acceptance criteria:

- For every proposed v1 feature, classify availability in Plaid, the selected training corpus, replay and synthetic scenarios: observed, derivable, unavailable or simulated. Capture provenance and freshness limits.
- Specify amount direction, currency, category, account scoping and timestamp precedence. Date-only input cannot silently populate 10-minute/1-hour windows or precise hour-of-day features.
- Specify added/modified/removed events, pending-to-posted linkage, replay of the same sync page and a missing transaction ID. Never substitute a different transaction when lookup fails.
- Describe sync cursor persistence/retry boundaries and late-arriving corrections; retain as-known-at-scoring snapshots for replay.
- Define a linked simulated payment object for action demonstrations. Full Plaid sync remains Phase 5; Phase 0 fixtures must not require credentials.

Test expectations: mapping fixtures for date-only records, unknown device/payee data, credits/debits, pending replacement across pages, changed amount, duplicate event and account mismatch. Source schema assumptions reference current official Plaid documentation.

Exit evidence: mapping and feasibility report. Final feature acceptance waits for P0-04 and P0-09.

## P0-04 — Select prediction target, corpus and evaluation design

Purpose: establish what a model score means and whether the dataset supports the product claim.

Deliverables: dataset decision record with candidate comparison, chosen source/license/access route, sample schema, feature-coverage mapping, label policy and evaluation protocol; ADR-004 and ADR-005. No training in Phase 0.

Acceptance criteria:

- Select the prediction unit and target: unauthorized fraud, APP scam, or explicitly justified alternatives. Preserve a separate APP safety policy when the ML target does not cover it.
- Compare a small set of relevant accessible corpora and choose one based on feature/label compatibility, temporal information, licensing and demonstrable access. A link alone is not evidence that the necessary columns are available.
- Define positive/negative/unknown labels, maturity horizon, label availability date, exclusions, delayed outcomes and selection bias. Never treat every unlabelled record or human release as confirmed non-fraud.
- Define chronological training, calibration/selection and final test partitions, including historical label cutoffs. The calibration fit is disjoint from base-model fitting; no final-test tuning. Evaluate final calibration and discrimination on the untouched test set.
- Specify prevalence, PR-AUC definition, review capacity, cost assumptions and threshold selection protocol. Select numerical promotion criteria before candidate tuning; document insufficient-positive-sample handling.
- Resolve one-model compatibility with Plaid or propose explicitly separated benchmark and demo models. Synthetic rule-generated labels must not be used to claim independent predictive superiority.

Test expectations: sample-schema feasibility check and a partition/leakage fixture plan (future event, late known event, future-resolved label, duplicate payment, immature negative). Test reports distinguish source-observed labels from synthetic demonstrations.

Exit evidence: approved corpus/target decision plus split and evaluation design. Unresolved corpus access blocks training, not completion of unrelated Phase 0 tasks.

## P0-05 — Specify router, authority and oversight

Purpose: define every route and action's eligibility before any new simulated execution.

Deliverables: decision table, action-by-tier matrix, reviewer/executor authority policy, target scenario mapping; ADR-006.

Acceptance criteria:

- Run applicable deterministic Sim A and Sim B Stage 1 rules before fast release. Specify APP and missing-evidence routing independently of unauthorized-fraud score.
- Distinguish `PASS`/recommended route from executed `RELEASE`. Resolve exact boundary membership and the registry's evaluation threshold versus the two router thresholds. Define whether routing uses calibrated probability.
- Define authority and oversight as independently evaluated controls. Unknown policy/context fails closed without fabricating an executed HOLD.
- Define who can act following authority denial; human approval cannot silently expand investigator authority. Approval is bound to action, transaction version, amount/currency, policy scope and expiry; require revalidation at execution.
- Define sandbox action effects, challenge variants and their classifications. Do not label real account-affecting releases Tier 3 solely because of low value, or customer-facing warnings Tier 3 solely because they are informational.
- Amend Phase 2 to include a minimal execution gate; until review is available, approval-dependent cases remain pending with no action. Resolve high-score scenario L versus the ambiguous-only investigation rule.

Test expectations: decision-table cases for low ML/high APP, hard HOLD plus agent PASS, 0.20/0.80 boundaries, non-GBP authority, unknown policy, expired approval, action changed after approval, reviewer overriding recommendation but not non-overridable policy, and denied authority followed by approval.

Exit evidence: approved matrix and route truth table with a future test expectation for every branch.

## P0-06 — Specify AARF mapping and governance artifacts

Purpose: prove that the available SDK can represent the required facts truthfully and preserve them.

Deliverables: event-to-evidence matrix; SDK compatibility/gap report; inventory, linked-oversight and completeness contract specifications; ADR-007 and ADR-008. Generic SDK feature changes are follow-on work in `arbiris-sdk`, not implemented here.

Acceptance criteria:

- For each material event, identify operational storage, signed record or linked artifact, responsible component, provenance, correlation, retention class and privacy treatment. Include model promotion, policy changes, authority and final review decisions.
- Validate a conceptual decision through the real SDK model/builder in an isolated contract probe. Inspect persisted `policy_reference` objects, structured `reasoning_chain`, `output_summary`, pseudonymous customer reference and signed correlation metadata. Unsupported fields must not be silently discarded.
- Separate required oversight from completed review. Resolve pending Tier 2 representation with the normative framework/SDK owner. If unresolved, explicitly defer that execution mode; no false `post_execution`, no invented enum, no rewrite of original signed records.
- Specify first-class inventory ownership and required fields; distinguish an activity-derived extract. Specify linked reviewer identity, timestamps, decision and relationship to action/intent records, including allocating IDs before approval where needed.
- Specify signature verification/key lookup, complete pack membership, excluded/missing records versus included policy exceptions, verification manifest and accountable-SMF attestation. Identify demo signatures as demo signatures.
- List each unsupported requirement with owning repository, delivery dependency and acceptance gate. Link relevant existing upstream issues when verified; do not infer live completion from SDK documentation.

Test expectations: SDK schema round-trip, real signing/verification, tampered payload detection, retained model/policy/feature and run identities, linked approval references, and expected rejection of unsupported version strings. Phase 0 fixtures specify manifest omissions and pending reviews even where implementation must wait.

Exit evidence: evidence contract approved with no unsupported feature claimed as working. Critical gaps block the affected execution mode, or require an explicitly approved scope reduction before gate closure.

## P0-07 — Specify durability, idempotency and review concurrency

Purpose: make retries, crashes and human decisions safe to implement in PostgreSQL.

Deliverables: operational entity/constraint design; run/review/action transition tables; failure matrix; endpoint semantics; ADR-009. This task designs persistence and recovery; it does not deploy a database or worker.

Acceptance criteria:

- Define `/risk/score` as payment-state-free, including whether prediction persistence/evidence is synchronous; define `/process` as stateful, with accepted run ID and durable lifecycle. Specify the source/creation contract for the transaction being processed.
- Define idempotency scope, request fingerprint and conflict behavior. Duplicate processing returns or resumes the same run; conflicting payloads fail. Link source pending/posted revisions without double-executing the same simulated payment.
- Specify database uniqueness and transactional rules for action execution, review finalization and review-version conflicts. Assignment ownership is enforced server-side. Preserve immutable review decisions separately from mutable queue state.
- Cover `REQUESTED_INFO`, expiry, rejection/no-action, reassignment and administrative correction semantics. `DECIDED` need not imply execution succeeded; track action outcome separately. Expiry cannot silently release a payment.
- Define approval revalidation and the commit protocol for action and evidence, including an action committed before evidence confirmation, unavailable DB/signing, restart and duplicate delivery. Select reconciliation/outbox strategy explicitly; no unsupported distributed exactly-once promise.
- Define SSE event IDs/reconnection and browser disconnect behavior. Durable processing is not dependent on keeping a browser request open. Replay is read-only with respect to actions and preserves original results.

Test expectations: written failure-injection cases for two simultaneous process requests, two reviewer finalizations, crash before/after action commit, stale approval, signed-evidence retry, reconnect and historical replay. Integration tests must use PostgreSQL; isolated unit tests may use in-memory repositories.

Exit evidence: transition and crash tables are complete enough for an implementer to determine response, durable state, action count and evidence status for every case.

## P0-08 — Define package, security and repository ownership

Purpose: establish stable ownership and protect new endpoints from their first non-local release.

Deliverables: dependency/boundary plan, role-by-operation matrix and configuration design; ADR-001 and ADR-010.

Acceptance criteria:

- Keep production fraud orchestration in this API repository and consume the packaged SDK. Preserve the SDK example as a characterized reference; choose a reproducible package pin/build strategy without relocating runtime logic during Phase 0.
- Assign fraud operational facts and review execution to the API, generic evidence/pack capabilities to Arbiris, and console presentation to the frontend. Define interfaces without assuming the frontend has been reviewed.
- Require server-derived actor/tenant context and appropriate role checks for mutable operations; do not trust submitted reviewer IDs or `firm_id`. Protect sensitive read endpoints as well as writes. Define whether v1 is single-firm or multi-tenant without accidentally claiming tenant isolation.
- Specify `scorer_operator`, `fraud_reviewer`, `model_approver` and administrator permissions, including whether administrator authority is sufficient for a qualified review. Local bypass must be explicit and impossible in deployed configuration.
- Introduce authentication before the first exposed mutable endpoint, minimal structured errors/logs and CI with early slices, and artifact integrity/compatibility checks before model promotion. Phase 6 is hardening, not their first implementation.

Test expectations: role allow/deny table, missing identity, spoofed reviewer/tenant, local bypass under deployed config, record access, promotion race and incompatible model artifact cases.

Exit evidence: approved dependency and authorization matrix with owning repo for each cross-repository change.

## P0-09 — Freeze contracts and acceptance specifications

Purpose: converge independently drafted decisions into one implementable contract set.

Deliverables: canonical schema artifacts, valid/invalid fixtures and contract-only tests; `docs/contracts/acceptance-matrix.md`; ADR-011; corrected milestone/task-order mapping.

Acceptance criteria:

- Reconcile training and Plaid feature availability into the final v1 feature subset. Freeze source, feature, prediction, run, tool, authority, review and evidence-link contracts; define versioning and migration rules.
- Implement only pure schema validation/contract checks in this phase. Do not add a model, production feature service, execution engine or runtime migration.
- Map each PRD requirement and review finding to owner, artifact, acceptance test and earliest implementation phase. Bring the new oversight, authentication, optimistic-locking, inventory and manifest gates into §53 coverage.
- Define deterministic unit/contract checks, later PostgreSQL integration checks and separately controlled live-provider evals. Model scores in router unit tests are stubbed; fixed score fixtures must not be represented as model performance evidence.
- Specify latency measurement boundary, hardware/concurrency/warmup/sample count, raw versus calibrated metrics, numerical agent-eval release criteria and safety-invariant expectations. Define no-label monitoring as unavailable rather than reporting an invented false-positive rate.
- Make §52 the authoritative phase sequence and align §55. Ensure the minimal gate accompanies Phase 2 actions and evidence acceptance accompanies every slice.

Test expectations: `uv run pytest tests/characterization tests/contracts` once implemented, suitable lint/type checks for added schemas, and CI collection that cannot silently skip critical cases. Capture actual command results in the gate packet; do not prefill passing status.

Exit evidence: schemas and ADRs are internally consistent, executable contract tests pass, and every acceptance item has an owner and test location or later-phase specification.

## P0-10 — Assemble the exit packet and obtain approval

Purpose: make proceeding beyond Phase 0 an explicit, evidence-based decision.

Deliverable: `docs/planning/phase-0-gate.md` containing artifact revisions, test results, open decisions and approval records. No approval is supplied by this backlog.

Acceptance criteria:

- Record PRD revision, API/SDK commits, accepted ADR revisions, schema versions, mapping/corpus decisions and reproducible test commands/results.
- Confirm all P0 task artifacts exist; distinguish implemented tests from future test plans. No unknown test outcome is marked passed.
- For every R1–R7 finding, record its resolution, supporting artifact and approver. Critical unresolved items either block their dependent scope or have an explicitly approved scope reduction; silent deferral is not acceptance.
- Record project-owner approval and the designated technical/data/governance reviews, with identity, date and exact artifact revision. Identify which approvals are sandbox demonstrations versus real organizational approvals.
- State the next permitted scope. Passing Phase 0 does not authorize “build everything”; release only the agreed next increment after the user approves the gate and scope.

Test expectations: reviewer checks traceability, test evidence, dependency consistency and that no production work has been introduced under a contract-only task.

Exit evidence: explicit approval record. Until it exists, stop at the gate and report the reviewable packet.

## ADR inventory

Use one template for all decisions; populate only decisions supported by evidence. Status is `Proposed` until a named reviewer accepts that exact revision.

| ADR | Subject | Owning task | Decision-specific questions |
|---|---|---|---|
| 001 | Application/SDK/package boundary | P0-08 | Which interfaces are packaged? How is the pin reproduced? What remains a legacy fixture? |
| 002 | Canonical event/transaction/feature contract | P0-02 | Which clocks, monetary units, source revisions, missing states and trust boundaries apply? |
| 003 | Plaid mapping and feature feasibility | P0-03 | Which features are observed, derivable, absent or simulated? How are pending/posted identities related? |
| 004 | Fraud target and corpus | P0-04 | What does a label mean, when is it known, and can the same features serve the demo? |
| 005 | Model artifact and evaluation contract | P0-04 | Which splits, calibrator, encoders, hashes, metrics, thresholds and promotion rules are pinned? |
| 006 | Router, authority and oversight | P0-05 | Which hard rules precede release? Who acts after denial? Which effects require which review? |
| 007 | Telemetry versus signed evidence | P0-06 | Which events are material? Where do metadata and correlations persist without silent loss? |
| 008 | Inventory, oversight linkage and packs | P0-06 | How is pending review represented? Who owns artifacts, exclusions and attestation? |
| 009 | PostgreSQL transitions and recovery | P0-07 | Which uniqueness constraints, durable states, locks and reconciliation rules prevent duplicates? |
| 010 | Identity, roles and deployment | P0-08 | Who can score, process, review, promote, configure and read evidence? |
| 011 | Acceptance and performance protocol | P0-09 | What is measured, with which fixtures and conditions, and what constitutes passing? |

## Execution handoff

> Execute Phase 0 only using this backlog and the latest approved PRD. Resolve the decision register through contract artifacts, characterization tests and proposed ADRs. Keep unsupported SDK behavior visible. Do not train models, migrate production fraud logic, implement later-phase services or deploy changes. At the exit gate, present the artifact revisions, actual test results and outstanding decisions for approval. Do not proceed beyond the gate without approval of the required artifacts and next scope.
