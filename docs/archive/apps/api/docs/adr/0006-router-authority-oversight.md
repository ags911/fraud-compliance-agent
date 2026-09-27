# ADR-006 — Define routing, authority and oversight

Status: Proposed  
Date: 2026-09-20  
Owner: Risk/engineering owner (unassigned)  
PRD revision/sections: Candidate v0.3, Sections 5–6 and 8  
Backlog task: P0-05  
Related decisions: ADR-004, ADR-005, ADR-008, ADR-010 and ADR-014  
Repository scope: Deterministic controls, recommendation, authority and review

## Context and decision to be made

The target must keep deterministic fraud/APP controls ahead of model-assisted
assessment and distinguish recommendation, authority, oversight, review and
action. A low model score cannot bypass a hard control, and queued review cannot
be recorded as completed oversight.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Let the model choose the route | Simple | Violates non-authority and hard-control boundaries; rejected |
| Combine route and action enums | Fewer states | Makes `PASS` look like `RELEASE`; rejected |
| Separate controls, recommendation, authority, oversight, review and simulated action | Truthful and auditable | More explicit state and tests |

## Proposed decision

Run applicable deterministic fraud and APP controls before model routing.
Represent `PASS`, `CHALLENGE` and `HOLD` as recommendations only. Evaluate
authority and oversight independently before any simulated action. If required
review is unavailable, remain pending and execute nothing. Revalidate approved
action, transaction revision, amount/currency, policy and expiry before action.

## Contracts and invariants

- Hard HOLD cannot be bypassed by model or investigation output.
- Missing critical APP evidence follows an explicit fail-safe policy.
- Approval never expands investigator authority implicitly.
- Pending review is not completed oversight.
- Thresholds and inclusive boundaries are accepted policy versions, not code
  defaults.

## Verification and consequences

The route truth table must cover low-model/high-APP, hard HOLD/agent PASS,
boundary scores, unknown policy, non-GBP authority, expired/changed approval and
reviewer override limits. S01–S05 cannot become accepted until this table is
approved.

ADR-014 fixes only public-showcase eligibility: S04 is the normal agent path and
S05 its incomplete/failure path; every other S01–S08 scenario bypasses the
agent. It does not accept their fixture values or decide any route, threshold,
authority or fallback result in this ADR.

### Accepted routing precedence

The product owner accepted this precedence on 2026-09-20. It resolves ordering,
not the remaining policy values:

| Condition | Recommendation/state | Investigation | Showcase action |
| --- | --- | --- | --- |
| Invalid input or unknown/missing policy | Incomplete assessment with fail-safe HOLD recommendation | Not called | None |
| Hard deterministic fraud or APP control | HOLD recommendation | Not called; emit an explicit `investigation_skipped` trace reason | None |
| Clear low-risk deterministic result | PASS recommendation | Not called; emit an explicit `investigation_skipped` trace reason | None |
| Approved ambiguous route (S04) | Pending bounded investigation, then a typed recommendation | Called with at least two distinct read-only evidence-tool calls | None |
| Deterministic outage fixture (S05) | Incomplete/failed investigation with fail-safe HOLD recommendation | Failure is injected without an external provider call | None |
| Valid agent recommendation | Preserved separately from authority outcome | Complete only after schema/evidence validation | None; deterministic authority remains outside the graph |

The skip event is part of the safety explanation: it shows that the agent was
deliberately unnecessary, not missing. The exact event schema remains a D7 and
contract decision.

For the bounded showcase, S04 may make no more than three tool calls and may
call each allowlisted tool at most once. Budget exhaustion cannot be treated as
a valid agent recommendation or completed investigation.

Provider unavailable, tool failure, invalid output, timeout and tool-budget
exhaustion all leave `investigation_status=incomplete`, attach a fail-safe HOLD
recommendation, leave authority `not_evaluated`, and execute no action. The
failure reason is a stable redacted category rather than a provider exception.

### MVP 3 model-score disposition

The product owner decided on 2026-09-20 that the public investigation has no
numeric runtime fraud-model score or decision threshold. Scenario eligibility
comes from accepted deterministic synthetic fixtures. Sparkov remains
mechanics-only evaluation evidence and cannot supply a runtime score or route.

Model target, corpus, feature schema, calibration, threshold policy, release
criteria and rollback are deferred to F3a. Until that gate is accepted, the
MVP 3 contract omits a runtime score or represents it as unavailable; it never
uses a fabricated numeric placeholder.

## Open questions and acceptance record

Exact later operational rules and threshold boundaries, non-GBP handling,
authority matrix, approval expiry, reviewer limits, oversight representation
and action tiers remain open. MVP 3's no-score/no-threshold boundary and the
routing precedence above are accepted, but the ADR as a whole remains Proposed.
Approvers: product/risk, technical and governance reviewers, unassigned.
Approval: pending.
