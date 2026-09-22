# ADR-018 — Accept Plaid Sandbox-derived showcase fixture enrichment rules

Status: Accepted for the narrow showcase-fixture boundary described below.
Superseded in part by [ADR-019](0019-accept-plaid-sandbox-derived-account-activity-evidence.md)
(2026-09-22): building this ADR found that rules 1–6 for S01/S02 (Option A,
money, direction, payee-history, timing, scope) apply to `facts` fields the
runtime never reads for those two scenarios, so acting on them would change
nothing observable. Only rule 6's S04 account-activity selection was carried
forward, via a contract change ADR-019 records. The S01/S02 rules are kept
here as a record of the decision, not as a live plan.  
Date: 2026-09-22  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3, Sections 7.1–7.4  
Backlog task: MVP 3 public-showcase fixture enrichment  
Related decisions: ADR-003, ADR-016, ADR-017  
Repository scope: Derivation rules for S01–S05 fixture facts only

## Context

[`plaid-sandbox-showcase-fixtures.proposed.md`](../../../../docs/proposals/plaid-sandbox-showcase-fixtures.proposed.md)
proposed replacing some of the hand-written S01–S05 facts with facts derived
from Plaid Sandbox data, recorded and sanitised offline, never called live by
the running showcase. ADR-003 remains the broader, unaccepted proposal for a
future runtime Plaid connector; this decision does not touch it, does not
authorise a connector, and does not widen the accepted mapping's
`accepted_for_sandbox_analysis_only` scope.

Alternative training corpora (PaySim, IEEE-CIS) were evaluated separately and
are recorded as not pursued; Sparkov remains the training/benchmark corpus.
This decision concerns showcase-fixture facts only, and has no bearing on
model training.

## Decision

Accept Option A (hybrid, recorded and sanitised) from the proposal, and accept
the following derivation rules for a future `scenarios.v2` fixture packet.
None of these rules is itself a runtime change; they govern how a future local,
zero-retention derivation script may transform Sandbox output before it is
committed.

1. **Money.** `amount_minor = round(amount * 100)`, assuming a 2-decimal
   currency. `currency` is Plaid's `iso_currency_code`, used unconverted and
   unrelabelled — a Sandbox test account returning `USD` produces a fixture
   fact labelled `USD`, not a relabelled `GBP`.
2. **Direction.** A positive `amount` is `outbound` (money leaving the
   account); a negative `amount` is `inbound`, matching the wording already
   recorded in `plaid-to-canonical-mapping.proposed.json`.
3. **Payee-history proxy.** No merchant name or counterparty identifier is
   ever persisted in a fixture. Only the existing `payee_history` enum
   (`"established"` or `"new"`) may be derived, from whether a pseudonymised
   counterparty identifier repeats more than once in the pulled window.
4. **Timing.** Plaid's date-only granularity is accepted as sufficient; no
   S01–S05 fact requires a time of day.
5. **Scope boundary.** The accepted mapping's scope
   (`/transactions/sync` added transactions only) is not extended. A balance
   endpoint is out of scope. `balance_state` for S03 is not Plaid-derived by
   this decision and stays synthetic.
6. **Scenario selection.** Only S01, S02, and the S04 account-activity
   evidence section may be Plaid-derived under this decision. S03 stays fully
   synthetic per (5). S05 is never Plaid-derived: it is an injected,
   provider-independent failure by design.

## Scope boundary

- This ADR accepts derivation *rules*, not a fixture version. No
  `scenarios.v2` file exists yet, and none is authorised to be consumed by the
  showcase runtime until it is produced, tested, and accepted in a follow-up
  change alongside the implementation plan update ADR-016's own sequence
  requires.
- The public showcase runtime remains database-free and must never hold a
  Plaid credential; all Sandbox access stays local and offline, matching the
  boundary ADR-003 already states.
- Every derived fact must carry a `plaid_sandbox_derived` source class,
  distinct from `synthetic`, so the UI can label which is which. A fact this
  ADR does not name (device, session, outage, review, replay signals, and
  every S03/S05 fact) stays `synthetic`.
- This ADR does not approve a Plaid runtime connector, a demo dependency on
  Plaid, a fraud label, a model feature, or any change to the dashboard's
  mock portfolio figures.

## Consequences

A follow-up change may now: run a local, zero-retention notebook against
Doppler-held Sandbox credentials; write a sanitised, checksummed derivation
artifact under `docs/proposals/`; and add a versioned `scenarios.v2` fixture
packet with contract and sanitisation tests written first, alongside UI label
and Explain-preview updates naming each fact's source. That follow-up change
requires its own review and its own update to the implementation plan; it is
not authorised by this ADR alone.

## Verification

A future fixture/contract test must assert: every Plaid-derived fact carries
`source_class: "plaid_sandbox_derived"`; no fixture value is a raw merchant
name, counterparty identifier, or unconverted currency amount; `currency` is
never silently forced to a value Sandbox did not return; and S03/S05 facts
remain `synthetic`.

## Acceptance record

Decision revision: working tree, 2026-09-22  
Approver: Darren Gidado (product owner)  
Approval date: 2026-09-22  
Approved scope: The seven derivation rules above, for a future S01/S02/S04
Plaid-derived fixture packet only. No fixture, contract, or runtime file is
changed by this ADR.
