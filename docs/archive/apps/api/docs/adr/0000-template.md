# ADR-NNN — <decision title>

Status: Proposed
Date: <YYYY-MM-DD>
Owner: <role and name when assigned>
PRD revision/sections: <exact revision and sections>
Backlog task: <P0-ID>
Related decisions: <links>
Repository scope: <API / SDK / frontend>

## Context and evidence

Describe the concrete problem and the behavior at stake. Cite relevant PRD, source paths/commit IDs, normative framework sections and official provider documentation. Distinguish observed implementation, proposed requirements and assumptions.

## Decision to be made

State the precise question and what depends on its answer. Identify required approvals already established by the PRD, rather than inventing additional approval gates.

## Constraints

List applicable product, data, privacy, performance and authority constraints. Distinguish AARF framework requirements from firm policy, SDK implementation limits and independently verified legal requirements. Do not infer legal compliance from schema validation or a signature.

## Options considered

| Option | Benefits | Costs/limitations | Supporting evidence |
|---|---|---|---|
| <A> | <...> | <...> | <...> |
| <B> | <...> | <...> | <...> |

## Proposed decision

State the selected option, its rationale and exact semantics. Use valid examples and explicit boundaries. Identify behavior deferred because it cannot yet be represented or enforced safely. Do not silently broaden scope.

## Contracts and invariants

Specify inputs, outputs, identities, timestamps, versions, authority, side effects and error categories. For stateful decisions, specify transition/commit boundaries, retries, concurrent requests and replay behavior. For evidence decisions, specify signed versus operational fields and linked artifacts.

## Verification

| Case/invariant | Input or trigger | Expected result | Verification method | Phase |
|---|---|---|---|---|
| <...> | <...> | <...> | <fixture/test/review and command where available> | <...> |

Record actual command results separately from future expectations. Include failure paths that could falsify the proposed decision.

## Consequences and ownership

Identify affected repositories, compatibility impact, implementation phase, any upstream dependency and the owner who must deliver it. Describe migration and rollback/supersession without rewriting signed history.

## Open questions

For each unresolved item, state the needed evidence or decision, its owner and whether it blocks acceptance. An empty list is appropriate only after the questions have been resolved.

## Acceptance record

Decision revision: <commit/hash or version>
Approver(s): <not yet approved>
Approval date: <pending>
Approved scope: <pending>
Supporting artifacts/test results: <links>

An author or coding agent proposing the ADR must not fill in approval on someone else's behalf. If the decision changes, obtain acceptance for the new revision and preserve the prior record.
