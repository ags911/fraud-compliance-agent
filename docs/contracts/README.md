# Cross-application contracts

This directory contains versioned, accepted cross-application artifacts:

- `demo-api.v1.openapi.json` — the current synthetic showcase's HTTP
  operations and request/response/error envelopes. It is generated with
  `make api-contract` and frozen by API drift tests.
- `demo-run-events.v1.schema.json` — the showcase's streamed event payloads,
  redacted error categories, framing, and terminal semantics.
- `canonical-transaction.schema.json` — source/revision/time/money facts.
- `feature-snapshot.schema.json` — point-in-time derived features.
- `acceptance-matrix.md` — requirement-to-contract-to-test traceability.

The two `demo-*` contracts freeze the legacy recruiter-showcase surface only.
They do not approve the proposed operational API, canonical transaction,
runtime model scoring, durable state, or payment action. Their acceptance and
supersession rules are recorded in
[`apps/api/docs/adr/0012-freeze-showcase-api-contract.md`](../../apps/api/docs/adr/0012-freeze-showcase-api-contract.md).

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
