# ADR-023 — Accept the Sandbox simulation contract

Status: Accepted  
Date: 2026-09-28  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3  
Backlog task: deterministic live feed (specs 0003, 0004, 0005, 0006 and 0008)  
Related decisions: ADR-012, ADR-015, ADR-020, ADR-021 and ADR-022  
Repository scope: `docs/proposals/schemas/sandbox-simulation.v0.proposed.openapi.json`, `docs/contracts/sandbox-simulation.v1.openapi.json`, `apps/api/server/main.py`, `apps/api/server/sandbox_data/`, `apps/api/tests/test_sandbox_scenario_data.py`

## Context and evidence

The deterministic Sandbox simulation routes are built for local and internal
use. They start, read, cancel and stream browser-scoped runs, and provide
selected-run overlays for the existing Sandbox analytics and decisions reads.
Their current review artifact is
`docs/proposals/schemas/sandbox-simulation.v0.proposed.openapi.json`.

The proposal describes the routes as built, including their stable redacted
errors. A run start can return 429 `simulation_busy` or
`simulation_rate_limited`; a guarded storage ceiling at start uses the
existing 503 `sandbox_scenario_data_unavailable` path. The proposed contract
tests in `apps/api/tests/test_sandbox_scenario_data.py -k contract` verify
that every route error code remains in that artifact.

ADR-021 accepts a guarded public database in principle, but requires a
versioned Sandbox simulation contract to be accepted with it or before public
enablement. This record supplies that proposed acceptance path. It does not
turn on the database, worker, cases, or public database guards.

## Decision to be made

Should the proposed Sandbox simulation API become the accepted versioned
contract for the built deterministic live-feed routes, while preserving every
shape and existing public boundary?

## Constraints

- The frozen v1 stream contracts in ADR-012 and ADR-015 do not change.
- No route approves, releases or executes a payment; a simulation reveals
  scheduled synthetic payments only.
- The browser ID remains a scoping key, not authentication, and never appears
  in a URL, response body or log.
- Acceptance cannot authorise public switch-on without ADR-021's remaining
  guards and Verification items.
- The contract remains independent of the unaccepted general operational
  persistence and identity decisions in ADR-009 and ADR-010.

## Options considered

1. **Keep the simulation contract proposed.** The routes remain local and
   internal implementation evidence, and ADR-021 public enablement remains
   blocked.
2. **Accept the existing proposed shapes as `sandbox-simulation.v1`
   (proposed).** Promote the reviewed artifact without changing routes,
   payloads, error codes or stream behavior.
3. **Redesign the simulation surface before acceptance.** This would widen
   review scope and defer the enablement prerequisite without identified
   evidence of a required shape change.

## Proposed decision

Option 2.

1. On acceptance, move
   `docs/proposals/schemas/sandbox-simulation.v0.proposed.openapi.json` to
   `docs/contracts/sandbox-simulation.v1.openapi.json` with its shapes,
   routes, error codes and safety metadata unchanged.
2. On acceptance, update the contract tests to read the promoted path and
   fail on route or error-code drift without a versioned successor.
3. Until acceptance, retain only the v0 proposed artifact. Do not create the
   v1 contract now and do not treat this ADR as contract promotion authority.
4. Public enablement under ADR-021 remains blocked until this ADR is accepted
   and every applicable ADR-021 Verification item is complete.

## Contracts and invariants

- **Shapes unchanged on promotion.** The accepted v1 artifact is a path and
  lifecycle promotion, not a redesign. Requests, responses, stable redacted
  error codes and SSE frame behavior remain exactly as the reviewed proposal.
- **Simulation only.** The contract covers deterministic, browser-scoped
  simulation state and read-time overlays; it does not define payment
  execution, approval, release, a model score or an authority decision.
- **Safe errors.** `invalid_browser_id`, the `sandbox_*` codes and the
  `simulation_*` codes remain stable and redacted. A storage ceiling refusal
  at start remains the existing 503 `sandbox_scenario_data_unavailable` path.
- **No implicit enablement.** Contract acceptance does not set
  `SHOWCASE_CASES_ENABLED`, `SIMULATION_WORKER_ENABLED`,
  `PUBLIC_DATABASE_GUARDS_ENABLED`, or `SHOWCASE_TRUSTED_PROXY_HOPS`.
- **Single authority.** After acceptance, the proposal is moved rather than
  copied so one versioned contract path is authoritative.

## Verification

Before this ADR is accepted:

- `cd apps/api && uv run --no-sync pytest tests/test_sandbox_scenario_data.py -k contract`
  passes, including the test that every simulation error code occurs in the
  proposed artifact.
- Review confirms the proposal describes the built routes and stable errors,
  including the 503 storage-ceiling start refusal.
- The product owner confirms that promotion with unchanged shapes is the
  intended contract decision.

After acceptance:

- Move the proposed artifact to
  `docs/contracts/sandbox-simulation.v1.openapi.json` without changing its
  content other than path-appropriate lifecycle metadata.
- Point contract-drift tests to that accepted path and run the API checks.
- Do not enable the public database until ADR-021's staging, ingress,
  budget-alert, rollback and remaining guard verification are complete.

## Consequences and ownership

- ADR-021 gains its required contract prerequisite once this record is
  accepted and its promotion steps are completed.
- The API and web consumers gain a single versioned source for this narrow
  simulation surface; wider database, identity and operational contracts stay
  out of scope.
- Owner: the product owner accepts or rejects this record and owns any future
  versioned successor.

## Open questions

- Does the owner approve promotion of the current shapes without a further
  public API review?
- Which ADR-021 staging evidence will establish the ingress header chain
  before trusted proxy hops can be set above zero?

## Acceptance record

Accepted by: Darren Gidado (product owner)  
Date: 2026-09-28  
Notes: Accepted as written, by the owner's explicit choice in a Claude Code session; recorded by Claude on that instruction. The owner approves promotion of the current shapes without a further public API review. The contract moved to `docs/contracts/sandbox-simulation.v1.openapi.json` unchanged, and the contract tests read it there. Trusted proxy hops stay at 0 until the ADR-021 staging deployment confirms the ingress header chain. No setting is switched on.  

