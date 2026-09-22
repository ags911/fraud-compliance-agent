# Cross-application contracts

This directory contains versioned, accepted cross-application artifacts:

- `demo-api.v1.openapi.json` — the current synthetic showcase's HTTP
  operations and request/response/error envelopes. It is generated with
  `make api-contract` and frozen by API drift tests.
- `demo-run-events.v1.schema.json` — the showcase's streamed event payloads,
  redacted error categories, framing, and terminal semantics.
- `public-showcase-api.v1.openapi.json` — the repository-owned S01–S08
  investigation request, stream media type, and stable HTTP errors.
- `public-showcase-events.v1.schema.json` — the public investigation's routing,
  skip, bounded-tool, evidence, recommendation, result, and terminal events.

The two `demo-*` contracts freeze the legacy recruiter-showcase surface only.
They do not approve the proposed operational API, canonical transaction,
runtime model scoring, durable state, or payment action. Their acceptance and
supersession rules are recorded in
[`apps/api/docs/adr/0012-freeze-showcase-api-contract.md`](../../apps/api/docs/adr/0012-freeze-showcase-api-contract.md).

The repository-owned public investigation has a separate accepted HTTP
contract and investigation-event schema. Its broader product boundary is in
[`docs/proposals/public-showcase-investigation.proposed.md`](../proposals/public-showcase-investigation.proposed.md);
ADR-015 records the exact contract acceptance. ADR-016 separately accepts
`fixtures/s01-s08/scenarios.v1.json` for the database-free showcase runtime.
S01–S05 are runtime-ready; S06–S08 operational behavior remains deferred.

The event contract preserves the accepted failure distinction:
provider, tool, output-validation, timeout and budget failures terminate as an
`incomplete` investigation with a stable redacted reason, fail-safe HOLD
recommendation, unevaluated authority and no action. It must not encode such a
failure as a successfully completed investigation.

The accepted event schema now owns the evidence/recommendation envelope and
same-run citation shape. Its examples live in
[`fixtures/contracts/public-showcase-api.v1.examples.json`](../../fixtures/contracts/public-showcase-api.v1.examples.json)
and are contract-test evidence, not canonical runtime fixtures.

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

The canonical transaction schema, feature-snapshot schema, operational
OpenAPI/events and acceptance matrix are **planned artifacts, not files in this
directory yet**. Their current review inputs remain proposals; do not cite the
future filenames as accepted contracts.

Review inputs: [proposed canonical domain schema](../proposals/schemas/canonical-domain.v0.proposed.schema.json)
and [proposed acceptance matrix](../proposals/acceptance-matrix.proposed.md).
