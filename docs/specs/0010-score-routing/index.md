# 0010. Score routing for rule cleared feed payments (F3)

**Date**: 2026-09-29
**Status**: Proposed

## Summary

Today every live feed payment is decided by its scenario's rule, and the model score from spec 0004 is only shown as evidence. This spec lets the score act, in one direction only: when the rules clear a payment (PASS), a high enough score raises it to CHALLENGE or HOLD, using two thresholds taken from how the model performs on Sparkov data. The rules stay first and are never relaxed. So the effect is visible, about 1 in 20 S01 feed payments becomes an unusually large payment that the rules still clear and the model catches, and the page says plainly that these are planted synthetic outliers.

## Requirements

**User stories**:
- As a demo viewer, I want to see the model catch a payment the rules cleared, so I can see where a model adds value on top of deterministic controls.
- As a demo viewer, I want every model raised decision to name its score and threshold, so I can see why it happened.
- As the project owner, I want the thresholds to come from measured Sparkov operating points and a written rule, so no number on the page is arbitrary.
- As the project owner, I want the rules to stay first and never be relaxed by the model, so a wrong score can only add review work.

**Acceptance criteria**:
- **AC-1**: At run start, every scheduled outbound feed payment stores its rule table decision as `rule_recommendation`. For S02 to S05 payments the final `recommendation` always equals it and `routed_by` is `rule`.
- **AC-2**: For a payment whose rule decision is PASS, when both the model (ADR-024) and the routing policy are loaded: the score rounded to 5 places (the stored `model_score`) at or above the HOLD threshold gives HOLD, at or above the CHALLENGE threshold gives CHALLENGE, otherwise PASS. Equal to a threshold counts as reaching it, so any decision can be rechecked from stored values. `routed_by` is `model` exactly when the final recommendation differs from the rule's; `routing_policy_version` is set on every payment the policy assessed.
- **AC-3**: The score never lowers a rule decision. A database check rejects any row with `routed_by = 'model'` unless `rule_recommendation = 'PASS'`, `model_score` is not null and `recommendation` is CHALLENGE or HOLD.
- **AC-4**: If the model is missing, the policy file is missing or invalid, its digest does not match the pinned constant, or its `model_version` differs from the loaded model, every payment gets its rule decision with `routed_by = 'rule'` and a null `routing_policy_version`, and the API logs warnings exactly once each: a missing or refused model keeps its existing single `sandbox_portable_model_unavailable` warning and logs no routing warning; a policy problem (missing, invalid, digest, or model version mismatch) logs `sandbox_score_routing_unavailable` once per process; a scoring fault keeps spec 0004's single `sandbox_portable_score_failed` per run start and leaves that payment on its rule decision. A feed never fails to start because of routing.
- **AC-5**: `apps/api/scripts/derive_score_routing_policy.py` (local only) rebuilds the Sparkov test partition exactly as the trainer does (`modelling.richer_features.load_raw_sparkov`, the same eight features, the partitions in `config/sandbox-portable-model.v1.json`), refuses to run if the raw files' SHA256 differ from the model manifest's `raw_sparkov_sha256`, scores every row with the server's own `PortableModel` rounded to 5 places, and writes `config/sandbox-score-routing.v1.json`. Candidate thresholds are the distinct rounded test scores; a candidate that flags no row is skipped; the top 0.1% threshold is the score of the row ranked `ceil(0.001 * n)` from the top. The rules: CHALLENGE is the lowest threshold where test precision is at least 0.50; HOLD is the lowest threshold where precision is at least 0.90, or, if precision never reaches 0.90, the score at the top 0.1% alert rate. The file records each threshold, the rule that produced it, the precision, recall and alert rate there, `policy_version` `score-routing-v1` and the `model_version`. The script fails if HOLD is not above CHALLENGE. The file is written with sorted keys and compact JSON (as the model manifest), and two runs write byte identical files. A published policy file is never edited: a new policy is a new file and version, and every shipped version stays in the package.
- **AC-6**: Within a run, the 10th, 30th, 50th and so on S01 payment, counted by S01's own order in that run (so the rule holds inside the Mixed feed, where payments are picked by overall position), is a synthetic outlier: amount = S01's typical amount times a seeded multiplier between 5 and 20, payee `payee_s01_recurring`, and `synthetic_outlier = true` stored on the scheduled payment when the schedule is built. Their rule decision stays PASS. On the current S01 dataset at least 8 in 10 outliers score at or above CHALLENGE and at least 95% of normal S01 payments stay below it; if not, the multiplier range is tuned and the new range recorded in this spec.
- **AC-7**: A model raised payment is saved as a feed case under the existing rules and caps (spec 0004 AC-4, AC-5). Its events validate against `public-showcase-events.v2`: `route_resolved` PASS and skipped, `investigation_skipped` `deterministic_clear_route`, and `run_result` with the final recommendation, `recommendation_basis` `model_threshold` and a `model_routing` object (score, both thresholds read from the policy version the payment stored, `rule_recommendation` PASS, `policy_version`, `model_version`, and `synthetic_outlier` from the stored column). The case row has `routed_by = 'model'` and `event_contract_version = '2'`. Every other case stays on v1 unchanged.
- **AC-8**: Contracts, each written as a complete JSON schema before its code: `docs/contracts/public-showcase-events.v2.schema.json` (events carry `schema_version` "2.0"; v1 untouched, Run showcase keeps emitting v1); `showcase-cases` v1.1 (list and case responses report `contract_version` "1.1"; summaries gain nullable `routed_by` (`rule`, `model` or null); a case's events validate against the version its `event_contract_version` names, chosen by a v1/v2 validator registry); `sandbox-simulation` v1.1 (each `recent` item gains nullable `routed_by` and `model_score`; the snapshot gains `raised_by_model` (integer, 0 or more) and `routing_policy`, which is `{version: string, challenge: number, hold: number}` or null whenever routing is off for any reason). Contract tests cover all three, and existing v1 cases still read and validate.
- **AC-9**: The routing board marks model routed payments in its "Last routed" line and lane lists (for example `#12 → HOLD · model 0.953`), shows "Raised by model: N" while the policy is on and "Score routing off" when it is off, and its rule note reads "Payments from S01 to S05, each decided by its own scenario's rule; the model can raise a payment the rules cleared."
- **AC-10**: The case drawer's Route stage for a model raised case reads "The rules cleared this payment. Its model score, 0.953, is at or above the HOLD threshold of 0.912 (policy score-routing-v1), so it was raised to HOLD." (with that case's values), and for a synthetic outlier adds "A synthetic outlier added to S01's feed to show the model catching what the rules cleared." The Model signal keeps its ADR-024 label.
- **AC-11**: The Cases table's Mode column reads "Live feed · raised by model" for a case with `routed_by = 'model'`. No new filter.
- **AC-12**: The "Recommendations over time" chart's overlay counts each feed payment's final recommendation, and its subtitle says rule cleared feed payments may be raised by the model. Imported payments keep their rule decisions and the decisions endpoint's base counts do not change.
- **AC-13**: The Risk Console guided tour gains one step pointing at "Raised by model", saying the rules clear a payment first, the model can still raise it, and the score comes from Sparkov synthetic data. The tour stays at seven steps or fewer.
- **AC-14**: The API image ships `config/sandbox-score-routing.v1.json`, and `scripts/verify_mvp3_deployment_config.py` fails if the Dockerfile or `.dockerignore` stops shipping it.

