# Experiment 03 — Plaid-to-canonical mapping

Status: **Proposal execution complete — review pending**  
Notebook: [03-plaid-to-canonical-mapping.ipynb](../../notebooks/03-plaid-to-canonical-mapping.ipynb)
Decision supported: P0-03 — proposed mapping review

## Run context

- Date/time (UTC): 2026-09-17
- Git revision: Uncommitted workspace
- Approved configuration/data revision: Not yet available
- Data class: Sanitised evidence only; no raw provider records, identifiers, secrets, or model artifacts in Git

## Inputs and gate

- `docs/proposals/plaid-source-inventory.observation.json`
- `docs/proposals/plaid-lifecycle-probes.observation.json`
- `docs/proposals/canonical-transaction-contract.proposed.md`

The source evidence is present. The mapping remains proposed and may not be
treated as an accepted API contract or a production connector.

## Findings

- A sanitised mapping proposal is available at
  `docs/proposals/plaid-to-canonical-mapping.proposed.json`.
- The executed notebook validates 15 field mappings, their allowed
  classifications, required timing/money/direction blockers, and a sanitised
  candidate fixture manifest.
- The manifest contains one explicitly synthetic draft-shape fixture plus two
  blocker fixtures for date-only timing and unresolved money/direction
  semantics. It contains no provider payloads or identifiers.
- Transaction, account, currency, payment-channel, category, and location
  country observations are recorded with their source paths.
- A semantic audit corrected the proposal: Plaid `transaction_id` is retained
  only as provider-boundary lineage for a derived
  `provider_transaction_reference`; it is not relabelled as a source event ID.
  A source event ID is a separate internal ingestion-boundary identifier.
- Exact event time, `available_at`, source revision, money normalisation,
  category normalisation, country meaning, correction semantics, and the
  approved direction policy remain explicit blockers or candidate derivations.

## Limitations and unknowns

- The Sandbox inventory observed date precision only; exact transaction times
  were null in the bounded run.
- The lifecycle probe did not establish modification/removal or pending-to-posted
  linkage semantics.
- A `/transactions/sync` cursor is a page-level checkpoint, not a
  per-transaction revision. It must not populate `SourceEvent.source_revision`.
- Plaid `date` means occurrence date for pending transactions and posting date
  for posted transactions; it must not silently populate a uniform canonical
  event-time field.
- Plaid `location.country` describes merchant location when available, not a
  generic account, customer, or payment-origin country.
- The proposed mapping has no approval, runtime consumer, or model implication.

## Sanitised artifact

`docs/proposals/plaid-to-canonical-mapping.proposed.json`

`docs/proposals/plaid-canonical-fixture-manifest.proposed.json`  
SHA-256: `49c7b9bdade472a2f6ca2df7aed8ab995393a5503a61f247cbe61232fd1a6ea9`

## Proposed next decision

Review the mapping and decide whether to resolve or exclude the blocked fields
before promoting any portion to a versioned contract. Completion of this
proposal does not approve a Plaid connector, feature set, or model work.
