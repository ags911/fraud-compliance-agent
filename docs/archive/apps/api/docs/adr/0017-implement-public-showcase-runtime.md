# ADR-017 — Implement the SDK-free public-showcase runtime

Status: Accepted  
Date: 2026-09-20  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3, Sections 8–9 and 13–14  
Backlog task: MVP 3 public-safe investigation runtime  
Related decisions: ADR-014, ADR-015 and ADR-016  

## Context

The public container cannot ship the private Arbiris SDK. ADR-015 freezes a
separate scenario-only HTTP/SSE contract and ADR-016 accepts the S01–S08
synthetic packet, with S01–S05 ready for the database-free showcase. The
approved live-mode limits existed as a non-runtime candidate even though the
product owner had accepted those exact values.

## Decision

Implement `apps/api/server/showcase_investigation/` as the repository-owned,
SDK-free runtime and expose `POST /showcase/investigations` against the accepted
contract.

Promote the already-approved controls unchanged to
`config/public-showcase-investigation.v1.json`. Runtime configuration defaults
live mode off. An actual Groq call additionally requires a server-side secret,
an operator-selected model identifier, and that identifier in an explicit
server-side allowlist. No model identifier is invented or accepted by this ADR.

Use the server-observed socket peer as the process-local client key. Do not
trust caller-supplied forwarding headers. A future Azure ingress configuration
may replace that derivation only after the trusted proxy boundary is verified.

## Runtime boundary

- S01–S03 visibly bypass the graph and return deterministic recommendations.
- Recorded S04 emits the accepted payee/device trace and cited CHALLENGE.
- Live S04 uses a bounded LangGraph plan–tool–assess loop only after admission.
- S05 injects the accepted provider-unavailable incomplete result without an
  external call.
- S06–S08 return the stable redacted 503; their accepted facts do not create
  review, idempotency or replay behavior.
- Account-activity evidence has no accepted payload and fails as `tool_failed`.
- Every completed stream emits one `run_result` and one named `done` event.
- No path emits a numeric score, threshold, authority decision or payment
  action, and no path persists run state.

The legacy A–F routes remain local compatibility routes. This decision neither
cuts over the browser nor retires the private-SDK workflow.

## Consequences

The public image can now serve recorded S01–S05 without the private SDK or any
provider credential. Optional live execution remains off until an operator
provides all three live settings, and process-local safeguards remain explicitly
non-durable. Browser integration, Azure verification and the explicit legacy
cutover decision remain separate checkpoints.

## Verification

`tests/test_showcase_investigation_runtime.py` covers accepted fixture loading,
request redaction, S01–S03 bypass, S04 playback, S05 failure, deferred S06–S08,
LangGraph tool/citation failures, the concrete Groq adapter boundary and every
process-local admission ceiling. `tests/test_public_showcase_api_contract.py` additionally drives the served
route with every value the accepted OpenAPI declares and validates both redacted
error bodies against it, because the route is deliberately kept out of the
served schema that the frozen legacy demo contract asserts exactly. Container
CI calls recorded S04 and verifies the first-party package exists while
private/offline packages remain absent.

## Acceptance record

Decision revision: checkpoint 1, 2026-09-20  
Approver: Darren Gidado (product owner)  
Approval date: 2026-09-20  
Approved scope: Local SDK-free S01–S05 runtime and the previously approved
process-local live safeguards; no browser cutover or public deployment