## Decision

**Chosen option**: Option 2: escalate rule cleared payments with two Sparkov derived thresholds, with planted S01 outliers so the effect shows.

The rule table decides first; the score may only raise a PASS to CHALLENGE or HOLD, and every such decision records its score, thresholds and policy version.

## Rationale

Reasoning and options: see [rationale.md](rationale.md). The governing record is ADR-025.

## Feature design

**Data model sketch** (migration `0008_score_routing.sql`, rerunnable, all new columns nullable or defaulted):

| Table | Column | Type | Null | Notes |
|---|---|---|---|---|
| `sandbox_simulation_events` | `rule_recommendation` | text | yes (rows before 0008) | CHECK PASS, CHALLENGE, HOLD |
| | `routed_by` | text | yes (rows before 0008) | CHECK `rule`, `model` |
| | `routing_policy_version` | text | yes | null when the policy did not assess the payment |
| | `synthetic_outlier` | boolean | no, default false | set when the schedule is built (AC-6) |
| | `recommendation_basis` check | | | replaced to also allow `model_threshold` |
| | check `score_routing_escalates_only` | | | `routed_by <> 'model' OR (rule_recommendation = 'PASS' AND model_score IS NOT NULL AND recommendation IN ('CHALLENGE','HOLD'))` |
| `showcase_cases` | `routed_by` | text | yes | CHECK null unless `origin = 'feed'` |
| | `event_contract_version` | text | no, default `'1'` | CHECK `'1'`, `'2'` |
| | `recommendation_basis` check | | | replaced to also allow `model_threshold` (0004 created it inline; 0008 drops the generated constraint by name and adds a named one) |

