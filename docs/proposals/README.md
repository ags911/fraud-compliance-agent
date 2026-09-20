# Phase 0 proposals

This directory contains review artifacts that are intentionally **not** accepted
cross-application contracts. They exist so Phase 0 can resolve and approve
semantics without the API or web app consuming a draft by accident.

On approval, promote versioned schemas and API artifacts into
[`../contracts/`](../contracts/), record the decision in an ADR, and add
contract tests. Do not maintain a draft and an accepted copy as competing
sources of truth.

Current data-corpus preparation is documented in
[`sparkov-corpus-intake.proposed.md`](sparkov-corpus-intake.proposed.md). It is
research/demo evidence only, not an approved training corpus or runtime input.

## F3 preparation packet

ADR-013 accepts the local-first preparation boundary, not the detailed
operational semantics. The current review packet is:

- [operational API outline](f3-operational-api.proposed.md);
- [PostgreSQL persistence outline](f3-postgresql-persistence.proposed.md);
- [identity and authorization outline](f3-identity-authorization.proposed.md);
- [canonical transaction draft](canonical-transaction-contract.proposed.md);
- [six-entity proposed JSON Schema](schemas/canonical-domain.v0.proposed.schema.json);
- [proposed acceptance matrix](acceptance-matrix.proposed.md); and
- [accepted S01–S08 showcase fixture packet](../../fixtures/s01-s08/scenarios.v1.json).

The corresponding ADR-001–011 review packet is indexed in
[`apps/api/docs/adr/README.md`](../../apps/api/docs/adr/README.md).

The proposed SDK-free, bounded public investigation is documented separately in
[`public-showcase-investigation.proposed.md`](public-showcase-investigation.proposed.md).
ADR-014 accepts its module boundary, recorded-playback default, and S04/S05
eligibility for scoped preparation only. The remaining document is an MVP 3
showcase proposal whose interfaces may inform F4; it neither accepts the
ADR-006 routing semantics nor completes an operational foundation.

ADR-015 promotes the reviewed cross-application boundary into
[`../contracts/public-showcase-api.v1.openapi.json`](../contracts/public-showcase-api.v1.openapi.json)
and
[`../contracts/public-showcase-events.v1.schema.json`](../contracts/public-showcase-events.v1.schema.json).
The superseded HTTP, SSE and standalone evidence-envelope drafts were removed
so the accepted contract is the only authority. ADR-016 separately accepts the
S01–S08 synthetic values for the database-free showcase runtime. This does not
accept the remaining F3 operational proposals.

Application code must not import the proposals at runtime. The API may consume
the accepted fixture only through a validating loader; the web app consumes
contract events rather than importing fixture data. Further acceptance still
requires separately versioned contracts, ADRs and executable verification.
