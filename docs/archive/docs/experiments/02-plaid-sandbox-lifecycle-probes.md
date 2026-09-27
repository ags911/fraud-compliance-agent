# Experiment 02 — Plaid Sandbox lifecycle probes

Status: **Completed source observation — lifecycle semantics pending ADR-003 review**  
Notebook: [02-plaid-sandbox-lifecycle-probes.ipynb](../../notebooks/02-plaid-sandbox-lifecycle-probes.ipynb)
Decision supported: P0-03 / ADR-003 — source revision, correction, and replay semantics

## Run context

- Date/time (UTC): 2026-09-16T15:44:19Z
- Git revision: `uncommitted-or-unavailable` (the monorepo has no initial commit yet)
- Approved configuration/data revision: Plaid Sandbox only; not an approved production source
- Data class: Sanitised evidence only; no raw provider records, identifiers, secrets, or model artifacts in Git

## Inputs and gate

- `docs/proposals/plaid-source-inventory.observation.json`

The required source-inventory evidence was present. This run remains observation
only; it does not accept correction, replay, or production semantics.

## Findings

- Initial Transactions Sync reached `HISTORICAL_UPDATE_COMPLETE` in 15.14 seconds across five pages, including one safe pagination restart.
- The isolated custom transaction was not returned in the bounded post-create Sync window, so added, modified, and removed remain indeterminate for this latest run.
- Pending transactions were present. No pending-to-posted link was observed in this run.
- Two reads from the same saved cursor produced the same sanitised page shape.
- Missing transaction IDs and account mismatches were not observed in the bounded sample.

## Limitations and unknowns

- An unobserved state is `indeterminate`, not evidence it cannot occur.
- The dynamic Sandbox source can change multiple records during a probe. Counts are lifecycle evidence, not a one-to-one attribution to the custom transaction.
- Sandbox results do not establish production freshness, correction, or webhook behaviour.

## Sanitised artifact

`docs/proposals/plaid-lifecycle-probes.observation.json`  
SHA-256: `e09db51fc04ebe0fe5861c7de55c234e2a49c57e159de170bb08ae01e0729ab2`

## Proposed next decision

Proposed: use the observed/indeterminate table as input to ADR-003. Do not
promote it to canonical correction semantics until that review is complete.
