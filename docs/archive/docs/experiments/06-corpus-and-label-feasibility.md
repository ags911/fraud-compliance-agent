# Experiment 06 — Corpus and label feasibility

Status: **Proposal prepared — review pending**  
Notebook: [06-corpus-and-label-feasibility.ipynb](../../notebooks/06-corpus-and-label-feasibility.ipynb)
Decision supported: P0-04 / ADR-004/005 — corpus and target decision

## Run context

- Date/time (UTC): 2026-09-17
- Git revision: Uncommitted workspace
- Approved configuration/data revision: Not yet available
- Data class: Sanitised evidence only; no raw provider records, identifiers, secrets, or model artifacts in Git

## Inputs and gate

- `docs/proposals/feature-availability.proposed.json`
- `docs/proposals/enrichment-pipeline.proposed.json`
- Proposed candidate intake: [`sparkov-corpus-intake.proposed.md`](../proposals/sparkov-corpus-intake.proposed.md)

Required proposal evidence is present. This remains a corpus/label feasibility
review; it is not model training approval.

## Candidate corpus preparation

Sparkov is prepared as the initial **research/demo** candidate only. A reviewer
must verify its source terms before acquisition. Its raw CSV remains in ignored
local storage; `make corpus-sparkov-inspect` produces a schema/aggregate/checksum
manifest without printing or committing source rows. The resulting evidence may
inform this experiment but does not make the corpus approved or permit Notebook
08 approved-data mode.

## Findings

- Sparkov has been acquired into ignored local storage and inspected through
  sanitised manifests only.
- `fraudTrain.csv` has 1,296,675 rows / 7,506 positive labels; `fraudTest.csv`
  has 555,719 rows / 2,145 positive labels.
- The source supports mechanics-only research/demo work pending the evaluation
  protocol; it cannot substantiate production behaviour.

## Limitations and unknowns

- `is_fraud` is a simulated source label with unknown availability and maturity.
- The source train/test designation does not establish a chronology-safe or
  entity-leakage-safe split.
- Source-specific personal/location/card fields are excluded by default, and
  Plaid parity is incomplete.

## Sanitised artifact

`docs/proposals/corpus-and-label-feasibility.proposed.json`

## Proposed next decision

Review the proposed target and limitations, then create the leakage protocol in
Notebook 07. Do not create an approved-data model-training contract yet.
