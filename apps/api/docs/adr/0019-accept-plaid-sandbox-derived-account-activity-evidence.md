# ADR-019 — Accept a Plaid Sandbox-derived S04 account-activity evidence item

Status: Accepted  
Date: 2026-09-22  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3, Sections 7.1–7.4  
Backlog task: MVP 3 public-showcase fixture enrichment  
Related decisions: ADR-015, ADR-016, ADR-017, ADR-018  
Repository scope: `EvidenceItem.source_class`, `scenarios.v1.json` (1.1), the
public-showcase events contract, and both apps' generated types

## Context

ADR-018 accepted seven Plaid-derivation rules for S01/S02/S04. Building it
surfaced two things ADR-018 did not anticipate:

1. S01 and S02's `facts` are never read by the runtime. Their PASS/HOLD
   outcome comes from a hardcoded `scenario_id` lookup in
   `runtime.py`'s `_SKIPPED_SCENARIOS`, independent of `amount_minor`,
   `direction`, or `payee_history`. Deriving those facts from Plaid would
   change a value nothing consumes and nothing a viewer could ever see. This
   ADR does not pursue that part of ADR-018; those two scenarios' facts stay
   as originally accepted.
2. The one place a Plaid-derived value is genuinely visible — S04's
   `get_account_activity_evidence` tool, which had no accepted payload — sits
   behind a frozen contract. `EvidenceItem.source_class` is `Literal["synthetic_fixture"]`
   in `models.py` and `{"const": "synthetic_fixture"}` in the ADR-015-frozen
   `public-showcase-events.v1.schema.json`. Delivering Plaid-derived evidence
   under that label would misattribute its origin; delivering it without a
   contract change is impossible. ADR-018 authorised the derivation rule but
   not this contract amendment.

## Decision

Widen `EvidenceItem.source_class` to accept `"plaid_sandbox_derived"`
alongside `"synthetic_fixture"`, in both the Pydantic model and the frozen
event schema (kept at schema version `1.0`: this is an additive enum
widening of one field, not a reshaping of any event). Add one evidence item
for S04's `get_account_activity_evidence` tool, derived from a scripted local
Plaid Sandbox pull (`scripts/build_plaid_showcase_evidence.py`, authorised by
ADR-018's payee-history proxy rule), reduced to a safe aggregate fact with no
name or account identifier. Bump the fixture packet's internal `version` to
`1.1` and its `contains_provider_data` flag to `true`, paired with a new
required field `provider_data_environment: "plaid_sandbox_test_only"` that
must be present when, and only when, `contains_provider_data` is true.

`recorded_tool_sequence` for S04 is unchanged: exactly
`["get_payee_evidence", "get_device_session_evidence"]`, per ADR-016. The new
evidence is available to a live model choosing its own tool plan; it never
appears in recorded playback.

## Scope boundary

- S01 and S02's facts are not touched by this ADR and remain exactly as
  ADR-016 accepted them; ADR-018's rules for them are recorded but not acted
  on, since acting on them would have no observable effect.
- `data_label` stays the frozen constant `"synthetic"` for every event; this
  ADR does not touch it. The per-evidence-item `source_class` is the only
  place provenance is now visible, both in the API payload and in the web
  UI's evidence row (a "Plaid Sandbox test data" pill).
- Every other evidence item, and every other scenario, is untouched.
- `contains_provider_data: true` describes Plaid Sandbox test data only. It
  does not describe or permit real customer data, which
  `contains_customer_data: false` continues to forbid.
- This does not approve a live Plaid connector, a runtime Plaid credential in
  the public image, a fraud label, or a model feature. The derivation script
  is offline developer tooling; `server/` does not import it.

## Consequences

`fixtures.py`'s loader now accepts fixture packet versions `1.0` and `1.1`
and validates the paired `contains_provider_data`/`provider_data_environment`
fields. `showcase-types.ts` and `showcase-event-validation.ts` accept the
widened `source_class` on the web side. A future fixture change needs its own
version bump and review, per ADR-016's original policy.

## Verification

- `apps/api/tests/test_showcase_investigation_runtime.py`: the widened
  `EvidenceItem` Literal; a live run offering and using all three S04 tools
  once each has evidence; a scenario missing one tool's evidence still fails
  closed (`tool_failed`), independent of the real fixture's current content;
  the loader rejects an unrecognised version and rejects a provider-data flag
  without its required environment label.
- `apps/api/tests/test_f3_preparation_artifacts.py`: the recorded S04 script
  stays exactly its original two tools and their `synthetic_fixture` evidence;
  the new account-activity evidence is `plaid_sandbox_derived` and names
  "Plaid Sandbox" in its display text; the packet's version and provider-data
  fields match this decision.
- `apps/web/tests/showcase-investigation.spec.ts`: a live run with the new
  tool renders its evidence with a "Plaid Sandbox test data" label; the
  recorded S04 run shows neither the tool nor the label, confirming no
  leakage into the fixed recorded script.
- Verified against the real local API and a real Groq live run: the model
  chose `get_account_activity_evidence`, received the derived evidence, and
  the browser rendered it with the expected label.

## Acceptance record

Decision revision: working tree, 2026-09-22  
Approver: Darren Gidado (product owner)  
Approval date: 2026-09-22  
Approved scope: The widened `source_class` contract value, the one new S04
evidence item and its fixture/loader changes, and both apps' matching type
and test updates, as verified above.
