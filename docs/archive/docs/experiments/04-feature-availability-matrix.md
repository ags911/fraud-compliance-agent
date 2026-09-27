# Experiment 04 — Feature availability matrix

Status: **Proposal prepared — review pending**  
Notebook: [04-feature-availability-matrix.ipynb](../../notebooks/04-feature-availability-matrix.ipynb)
Decision supported: P0-03/P0-04 — feature eligibility decision

## Run context

- Date/time (UTC): 2026-09-17
- Git revision: Uncommitted workspace
- Approved configuration/data revision: Not yet available
- Data class: Sanitised evidence only; no raw provider records, identifiers, secrets, or model artifacts in Git

## Inputs and gate

- `docs/proposals/canonical-transaction-contract.proposed.md`
- `docs/proposals/legacy-scenario-characterisation.md`

The source and scenario evidence is present. The resulting matrix remains a
proposal and does not approve an online feature set.

## Findings

- A sanitised cross-source matrix is available at
  `docs/proposals/feature-availability.proposed.json`.
- Category has provisional offline schema overlap across Plaid and Sparkov.
- No candidate is point-in-time safe or approved for online scoring.

## Limitations and unknowns

- Date-only Plaid timing, no `available_at`, unresolved canonical money, and
  source-specific customer/card references block velocity and history features.
- Sparkov labels are simulated and have unknown maturity/availability semantics.

## Sanitised artifact

`docs/proposals/feature-availability.proposed.json`

## Proposed next decision

Review the exclusions and explicitly approve, defer, or reject each proposed
feature before any enrichment or model work.
