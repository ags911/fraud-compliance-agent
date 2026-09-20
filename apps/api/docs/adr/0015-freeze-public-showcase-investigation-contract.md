# ADR-015 — Freeze the public-showcase investigation contract

Status: Accepted  
Date: 2026-09-20  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3, Sections 8–9 and 13–14  
Backlog task: MVP 3 public-safe investigation contract  
Related decisions: ADR-006, ADR-012 and ADR-014  
Repository scope: Public-showcase HTTP request/error and SSE event contracts

## Context

ADR-012 freezes the legacy private-SDK A–F API. ADR-014 selected a separate,
repository-owned public investigation and subsequently recorded decisions D1
through D10, but deliberately authorised preparation rather than a runtime.
Implementation needs a stable cross-application boundary that does not mutate
the legacy contract or invent the deferred operational API.

The reviewed candidate defines a scenario-only stream, explicit recorded/live
mode, visible deterministic routing and skips, bounded tool evidence,
evidence-grounded recommendation, fail-safe incomplete state, and one terminal
result. It contains no runtime fraud score, threshold, payment authority,
free-text prompt or caller-selected model.

## Decision

Accept version 1.0 of:

- `docs/contracts/public-showcase-api.v1.openapi.json` for
  `POST /showcase/investigations`, its request, media type, and stable HTTP
  errors; and
- `docs/contracts/public-showcase-events.v1.schema.json` for decoded SSE
  payloads, ordering semantics and the named terminal `done` event.

Accept the synthetic request, HTTP-error and S01/S04/S05 transcript examples in
`fixtures/contracts/public-showcase-api.v1.examples.json` as contract-test
evidence only. They are not canonical runtime scenario fixtures.

The API and web app may now implement this contract. At the time of this
decision, neither application could consume the still-proposed S01–S08 packet
until its runtime values received separate acceptance.

ADR-016 subsequently provides that separate acceptance through
`fixtures/s01-s08/scenarios.v1.json`; this paragraph records the boundary at
the time of ADR-015 rather than the repository's current fixture status.

## Contract invariants

- The request contains exactly `scenario_id` and `execution_mode`.
- Scenario identifiers are S01–S08; execution modes are `recorded` and `live`.
- HTTP failures expose only `invalid_request` or
  `showcase_investigation_unavailable` with bounded public messages.
- Admission or live-provider unavailability before execution falls back to a
  visibly recorded run inside the stream rather than a second LLM.
- `run_started` records requested and actual mode; a live run also records
  `provider=groq` and its server-selected model identifier.
- Routing and every agent bypass are explicit events.
- S04 tool events use only the three approved read-only evidence tools, with
  at most three calls and at most one call per tool.
- S05 uses the incomplete fail-safe result without a provider or tool call.
- Every complete investigation claim cites evidence returned during the same
  run. Missing or unknown citations are invalid output.
- Every provider, tool, validation, timeout or budget failure remains
  incomplete, recommends HOLD, leaves authority unevaluated and executes
  nothing.
- Every stream emits one `run_result`, then exactly one named `done` event with
  JSON data `{}`. Stream completion does not imply persistence.
- No event carries hidden reasoning, raw provider errors, a numeric runtime
  model score, a threshold, or a payment action.

## Consequences

The new runtime can be developed tests-first without importing the private SDK
or changing the legacy A–F contract. The frontend can build a typed consumer
against a stable vocabulary. A breaking change requires a new contract version,
an ADR update, examples, API tests and a frontend consumer check.

This decision does not accept the proposed S01–S08 fixture values, implement
the endpoint, enable Groq, deploy Azure resources, complete F4, or authorise a
payment action.

ADR-016 later accepts the fixture values for the narrow showcase scope without
changing the other exclusions above.

## Verification

`apps/api/tests/test_public_showcase_api_contract.py` validates the HTTP
components, every example event, transcript ordering, terminal semantics, S04
tool/citation invariants, S05 failure semantics, and the prohibited fields.
Repository documentation-link and plan-status tests guard the accepted artifact
references.

## Acceptance record

Decision revision: working tree, 2026-09-20  
Approver: Darren Gidado (product owner)  
Approval date: 2026-09-20  
Approved scope: Exact HTTP/SSE candidate presented after D1–D10 resolution  
Supporting evidence: 34 focused proposal/contract, safety, documentation and
plan tests passed before promotion
