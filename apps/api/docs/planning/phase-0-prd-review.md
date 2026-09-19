# PRD review and Phase 0 decision register

Reviewed: 2026-09-13. Scope: the latest supplied PRD, the API checkout, and selected normative documents and source in the pinned SDK. This is a planning assessment, not a completed implementation or compliance assessment. The frontend and live GitHub delivery status were not audited.

Source PRD: a pasted document held outside the repository (local path omitted).

API baseline: `e67d795243816ed5cc4abc1b472c26faed86f759`.
SDK baseline: `27844250f926fe0ade2250dd99975c7283defc80`.

## Assessment

The six corrections requested in the preceding review are present: separate authority and oversight gates, precise oversight terminology, required PostgreSQL, earlier authentication, scoring/processing separation, and versioned review mutations. The framework/schema wording is also corrected. The architecture is suitable for Phase 0.

Phase 0 still needs to settle the decisions below. Some affect execution correctness and data validity, so they are more than editorial polish. They can be addressed through the contracts and ADRs already required by the PRD; another architectural rewrite is unnecessary.

## R1 — Required oversight is not completed oversight

Priority: resolve before approving the evidence and execution contracts.
PRD: §§7A.7, 21, 23, 26.4. Backlog: P0-05, P0-06.

The new flow correctly distinguishes authority from oversight, but `post_execution required → execute + queue review` leaves an evidence representation gap. A queued review has not happened. AARF §5.2 defines `post_execution` as a review already performed; §5.1 requires truthful status at capture. Its restriction of `none` to Tier 3 leaves the pending Tier 2 case requiring explicit framework/SDK interpretation.

Proposed clarification:

> Operational records must distinguish `required_oversight`, `review_state`, and actual human-review facts. Queuing a review must never be represented as completed `post_execution` oversight. Phase 0 must approve how pending Tier 2 oversight maps to the existing SDK and linked records. If no truthful supported mapping is available, v1 must defer that execution mode. Existing signed records must not be edited to change their oversight status.

Do not invent an `AARF-0.3` schema or silently add an enum. Link later review evidence to the original action. Document unresolved SDK requirements as dependencies.

The earlier review also suggested a warning-only customer challenge could be Tier 3. That was too broad: AARF §5.3 describes Tier 3 as internal and non-customer-facing. The matrix must distinguish sandbox-only effects from an analogous real customer action. Low value alone does not establish Tier 3 for a release that affects an account balance.

