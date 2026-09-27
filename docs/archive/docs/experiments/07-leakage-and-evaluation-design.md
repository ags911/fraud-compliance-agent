# Experiment 07 — Leakage and evaluation design

Status: **Proposal prepared — review pending**  
Notebook: [07-leakage-and-evaluation-design.ipynb](../../notebooks/07-leakage-and-evaluation-design.ipynb)
Decision supported: P0-04 — evaluation protocol acceptance

## Run context

- Date/time (UTC): 2026-09-17
- Git revision: Uncommitted workspace
- Approved configuration/data revision: Not yet available
- Data class: Sanitised evidence only; no raw provider records, identifiers, secrets, or model artifacts in Git

## Inputs and gate

- `docs/proposals/corpus-and-label-feasibility.proposed.json`
- `docs/proposals/enrichment-pipeline.proposed.json`
- `docs/proposals/feature-availability.proposed.json`
- `docs/proposals/leakage-and-evaluation-design.proposed.json`

The proposal evidence is present. It is not an accepted evaluation protocol or
authorisation to run Notebook 08 in approved-data mode.

## Findings

- Sparkov source partitions are temporally ordered with no event-reference
  overlap: train ends at `2020-06-21T12:13:37Z` and test starts at
  `2020-06-21T12:14:25Z`.
- 908 customer-like source references cross the boundary, so raw references
  remain excluded and any future history feature needs a separate approved,
  point-in-time design.
- A sanitised protocol is available at
  `docs/proposals/leakage-and-evaluation-design.proposed.json`.

## Limitations and unknowns

- The label is simulated with unknown availability/maturity.
- No numeric chronological cutpoints, accepted feature set, or release criteria
  has been selected.
- The protocol proves neither Plaid feature parity nor real-world performance.

## Sanitised artifact

`docs/proposals/leakage-and-evaluation-design.proposed.json`

## Proposed next decision

An authorised reviewer must accept the target, temporal cutpoints, label policy,
feature schema, calibration procedure, slices, and release criteria before an
approved-data Notebook 08 run can be created.
