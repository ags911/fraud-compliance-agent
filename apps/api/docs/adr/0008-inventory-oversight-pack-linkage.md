# ADR-008 — Define inventory, oversight linkage and evidence-pack boundaries

Status: Proposed  
Date: 2026-09-20  
Owner: SDK/governance owner (unassigned)  
PRD revision/sections: Candidate v0.3, Sections 5–6 and 11  
Backlog task: P0-06  
Related decisions: ADR-006 and ADR-007  
Repository scope: Governance linkage; no pack assembly

## Context and decision to be made

Required oversight, queued review and completed human review are distinct.
Current SDK representations cannot be extended by inventing an enum or schema
version. The fraud application also must not absorb generic inventory and pack
assembly responsibilities.

## Options considered

| Option | Benefits | Costs / limitations |
| --- | --- | --- |
| Record pending review as completed post-execution oversight | Fits an existing value | False statement; rejected |
| Invent an SDK enum locally | Expressive | Incompatible unsigned schema fork; rejected |
| Link immutable operational review facts to supported signed records and defer unsupported execution modes | Truthful and compatible | May reduce enabled scope |

## Proposed decision

Represent required oversight, review lifecycle and actual reviewer decisions as
separate operational facts. Link completed review evidence to the original
transaction/run/action without rewriting signed history. Defer any execution
mode that cannot be represented truthfully by the accepted SDK contract.
Arbiris owns agent inventory, completeness manifests, evidence-pack assembly,
verification and retrieval; this app retains only operational linkage/delivery.

## Contracts and invariants

- Queued or required review is never recorded as completed oversight.
- Reviewer identity, timestamps, decision, version and relationship are
  immutable evidence facts once submitted.
- Missing/excluded pack members remain explicit; completeness is not inferred.
- No project-owner demo approval is presented as a regulated-firm attestation.

## Verification and consequences

Future fixtures cover pending review, completed review, missing evidence,
tampered signature, unsupported SDK field and manifest omission. Critical SDK
gaps block the affected execution mode or require approved scope reduction.

## Open questions and acceptance record

Pending Tier-2 representation, inventory interface, manifest contract and
attestation ownership remain open. Approvers: SDK/governance and product/risk
owners, unassigned. Approval: pending.