Evidence: [AARF v0.3 §5](../../vendor/arbiris-sdk/docs/aarf.md#5--human-oversight).

## R2 — Authority denial does not disappear after human review

Priority: resolve before any simulated action is enabled.
PRD: §§21–23, 52. Backlog: P0-05, P0-06, P0-07.

The denied branch reaches human review, but its return path is unspecified. Human approval must not implicitly increase the investigator's authority. Define whether the reviewer authorizes a separate human-controlled executor or issues a narrowly scoped approval under an explicit policy. Re-evaluate authority, policy, context and the exact proposed action before execution. Bind approval to transaction version, action, amount/currency, relevant policy versions and expiry.

Phase 2 currently delivers actions while Phase 4 delivers the authority engine. This dependency error was also present in the earlier recommended roadmap.

Proposed sequencing:

> Phase 2 includes the minimal authority/oversight evaluator and execution guard for every enabled simulated action. If approval is required and no review workflow is available, record a durable pending state and execute nothing. Phase 4 adds the reviewer workflow and remaining authority capabilities.

Treat `PASS` as a recommendation/route and `RELEASE` as an action, not interchangeable action names.

## R3 — Preserve deterministic APP checks before fast release

Priority: resolve before approving routing semantics.
PRD: §§7.2–7.4, 10A.2, 17, 34. Backlog: P0-01, P0-05.

Sim B contains deterministic Stage 1 checks as well as an LLM stage. Its account-drain/new-payee, confirmation-of-payee mismatch and inbound/outbound rules cannot be moved entirely behind an ambiguous-ML branch. Low unauthorized-fraud probability does not establish low APP-scam risk.

Proposed clarification:

> Evaluate applicable deterministic Sim A and Sim B Stage 1 controls before any fast release. Missing critical APP evidence must follow an explicit policy and must not become a false/default safe signal. Only LLM-based investigation moves to the slow path. Document how APP concerns trigger investigation when the unauthorized-fraud score is low.

Also resolve scenario L: it currently expects an agent assessment for a high ML score although Phase 3 permits only ambiguous cases. Either make L genuinely ambiguous or define a separate, explicit investigation request for a held case that cannot bypass hard policy.

Characterisation records legacy behavior; it does not certify that behavior as the future specification. Keep legacy expectations and approved target changes separate, especially graph routes and oversight declarations.

Evidence: `stage1_prefilter` and `run_sim_b` in [sim_b.py](../../vendor/arbiris-sdk/examples/agents/fraud_compliance_agent_v2/nodes/sim_b.py).

## R4 — Training and live features need a feasibility gate

Priority: resolve before selecting the final feature contract and training corpus.
PRD: §§7A.2–7A.4, 8–11, 33. Backlog: P0-02, P0-03, P0-04.

The canonical schema cannot create data absent from a public corpus or Plaid payload. Require a feature-availability matrix across training data, historical replay, Plaid and synthetic scenarios. Represent missingness and timestamp precision explicitly. Do not reconstruct pre-transaction balances from a later balance snapshot or fabricate intra-day times for date-only records.

Plaid documents nullable authorization/posting datetimes and pending-to-posted transitions with different IDs. Define source revisions, ingestion/availability time, event time and pending/posted identity mapping. The simulator operates on a linked simulated payment; ingestion must not imply that a posted source transaction can actually be released or held. See [Plaid transaction fields](https://plaid.com/docs/api/products/transactions/) and [transaction states](https://plaid.com/docs/transactions/transactions-data/).

The training choice must resolve whether one compatible model can credibly score the live demo. If a public benchmark and the live simulator require different models/features, make their IDs, results and claims explicitly separate. Synthetic labels derived from Sim A rules are unsuitable as independent evidence of superiority to those rules.

## R5 — Make calibration, thresholds and latency measurable

Priority: resolve before Phase 1 implementation.
PRD: §§13–17, 31, 46–47. Backlog: P0-04, P0-09.

Replace “Calibration must be evaluated on validation data only” with:

> Fit the calibrator using temporally appropriate data disjoint from base-model fitting. Choose models and thresholds without using the final test set. Report final discrimination and calibration on the untouched temporal test set once the pipeline is frozen.

A disjoint calibration partition is supported by [scikit-learn calibration guidance](https://scikit-learn.org/stable/modules/calibration.html). Phase 0 must define the actual chronological partition policy and label-availability cutoffs; it must not treat future-resolved labels as available to historical training.

The illustrative single threshold `0.78` conflicts with the router's two boundaries `0.20`/`0.80`. Define the roles separately: evaluation threshold, low routing boundary, high routing boundary, raw versus calibrated score. Specify inclusive/exclusive boundaries and persist the exact routing policy version. A sensible proposed boundary convention is `p < low`, `low <= p < high`, `p >= high`; approval remains part of the router contract.

Specify whether the 20/50/100 ms percentiles measure model prediction alone or the full `/risk/score` request. Record hardware, concurrency, warmup, sample count, feature lookup, persistence and signing inclusion. Offline pack rendering is not part of synchronous scoring. Fix agent-eval release criteria before tuning the agent; no universal PR-AUC target is asserted before a corpus is selected.

## R6 — Define durability, replay and browser-disconnect semantics

Priority: resolve before Phase 2 persistence/actions.
PRD: §§33, 35, 37–39, 43. Backlog: P0-06, P0-07.

IDs alone do not guarantee idempotency. Define request-hash conflicts, duplicate in-flight processing, uniqueness of executed simulated actions, crash recovery and retries. A committed action followed by a failed evidence write must be reconciled without a second action or an invented successful record.

The last illustrative sequence still places action before PostgreSQL and evidence. Replace it with an agreed durable transition protocol covering intent/authorization, action commit, outcome evidence and reconciliation. If an outbox is chosen, explicitly distinguish operational facts awaiting evidence capture from signed AARF records; neither unsigned placeholders nor “exactly once across stores” should be claimed.

Decouple long-running processing from the lifetime of the SSE response. Define durable run states, accepted response/run ID, reconnection and whether a browser disconnect cancels anything. Historical replay creates a new analysis result and never executes payment actions.

## R7 — Close SDK field mapping and delivery ownership

Priority: resolve before approving the AARF integration contract.
PRD: §§26.5, 52, 55. Backlog: P0-06, P0-08, P0-10.

The conceptual mapping still lists `policy_reference` and `policy_version` as separate persisted fields. The decorator accepts that input style, but an AARF-0.2 record uses an array of `{policy_id, version, section}`. Document the adapter-input/persisted-output distinction and test it. Put correlation IDs, authority details and reason codes in supported signed structures or an approved extension, with round-trip tests proving they are not dropped.

Assign ownership: the fraud API owns operational facts and review execution; Arbiris owns signing, generic governance artifacts and pack assembly. Phase 0 specifies inventory and manifest integration plus missing SDK work, without reimplementing pack assembly in the fraud API. A generated signature from a demo identity must not be described as a real accountable-SMF attestation.

§52 and §55 should reference one delivery sequence. Basic CI and contract checks start with Phase 0 tests; Phase 6 hardens them. Verification and completeness contracts start now even if full pack delivery occurs later. Add the new authentication, inventory, oversight, concurrency and manifest requirements to §53 or its traceability matrix so they cannot be omitted from final acceptance.

## Recommended disposition

Proceed with the [Phase 0 backlog](phase-0-backlog.md). Resolve this register through the specified tasks. Approval to begin planning does not satisfy the exit gate and does not constitute governance approval. No production behavior, model, dependency pin or SDK schema was changed by this review.
