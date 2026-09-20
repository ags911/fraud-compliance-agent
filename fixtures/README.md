# Fixtures

Canonical scenario and contract fixtures live here. They are backend-owned, versioned
facts used by API contract tests, visual demos, and browser tests. Do not place
production data, credentials, or generated training data here.

Each fixture set must include a small, reviewable manifest stating its schema
version, scenario IDs, source class (synthetic or sanitised provider sandbox),
creation revision, and intended consumers. A fixture is not canonical until its
contract and scenario mapping are approved.

`s01-s08/scenarios.v1.json` is the accepted synthetic fixture packet for the
database-free public-showcase runtime. ADR-016 accepts its S01–S08 facts and
agent-bypass boundaries. S01–S05 may drive MVP 3; the operational review,
idempotency and replay behavior for S06–S08 remains deferred to F3–F6.

`contracts/canonical-domain.v0.proposed.valid.json` and
`contracts/canonical-domain.v0.proposed.invalid.json` exercise all six draft
domain entities. They are contract-review examples, not accepted provider or
runtime payloads.

`contracts/public-showcase-api.v1.examples.json` exercises the accepted request
and redacted HTTP-error shapes plus complete S01 skip, S04 recorded
investigation and S05 deterministic-outage transcripts. The terminal empty
object represents the JSON data of the named SSE `done` event. These are
accepted contract-test examples, not canonical runtime scenario fixtures.

See [`docs/data-governance.md`](../docs/data-governance.md).
