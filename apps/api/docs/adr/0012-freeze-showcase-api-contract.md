# ADR-012 — Freeze the current showcase API contract

Status: Accepted
Date: 2026-09-19
Owner: Product owner — Darren Gidado
PRD revision/sections: Candidate v0.3, Sections 2, 6 (FR-10), and 9 (MVP 2–3)
Backlog task: Showcase MVP 0 contract freeze
Related decisions: Future ADR-002 and ADR-011 remain unresolved
Repository scope: API contracts, FastAPI demo routes, and web consumers

## Context and evidence

The React console already consumes five FastAPI demo routes, including two
POST endpoints whose responses are Server-Sent Event streams. Those shapes
were represented only by implementation code and handwritten TypeScript
types. This allowed either application to drift without an explicit contract
review and blocked the showcase MVP 0 completion gate.

The routes are a legacy, synthetic demonstration. They are not the proposed
operational API described by the candidate PRD. The accepted contract must
therefore freeze what the recruiter showcase uses without deciding canonical
transaction, persistence, model-release, authority, or real payment semantics.

## Decision

Accept version 1.0 of two complementary artifacts:

- `docs/contracts/demo-api.v1.openapi.json` is generated from typed FastAPI
  routes and freezes HTTP request, response, validation, and error envelopes.
- `docs/contracts/demo-run-events.v1.schema.json` freezes decoded SSE payloads,
  the two redacted processing-error categories, framing, and terminal rules
  that OpenAPI cannot express.

The application-generated OpenAPI document must exactly match the committed
artifact. `make api-contract` regenerates it for deliberate review; CI tests
fail when route code drifts without regeneration. A contract change requires a
version and compatibility decision plus a frontend consumer check.

## Constraints

- The scope is synthetic scenarios A–F and sanitised benchmark evidence only.
- No route may approve, release, or execute a payment.
- Streamed records expose display-safe metadata, not reasoning, raw inputs,
  signature bytes, or a claim that signature verification occurred.
- SSE failures expose only `processing_timeout` or `processing_failed`; raw
  provider and pipeline errors remain private.
- The stream is transient. A terminal event is not evidence of durable
  processing, persistence, review, or action.
- The future operational API may supersede this contract only through its own
  accepted ADRs, schemas, compatibility decision, and consumer migration.

## Options considered

| Option | Benefits | Costs/limitations | Supporting evidence |
| --- | --- | --- | --- |
| Generated OpenAPI plus a separate SSE schema | Keeps HTTP shapes tied to executable code while expressing stream semantics explicitly | Requires two coordinated artifacts and a drift test | FastAPI owns HTTP schemas; project context requires separate event versioning |
| Handwritten HTTP and SSE documents | Complete editorial control | High risk of immediate drift from Pydantic and route declarations | Existing consumers already depend on implementation shapes |
| Defer the contract until the target API exists | Avoids freezing legacy concepts | Leaves MVP 2–3 integrations unversioned and blocks the stated MVP 0 gate | The public showcase must deploy the current synthetic flow first |

## Contracts and invariants

- Contract version `1.0` covers `/health`, `/scenarios`,
  `/demo/model-summary`, `/run`, and `/run/preset/{scenario_id}` only.
- HTTP validation remains FastAPI's documented `422` envelope. Unavailable
  responses use the stable `detail` categories declared in OpenAPI; unknown
  presets retain their bounded `404` envelope.
- Successful run endpoints return `text/event-stream`. A stream emits node
  events, or one redacted error event, followed by exactly one named `done`
  event whose JSON data is `{}`.
- The five node names and their result payloads are versioned in the SSE schema.
  The web app must not infer additional nodes or fields from SDK internals.
- There is no run replay, idempotency, durable history, or delivery guarantee in
  this contract.

## Verification

| Case/invariant | Input or trigger | Expected result | Verification method | Phase |
| --- | --- | --- | --- | --- |
| HTTP drift | Route or Pydantic change | Contract test fails until reviewed regeneration | `tests/test_api_contract.py` | MVP 0 |
| SSE categories | Timeout or internal failure | Redacted category then terminal `done` | `tests/test_demo_run_safeguards.py` and contract test | MVP 0 |
| Optional SDK absent | Scenario or run request | Typed `503 demo_pipeline_unavailable` | `tests/test_demo_endpoints.py` | MVP 0 |
| Public response shape | Health and scenario requests | Response keys match frozen schemas | `tests/test_api_contract.py` | MVP 0 |

## Consequences and ownership

API changes now have an explicit review boundary, and the Azure and browser
work can target stable showcase shapes. The API owner maintains the generated
HTTP contract and SSE schema; the web owner checks consumers on every version
change. The contract deliberately preserves legacy names for compatibility
rather than promoting them into future domain language.

Rollback means reverting the route, schema, consumer, and contract changes as
one unit. Supersession requires retaining v1 while deployed consumers need it
or documenting a coordinated breaking migration.

## Open questions

The private-SDK packaging decision for the public Azure runtime remains open.
It does not change these external shapes, but it blocks a deployed live run
until the SDK is approved for deployment or replaced behind this contract.

## Acceptance record

Decision revision: Demo HTTP and SSE contracts v1.0
Approver(s): Darren Gidado
Approval date: 2026-09-19
Approved scope: Finish and accept the showcase-only contract freeze begun in the preceding work session
Supporting artifacts/test results: `docs/contracts/demo-api.v1.openapi.json`, `docs/contracts/demo-run-events.v1.schema.json`, and `apps/api/tests/test_api_contract.py`
