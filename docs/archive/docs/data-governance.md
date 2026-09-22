# Data and model-artifact governance

## Purpose

This project needs reproducible risk-engineering work without putting personal,
provider, or training data in Git. This policy applies to notebooks, fixtures,
experiments, and any future model artifact.

## Storage classes

| Class | May be committed? | Location | Requirements |
| --- | --- | --- | --- |
| Schema, manifest, synthetic fixture, experiment record | Yes | `docs/`, `fixtures/`, `config/` | Reviewable, versioned, no secrets or PII |
| Sanitised small example | Yes, exceptionally | `fixtures/` | Document source class, transformations, and intended use |
| Raw provider/sandbox export | No | Approved secure storage | Immutable source reference and access control |
| Processed/training data | No | Approved secure storage | Versioned manifest, lineage, retention/access policy |
| Model artifact/checkpoint | No | Approved registry/object storage | Immutable version, checksum, evaluation and release record |

`data/`, `artifacts/`, and `models/` are ignored at the repository root as a
defence in depth measure. Ignoring a file does not make it safe to store on an
unmanaged device or share externally.

## Required lineage

Every experiment or candidate model records:

1. Git commit and code/config revision.
2. Dataset or fixture manifest ID, source class, and time boundary.
3. Feature/schema version and transformations.
4. Metrics, cohort/slice checks, known limitations, and decision.
5. Artifact URI and checksum, if one exists.
6. Named owner and approval state.

Use [`experiments/experiment-record-template.md`](experiments/experiment-record-template.md)
until an approved tracking system is introduced.

## Promotion boundary

No notebook result, candidate configuration, or locally trained artifact is a
runtime model by default. Promotion requires an approved target, data basis,
evaluation criteria, release record, rollback approach, and the corresponding
contract/policy version. Runtime decisions must record the approved policy and
model versions used.

## Plaid sandbox handling

Plaid access tokens, raw sandbox payloads, account identifiers, and enrichment
outputs stay outside Git. A reproducible notebook may produce a sanitised
fixture only after documenting the exact mapping, source revision, and removal
of identifying fields. It must not silently substitute generic provider data
for an operator-selected scenario.

### Accepted local Sandbox analysis boundary

The Plaid mapping proposal permits **local, zero-retention Sandbox analysis**
only. A notebook may hold a response in memory long enough to produce a
sanitised schema or aggregate Pandas table. It must not write raw responses,
identifiers, tokens, individual transaction rows, or customer-like data to the
repository, notebook output, `data/`, or an unmanaged local export. The
accepted scope excludes canonical transformations, model-training data,
runtime ingestion, and payment actions.