Rows before 0008 read as rule routed. The existing `recommendation` column holds the final outcome; `model_score`, `model_version`, `model_input_sha256` are unchanged (spec 0004).

**Routing policy file** (`config/sandbox-score-routing.v1.json`, generated, committed, SHA256 pinned in server code): `policy_version`, `model_version`, `thresholds.challenge` and `thresholds.hold` (each with `value`, `rule` (`precision_at_least_0.50`, `precision_at_least_0.90` or `top_0.1_percent_alert_rate`), `precision`, `recall`, `alert_rate`), `source` (Sparkov test partition, raw file SHA256s).

**State transitions**: none; a payment's routing is fixed at run start and never changes.

**API surface** (internal, `include_in_schema=False`, as today):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/sandbox/scenarios/{id}/simulation-runs` | POST | unchanged | unchanged; routing is written in the start transaction | browser header (spec 0003) | unchanged |
| `/sandbox/simulation-runs/{run_id}` and its stream | GET | unchanged | `routing_snapshot` gains `raised_by_model` (int) and `routing_policy` (`{version, challenge, hold}` or null); each `recent` item gains optional `routed_by`, `model_score` (sandbox-simulation v1.1) | owner only | unchanged |
| `/cases` | GET | unchanged | summaries gain optional `routed_by` (showcase-cases v1.1) | browser header | unchanged |
| `/cases/{case_id}` | GET | unchanged | events are v1 or v2 per the case's `event_contract_version` | browser header | unchanged |
| `/sandbox/scenarios/{id}/decisions` | GET | unchanged | overlay counts final recommendations; base unchanged | unchanged | unchanged |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Run start | `rule_recommendation` | the rule table (`server/sandbox_data/decisions.py`) |
| Run start | score | the ADR-024 model and features, computed as today |
| Run start | thresholds, `routing_policy_version` | the verified policy file |
| Run start | final `recommendation`, `routed_by` | AC-2 applied to the rule decision, score and thresholds |
| Schedule build | outlier amount and payee | AC-6: S01 typical amount 4200 times `5 + 15 * _unit(seed, "S01_outlier", sequence)`, payee `payee_s01_recurring` |
| Case save | `synthetic_outlier` | the payment's stored `synthetic_outlier` column |
| Case save | `model_routing` fields | the payment row plus the shipped policy file named by its `routing_policy_version` |
| Snapshot | `raised_by_model` | count of revealed payments with `routed_by = 'model'` |
| Snapshot | `routing_policy` | the loaded policy, or null when routing is off |
| Board | marker text and score | `recent[].routed_by`, `recent[].model_score`, mapped to the board's props |
| Board | count and on or off state | snapshot `raised_by_model` and `routing_policy`, mapped to new board props `raisedByModel`, `routingPolicy` |
| Drawer | Route story values | the case's v2 `run_result.model_routing` |
| Cases table | "raised by model" | summary `routed_by`, mapped to a new `ConsoleCaseRow.routedBy` field |

**Key invariants**:
- The rule table decides first; the score only raises a PASS, never lowers anything.
- Routing is fixed at run start and stored; nothing recomputes it later.
- Without a verified model and matching policy, behaviour is exactly spec 0004's.
- v1 event payloads are never changed; v2 is used only by model raised feed cases.
- A published routing policy file is never edited; each version stays shipped so any case can be explained later.
- Everything stays labelled synthetic; the score is described as Sparkov mechanics, never a fraud probability.

**Security model**: unchanged. Runs and cases are scoped to the owning browser (specs 0002, 0003); the public database guards (ADR-021) apply to the new columns. No personal data.

**Configuration required**: none new at runtime. The policy file is generated locally and committed.

**Critical test scenarios**:
- Happy path: an S01 run with the model and policy loaded raises its outliers and leaves normal payments PASS; the snapshot counts them; verifies **AC-2**, **AC-6**, **AC-9**.
- Never relax: S02 to S05 runs keep every rule decision whatever the score, and an insert breaking the check is refused; verifies **AC-1**, **AC-3**.
- Fallback: missing model, missing policy, tampered policy, mismatched `model_version`, and a scorer fault each give spec 0004 behaviour and one warning; verifies **AC-4**.
- Policy derivation: two script runs give identical files; a precision curve that never reaches 0.90 uses the alert rate rule; HOLD not above CHALLENGE fails; verifies **AC-5**.
- Case: a model raised payment saves a v2 case whose events validate; a rule case stays v1; verifies **AC-7**, **AC-8**.
- UI: board marker and count, drawer story and outlier note, table Mode text, chart subtitle, tour step, with and without the policy; verifies **AC-9** to **AC-13**.
- Image: the policy file is in the built image; verifies **AC-14**.

## Build plan

Build approach: Tracer Bullet (from `docs/scope/scope.md`): the first slice runs one thin path from the policy file to a visible board marker, then later slices thicken it.

**Slice 1: a model raised payment appears on the board**
1. `derive_score_routing_policy.py`, run it, commit `config/sandbox-score-routing.v1.json`; satisfies **AC-5**.
2. Migration `0008_score_routing.sql` as sketched, including both replaced `recommendation_basis` checks; satisfies **AC-1**, **AC-3**, **AC-6**.
3. Policy loader in `server/sandbox_model/` (pinned SHA256, model version match, cached once per process, one warning); satisfies **AC-4**.
4. S01 outliers counted by S01's own order in both `build_scenario_schedule` and `build_mixed_schedule`, stored as `synthetic_outlier`, tuned and checked against the current dataset; satisfies **AC-6**.
5. Routing at run start: store `rule_recommendation`, final `recommendation`, `routed_by`, `routing_policy_version`; satisfies **AC-1**, **AC-2**.
6. Snapshot fields (sandbox-simulation v1.1) and the board marker, count and rule note; satisfies **AC-8**, **AC-9**.

**Slice 2: the model raised case tells its story**
7. Write the complete v2 events, showcase-cases v1.1 and sandbox-simulation v1.1 schemas first; then the v1/v2 validator registry keyed by `event_contract_version`, Pydantic response models accepting `model_threshold` and the new fields, the feed case builder emitting v2 for model raised payments, `event_contract_version` and `routed_by` on case rows, and tests that old v1 cases still read; satisfies **AC-7**, **AC-8**.
8. Drawer Route story and outlier note; Cases table Mode text; satisfies **AC-10**, **AC-11**.

**Slice 3: finish the surface**
9. Chart subtitle; tour step; satisfies **AC-12**, **AC-13**.
10. Dockerfile, `.dockerignore` and deployment verifier ship the policy file; satisfies **AC-14**.
11. API and Playwright tests for every critical scenario; contract tests; `verify.md`; satisfies **AC-1** to **AC-14**.

## Consequences

**Positive**:
- The demo shows the core fraud engine story: deterministic controls first, a model catching what they miss, every decision explained.
- Thresholds have measured evidence behind them and a written rule anyone can rerun.
- Safe by construction: the database refuses a relaxed decision, and a broken model or policy falls back to today's behaviour.

**Negative / tradeoffs**:
- The outliers are planted. The page says so, but the model catching them proves mechanics, not fraud detection.
- Sparkov to Sandbox domain shift remains (dollars versus pounds, people versus scenario datasets); thresholds measured on Sparkov are not calibrated for Sandbox payments.
- Three contract versions move at once (events v2, cases v1.1, simulation v1.1), and the web app must handle two event versions.
- More feed cases per S01 run (about 10 per 200 payments), which compete for the 20 feed case cap.

**Neutral**:
- One migration, one generated config file, one new local script.
- Spec 0003's S01 schedule and spec 0004's "rule table is the only decider" line are amended by ADR-025.

## Follow-up

- [x] Cross check (Codex, 2026-09-29): nine findings; fixes applied for the Mixed feed outlier rule, stored outlier flag, policy immutability, rounding and ties, policy script inputs, the basis checks and validator registry, contract shapes, web wiring and warnings.

- [ ] Accept ADR-025 before building (owner).
- [ ] Add a scope row for F3 (or build straight from this spec).
- [ ] After build: amend spec 0003 (S01 schedule) and spec 0004 (decider wording), and update `apps/api/AGENTS.md`'s decider rule.
