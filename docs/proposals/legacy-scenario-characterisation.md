# Legacy A–F scenario characterisation and target mapping

Status: **Proposed baseline — Phase 0 P0-01/P0-05; not a target-policy approval**  
Source: `apps/api/vendor/arbiris-sdk` example
`fraud_compliance_agent_v2/pipeline.py`  
Last updated: 2026-09-16

## Scope

The current API exposes six fixed, synthetic teaching scenarios, A–F, through
`GET /scenarios` and `POST /run/preset/{scenario_id}`. The pipeline runs Sim A
then Sim B for every case, optionally generates a counterfactual for Sim B
`HOLD`/`CHALLENGE`, and writes demo evidence output. It is an unauthenticated,
single-operator demo—not the target risk-service contract.

The table records facts visible in the current scenario definitions and labels.
It does **not** certify every node outcome. Characterisation tests must later
freeze deterministic provider responses and record actual route, counterfactual
and evidence behavior.

## Existing fixtures

| Legacy case | Current labelled intent / key facts | Candidate target relationship | Mapping status |
| --- | --- | --- | --- |
| A | High-risk Sim A `HOLD`, labelled score 100; £4,200 outbound transfer, online, US origin, velocity 3, 16% balance remaining; legacy history averages £210 | S02 high-risk hold | Candidate overlap; requires target deterministic-policy decision |
| B | Low-risk Sim A `PASS`, labelled score 0; £22 in-store food/drink, GB, 99% balance remaining | S01 trusted pass | Candidate overlap; lacks target source/revision and full eligibility facts |
| C | Near-threshold Sim A `PASS`, labelled score 63; £890 online travel payment, GB, velocity 1 | No direct S01–S08 equivalent | Retain as a boundary-characterisation case only until routing is approved |
| D | Sim B Stage 1 `S1-01 HOLD`; £2,800 new-payee online transfer, 8% balance remaining | S03 APP-drain hold | Candidate overlap; target APP policy and action semantics unresolved |
| E | Sim B Stage 2 `PASS`; £1,500 established-payee online transfer, 70% balance remaining | Possibly S01 trusted pass | Not equivalent until Sim A, source facts, provider reply, and target eligibility are characterised |
| F | Sim B Stage 1 `S1-03 HOLD`; £950 new-payee online transfer, 5% balance remaining, inbound credit within 2h | S03 APP-drain hold / mule-pattern variant | Candidate overlap; distinct typology should remain separately testable |

Amounts in the current example are floating-point GBP values. They are legacy
input facts, not an endorsement of the draft canonical money representation.

## Target scenario coverage

| Target ID | Required purpose | Existing coverage | Required Phase 0 work |
| --- | --- | --- | --- |
| S01 | Trusted pass | Partial candidates: B, possibly E | Define eligibility and deterministic expected result |
| S02 | High-risk hold | Partial candidate: A | Freeze controls/reason-code and recommendation semantics |
| S03 | APP-drain hold | Partial candidates: D and F | Preserve distinct drain/mule variants and define target policy |
| S04 | Ambiguous challenge/investigation | None | New deterministic fixture with fixed tool/provider responses |
| S05 | Provider/model outage hold | Demo toggle exists (`simulate_llm_outage`), no target fixture | Create an explicit fixture and redacted stable error/route expectations |
| S06 | Reviewer conflict/concurrency | None | New stateful fixture after review contract is specified |
| S07 | Idempotency/retry | None | New processing fixture after HTTP/idempotency contract is specified |
| S08 | Pending correction/replay | None | New source-event correction/replay fixture after canonical contract is specified |

## Known baseline gaps

- Legacy history contains amounts only; it has no event time, availability time,
  source revision, correction lineage, or account-scoped event identity.
- A–F have no canonical provider mapping or fixture manifest.
- The scenario labels are not a validated contract for downstream Sim B, route,
  counterfactual, record, or evidence outcome.
- `simulate_llm_outage` is a demo-only invocation flag, not a durable provider
  health or incident model.
- Current API presets expose only the legacy A–F IDs and no idempotency,
  authentication, reviewer version, or replay semantics.

## Characterisation-test plan

P0-01 should add isolated, no-network tests that capture for every A–F:

1. Sim A score/outcome and signal breakdown.
2. Sim B result under a fixed provider reply or rule path.
3. Graph route, counterfactual presence, emitted signed-record verification, and
   evidence-pack invocation/output.
4. Both SSE endpoints, invalid IDs, stable terminal event, and outage path.

Tests must distinguish observed legacy behavior from the approved target. A
passing legacy test never approves a risk rule or target scenario mapping.

## Promotion path

Once P0-02 through P0-05 decisions are accepted, create versioned fixture
manifests under `fixtures/`, add approved target mappings to the appropriate
contract/ADR, and keep the legacy cases only as compatibility-characterisation
fixtures where useful.
