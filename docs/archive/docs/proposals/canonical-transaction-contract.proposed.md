# Draft canonical transaction contract

Status: **Proposed — Phase 0 P0-02; not a runtime or API contract**  
Owner: Backend/data lead (to assign)  
Version: `0.1-draft`  
Last updated: 2026-09-16

## Purpose and boundary

This draft separates source facts, canonical transaction facts, derived
features, predictions, and operational outcomes. It is the proposed common
language for Plaid mapping, deterministic fixtures, API contracts, model work,
and console rendering.

It does not define risk thresholds, routing, model behaviour, authority,
oversight, review decisions, or payment actions. Those require their own
approved Phase 0 decisions.

## Canonical entities

| Entity | Role | Must not contain |
| --- | --- | --- |
| `SourceEvent` | Immutable observation from a provider or synthetic generator | Derived risk features or operational outcome |
| `CanonicalTransaction` | Normalised point-in-time payment fact | Model label, recommendation, reviewer decision, executed action |
| `FeatureSnapshot` | Versioned features derived from eligible facts as known at a cutoff | Future facts or labels |
| `Prediction` | Model/rule output tied to a snapshot and versions | Authority, oversight, or executed-action claim |
| `RunContext` | Correlation, replay and idempotency metadata | Untrusted customer context treated as evidence |
| `OutcomeLabel` | Later truth/disposition observation, distinct from recommendation | Online feature input |

## Proposed `SourceEvent`

```json
{
  "schema_version": "0.1-draft",
  "source_event_id": "internal immutable source-observation identifier",
  "source_system": "plaid_sandbox | synthetic | other-approved-source",
  "provider_transaction_reference": "keyed pseudonym of the provider transaction identifier",
  "source_revision": "opaque per-record provider revision when one exists",
  "sync_cursor": "opaque page-level provider checkpoint when applicable",
  "event_type": "source_observed | source_modified | source_removed",
  "observed_at": "2026-09-16T10:30:00Z",
  "available_at": "2026-09-16T10:31:02Z",
  "event_time": "2026-09-16T10:29:41Z",
  "event_time_precision": "second",
  "correction_of_source_event_id": null,
  "payload_reference": "secure external reference or sanitised fixture ID"
}
```

`source_event_id` is created by the approved ingestion boundary. It is not a
provider's transaction identifier. Raw provider identifiers remain at that
boundary; `provider_transaction_reference` is a keyed pseudonym used only for
approved lineage and reconciliation.

`source_revision` is populated only when a provider supplies a revision for an
individual record. A sync cursor is a page-level checkpoint, not a transaction
revision, and belongs in `sync_cursor` when it is retained. `observed_at` is
the time represented by the source event; `available_at` is
when the system could have known it. Both are required to prevent future-data
leakage. Date-only provider values use `event_time_precision: "date"`; they do
not supply a fabricated hour/minute for velocity or time-of-day features.

## Proposed `CanonicalTransaction`

```json
{
  "schema_version": "0.1-draft",
  "transaction_id": "internal immutable identifier",
  "source_event_id": "source event identifier",
  "provider_transaction_reference": "pseudonymised provider transaction lineage",
  "source_revision": "opaque source revision",
  "correction_of_transaction_id": null,
  "customer_reference": "pseudonymised stable reference",
  "account_reference": "pseudonymised stable reference",
  "payee_reference": null,
  "event_time": "2026-09-16T10:29:41Z",
  "event_time_precision": "second",
  "available_at": "2026-09-16T10:31:02Z",
  "money": {
    "amount_minor": 420000,
    "currency": "GBP"
  },
  "direction": "outbound",
  "payment_channel": "online",
  "country_code": "GB",
  "category": "TRANSFER_OUT",
  "field_availability": {
    "payee_reference": "unavailable",
    "country_code": "observed"
  }
}
```

### Required invariants

- `transaction_id` is an internal immutable ID. A source ID is never assumed
  globally unique or stable across corrections.
- `source_event_id`, `source_system`, `provider_transaction_reference`, and an
  applicable `source_revision` preserve lineage. A correction links to its
  predecessor; it does not overwrite the prior fact.
- References are pseudonymised before persistence beyond the approved source
  boundary. Raw provider customer/account identifiers are not API payloads or
  Git fixtures.
- Money uses integer minor units plus ISO 4217 currency. Floating-point money
  values are rejected at the canonical boundary. `amount_minor` is non-negative;
  economic direction is expressed by `direction`, not a signed amount.
- Currency conversion is not implicit. Any cross-currency rule, authority
  threshold, or aggregate requires an approved conversion source, timestamp,
  and rounding policy.
- `event_time`, `available_at`, and their precision are required. An unknown
  time is represented as unknown/date precision, never as a guessed timestamp.
- `field_availability` distinguishes `observed`, `derivable`, `unavailable`,
  and `simulated`; absent data is never silently coerced to `false`, `0`, or an
  empty string.
- Categorical values use approved enumerations. This draft intentionally does
  not freeze their complete value sets before Plaid/corpus feasibility work.

## Proposed derived and outcome boundaries

`FeatureSnapshot` records: `feature_schema_version`, ordered feature names and
types, `as_of`, eligible source-event references, unknown/imputed state, and a
canonical snapshot hash. It is derived only from events whose `available_at` is
at or before `as_of`.

`Prediction` records the snapshot hash plus the approved deterministic policy
and model versions. It may express a recommendation only; it cannot express an
executed payment action.

`OutcomeLabel` records later fraud truth, investigation result, or reviewer
disposition with a label-availability time and provenance. It is not included in
online features or inferred from an operational release.

`RunContext` must carry a caller-supplied idempotency key for any future
state-changing processing request, a correlation ID, and replay mode. The exact
HTTP semantics belong in the future accepted OpenAPI contract.

## Validation examples for P0-09

| Case | Expected draft outcome |
| --- | --- |
| Valid outbound GBP transaction with exact event time | Accepted |
| Missing source revision or availability time | Rejected |
| Date-only source value used for a 6-hour velocity feature | Feature unavailable; no fabricated precision |
| Negative or floating-point canonical money | Rejected |
| Unknown country or payee | Accepted with explicit availability state |
| Non-finite amount or malformed ISO timestamp | Rejected |
| Correction without predecessor linkage | Rejected |
| GBP threshold applied to non-GBP fact without approved conversion | Rejected/unsupported |
| Reviewer outcome supplied as a feature | Rejected |

## Open decisions required before acceptance

1. Canonical field names and approved categorical enumerations.
2. Exact provider event/revision/correction mapping, including pending-to-posted
   behaviour and date-only timestamps (P0-03).
3. Whether source payload retention is required and its secure storage/retention
   policy.
4. Feature catalogue, unknown/imputation ownership, and snapshot hashing
   algorithm.
5. Label taxonomy, maturity horizon, and corpus/training split policy (P0-04).
6. HTTP envelopes, idempotency responses, SSE events, and error categories.

## Acceptance path

After P0-03 through P0-08 resolve the open decisions, split this document into
versioned accepted artifacts under `docs/contracts/` (canonical transaction,
feature snapshot, HTTP/OpenAPI, and events as appropriate), add ADR-002, then
implement the P0-09 validation and consumer tests.
