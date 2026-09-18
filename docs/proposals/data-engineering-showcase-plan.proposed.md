# Data-engineering showcase: proposed additions

Status: **A1 and A3 implemented (2026-09-19); A2 folded into A1. Not a contract.**  
Owner: Backend/data lead (to assign)  
Last updated: 2026-09-19

## Implementation status

- **A1 — done.** `scripts/build_sparkov_mechanics_dataset.py` now fails on an
  unapproved column, missing values, out-of-range features, a non-binary target,
  row counts that do not reconcile, or partitions that are not chronological.
  Rebuilding the real dataset produced byte-identical output (the contract's
  pinned checksum) and all checks passed.
- **A2 — folded into A1.** The build manifest now records the passed checks,
  source row counts, and each partition's time span. There is no separate
  lineage tooling.
- **A3 — done.** `apps/api/tests/sparkov_fixtures.py` generates seeded
  Sparkov-shaped data and seven deliberately broken variants; each is asserted to
  fail for the right reason. CI runs this on a clean checkout.
- `make data-check` runs the data-path tests on their own.

The sections below are the original proposal, kept for its reasoning.

## Purpose

Most data-engineering work this project needs is already planned. This note
covers only what the existing documents do not, and does not restate them:

- Canonical schema, validator, fixtures, and point-in-time snapshot: P0-02 in
  [`phase-0-backlog.md`](../../apps/api/docs/planning/phase-0-backlog.md).
- Provider lifecycle, cursors, and corrections: P0-03 in the same backlog.
- Idempotency, replay, and durability: P0-07 (ADR-009) and PRD FR-07.
- Online/offline feature parity and drift: the
  [fast-path model spec](FAST-PATH-FRAUD-MODEL-TECHNICAL-SPEC.md) and
  Notebook 10.

The additions below need no accepted contract, add no service, and use
synthetic data only.

## Proposed additions

| ID | Addition | Why it is not already covered |
| --- | --- | --- |
| A1 | Quality gates on the Sparkov build | The build script records a checksum but asserts no data invariants. |
| A2 | Stage manifests chained into a lineage | [`data-governance.md`](../data-governance.md) requires lineage but does not say how it is produced or enforced. |
| A3 | Seeded synthetic generator so CI can run the data path | CI cannot exercise any data path today, because no data is committed. |

### A1 — Quality gates (about 1–1.5 days)

Extend `scripts/build_sparkov_mechanics_dataset.py` to assert, and fail
non-zero on:

- required columns, dtypes, nulls, and value ranges;
- per-partition row-count reconciliation from source to output;
- `train < calibration < test` by time, with no overlap;
- no label or identifier column in the feature set.

Add a `make data-check` target.

### A2 — Stage manifests and lineage (about 1–1.5 days)

Each stage writes a small manifest: inputs and checksums, code revision,
outputs and checksums. A `make data-pipeline` target chains build → check →
evaluate on synthetic data. Plain scripts and manifests, with no orchestrator.

### A3 — Synthetic generator for CI (about 1 day)

A seeded generator that emits Sparkov-shaped rows plus deliberately broken
variants (nulls, out-of-order timestamps, duplicate rows). `pytest` runs the A1
checks against both, with the broken variants as negative tests.

**Exit criteria (A1–A3):** `make check` exercises the data path on synthetic
data in CI, the negative tests fail as intended, and every stage has a manifest.
Total is about 3.5–4.5 days.

## Not proposed

No orchestrator, warehouse, feature store, or managed service; the PRD defers
these (§9.1, §14.4). No production-performance or drift claims.

## Decisions needed

1. Approve A1–A3 as showcase scope.
2. Confirm that new checks may use plain `pytest` and Pydantic. Adding
   `pandera` or `hypothesis` would need a technology-register entry (PRD §14).
