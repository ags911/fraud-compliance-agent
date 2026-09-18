# Cross-application contracts

This directory is reserved for versioned, accepted cross-application artifacts:

- `openapi.yaml` — HTTP operations and request/response envelopes.
- `sse-events.schema.json` — streamed event envelopes and terminal semantics.
- `canonical-transaction.schema.json` — source/revision/time/money facts.
- `feature-snapshot.schema.json` — point-in-time derived features.
- `acceptance-matrix.md` — requirement-to-contract-to-test traceability.

`model-training-contract.v1.json` is a deliberately narrow exception: it is an
accepted **mechanics-only** local benchmark contract for Notebook 08. It is not
an API contract, model release, production data approval, or permission for
runtime scoring.

`demo-model-summary.v1.json` defines the read-only, sanitised portfolio endpoint
used by the console's Benchmark Insights page. It cannot return a transaction
score or authorise a payment action.

Do not add a contract until API Phase 0 has resolved the relevant ADR and the
artifact has an explicit version and approval state.

Phase 0 drafts live in [`../proposals/`](../proposals/) until that acceptance
path is complete.
