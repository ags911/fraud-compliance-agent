# Public-safe showcase investigation — decision record and implementation plan

Status: **Local SDK-free API runtime implemented; browser and deployment pending**  
Target: MVP 3 public showcase, with interfaces that may inform F4  
Replaces publicly: the unavailable private-SDK live-run path  
Does not replace locally: the legacy private-SDK A–F pipeline during migration

## Purpose

Define a repository-owned, SDK-free LangGraph investigation that can ship in
the public API container. The visible showcase should demonstrate bounded tool
selection and evidence-grounded recommendation without implying autonomous
payment authority, production fraud performance, or durable operational state.

This is a narrow public-showcase capability. It does not complete F3, F3a or
F4, implement S06–S08 operational behavior, or turn the current demo contract
into an operational contract.

## Observed starting point

The current API imports `fraud_compliance_agent_v2` from the private vendored
Arbiris SDK. That workflow is a mostly fixed LangGraph pipeline with one
conditional branch and two possible single-shot Groq calls; it is not a
plan–tool–assess loop. The public Docker image deliberately excludes the
private SDK, so its scenario and run routes return the stable unavailable
response in that image.

The API already has process-local concurrency and timeout guards, redacted
stream errors, an external-investigation opt-in flag, and a tested simulated
provider-outage path. Those patterns can be retained, but they are not by
themselves sufficient public abuse or cost controls.

## Proposed boundary

```text
scenario ID
  -> versioned synthetic fixture
  -> deterministic controls
  -> bounded LangGraph investigation (only when eligible)
       -> allowlisted read-only tools
       -> evidence records with stable IDs
       -> typed recommendation and cited rationale
  -> deterministic authority evaluation outside the graph
  -> versioned trace events and simulated outcome
```

### Invariants

- The public request accepts an allowlisted scenario ID, not free-text evidence
  or instructions.
- Runtime data comes only from accepted, versioned synthetic fixtures.
- Tools are read-only, schema-validated and allowlisted by the server.
- Tool results are untrusted inputs and cannot inject new tools, instructions
  or authority.
- The graph produces a recommendation only. Deterministic controls and the
  authority layer remain outside it and always win.
- Every user-visible factual claim cites an evidence ID present in the run.
- Unsupported claims make the agent output invalid and trigger the accepted
  fallback.
- Tool failure, provider failure, malformed output, timeout and tool-budget
  exhaustion produce the single `incomplete` investigation state. They are
  never reported as a successfully completed HOLD.
- No chain-of-thought, raw provider error, secret or hidden prompt is returned
  in an event, response, record or log.
- Every outcome and action remains synthetic and simulated.
- The module has no database, authentication, customer data, Plaid runtime
  connector, served fraud model or payment integration.
- The private SDK is neither imported nor copied.

## Proposed code and contract ownership

| Concern | Proposed owner | Boundary |
| --- | --- | --- |
| Showcase graph and state | `apps/api/server/showcase_investigation/` | Public, SDK-free runtime code |
| Scenario fixtures | `fixtures/s01-s08/scenarios.v1.json` | Accepted synthetic values; API-only validating loader; S01–S05 runtime scope |
| HTTP operations | Separate versioned showcase OpenAPI revision | Do not silently extend ADR-012 |
| Trace events | Separate versioned investigation-event JSON Schema | Do not overwrite the legacy node-event schema |
| Authority | Deterministic API module outside LangGraph | Agent recommendation cannot expand it |
| Recorded fallback | Recorded demonstration playback | Never called operational replay or presented as live |
| Evaluation | Scripted agent evaluation suite | Measures bounded behaviours only; no fraud-performance claim |

## Decisions to resolve

Resolve these in order because later answers depend on earlier boundaries.

| ID | Decision | Recommended starting position | Status |
| --- | --- | --- | --- |
| D1 | Default public experience | Recorded demonstration playback by default; explicit, clearly labelled live-run control only when the provider and safety controls are enabled | Resolved by product owner, 2026-09-20 |
| D2 | Eligible showcase scenarios | S04 is the only normal agent path; S05 exercises its incomplete/failure path. S01–S03 and S06–S08 bypass the agent. This does not accept the draft fixture values or map A–F by similarity. | Resolved by product owner, 2026-09-20 |
| D3 | Routing and authority truth table | Precedence resolved: invalid/unknown policy fails safe; hard controls HOLD without the agent; clear low-risk controls PASS without the agent; only an approved ambiguous route enters the agent; authority remains outside it and no showcase payment action occurs. MVP 3 has no numeric runtime model score or threshold; those are deferred to F3a. Non-GBP, expiry and reviewer-limit rows remain open for later operational scope. | Partially resolved by product owner, 2026-09-20 |
| D4 | Tool set | Allow exactly `get_payee_evidence`, `get_account_activity_evidence`, and `get_device_session_evidence` for S04. Transaction facts are initial graph input; policy, score, authority, mutation, provider and case-memory tools are excluded. | Resolved by product owner, 2026-09-20 |
| D5 | Execution budget | Maximum three tool calls per investigation and one call per tool. S04 requires at least two distinct tools. Budget exhaustion leaves the investigation incomplete with no action. LangGraph recursion remains a defensive implementation guard, not a product metric. | Resolved by product owner, 2026-09-20 |
| D6 | Failure fallback | Provider unavailable, tool failure, invalid output, timeout and tool-budget exhaustion all produce `investigation_status=incomplete`, fail-safe HOLD recommendation, `authority_status=not_evaluated`, no simulated action, and a stable redacted reason code. | Resolved by product owner, 2026-09-20 |
| D7 | Evidence and rationale schema | Tools are server-bound to the current scenario and return typed evidence with stable IDs and synthetic provenance. Every visible claim cites evidence returned in the same run; unknown/missing citations trigger `invalid_output`. No chain-of-thought is requested or stored. | Resolved by product owner, 2026-09-20; accepted in ADR-015 event contract |
| D8 | Public admission and cost controls | Recorded demonstration playback is continuously public. Anonymous live Groq defaults off and is enabled through a server-side kill switch for at most 30 minutes. Limits: one concurrent investigation, two per observed client per 10 minutes, ten per process enablement window, and a 45-second overall timeout. Limits fall back to labelled playback. Always-on live mode requires reliable provider spending or durable distributed quota first. | Implemented locally under ADR-017; Azure ingress verification pending |
| D9 | Provider policy | Groq is the only live provider and uses a server-side credential. Select the model from an allowlisted server-side configuration and record the provider and model identifier with each run. Accept only schema-validated structured output; expose only stable redacted errors; never log raw prompts, raw provider output or hidden reasoning. Do not fail over to a second LLM—use labelled recorded playback when live execution is unavailable. | Adapter implemented under ADR-017; no model identifier selected and live defaults off |
| D10 | Migration and retirement | Keep the private-SDK A–F workflow as a local-only compatibility reference until accepted S01–S08 contracts, public-runtime evaluations, browser acceptance and public-container boundary checks all pass. Cutover requires an explicit decision. Retirement removes the legacy workflow from the active application and dependency path while preserving its characterization documents and Git history. | Runtime, local browser and container gates pass; public-environment verification and explicit cutover remain |

### Accepted initial tool allowlist

| Tool | Synthetic evidence returned | Explicit boundary |
| --- | --- | --- |
| `get_payee_evidence` | Payee age/tenure band, prior-payment relationship, and synthetic name-match evidence | No real payee data, provider lookup, beneficiary mutation, or authority result |
| `get_account_activity_evidence` | Balance impact, recent payment velocity, and synthetic recent-credit context | No account mutation, fraud score, payment action, or recalled case history |
| `get_device_session_evidence` | Device familiarity, material session changes, and synthetic location/channel context | No device fingerprint, tracking, raw location, or external telemetry call |

The graph receives basic transaction facts before tool selection. It may call
only the three names above and S04 must use at least two distinct tools. ADR-016
accepts the recorded S04 payee/device evidence. Account-activity evidence is
not yet accepted and therefore takes the stable `tool_failed` path if invoked.

An investigation may make at most three tool calls, and each tool may be called
at most once. Exhausting the budget without a valid evidence-grounded
recommendation produces an incomplete investigation and no action. Framework
node/recursion limits are implementation safeguards and are not exposed as the
product's step count.

All provider, tool, output-validation, timeout and budget failures share the
same terminal semantics:

```text
investigation_status: incomplete
recommendation: HOLD
recommendation_basis: fail_safe
authority_status: not_evaluated
simulated_action: none
failure_reason: provider_unavailable | tool_failed | invalid_output | timeout | tool_budget_exhausted
```

The reason code is stable and redacted. Provider exceptions, prompts and tool
internals never cross the API boundary.

The accepted typed envelope is part of
[`../contracts/public-showcase-events.v1.schema.json`](../contracts/public-showcase-events.v1.schema.json).
It bounds tool names, evidence categories, display values, synthetic
provenance, visible claims, uncertainties and complete/incomplete
recommendations. JSON Schema validates structure; application validation must
additionally prove that every cited evidence ID was returned by an allowlisted
tool during the same run. Unsupported citations use the D6 `invalid_output`
path. Hidden reasoning is not a field.

The accepted non-secret limits live in
[`config/public-showcase-investigation.v1.json`](../../config/public-showcase-investigation.v1.json).
They are safety limits, not latency, capacity, availability or zero-cost
claims. Per-client admission may use only trusted ingress metadata, never an
arbitrary request header. The ten-run counter is process-local, resets on
restart and is deliberately not described as durable quota enforcement.

The same accepted configuration records the provider boundary. Groq
is the only live provider, its credential stays server-side, and the chosen
model comes from an allowlisted server-side setting rather than a request. Each
live run records the provider and model identifier as trace metadata. Only
schema-validated contract fields may enter the ephemeral run record; raw
prompts, raw provider responses and hidden reasoning are not logged. Provider
failure never cascades to another LLM: the public experience returns to
clearly labelled recorded playback and exposes only the stable redacted failure
contract.

The legacy private-SDK A–F pipeline remains a local-only compatibility
reference during migration and is never a dependency of the public runtime.
Coexistence ends only after the S01–S08 contracts are accepted and the new
runtime's evaluation, browser-acceptance and public-container boundary checks
pass. Cutover still requires an explicit decision; passing tests does not
silently switch routes or remove code. Retirement removes the legacy workflow
from the active application and dependency path while preserving its
characterization documents and Git history as reviewable evidence.

## Accepted cross-application contract

ADR-015 expresses the D1–D10 decisions in two accepted contract artifacts:

- `POST /showcase/investigations` accepts only an explicit S01–S08
  `scenario_id` and `recorded` or `live` `execution_mode` in
  [`../contracts/public-showcase-api.v1.openapi.json`](../contracts/public-showcase-api.v1.openapi.json).
- decoded SSE payloads and the named terminal `done` event are defined in
  [`../contracts/public-showcase-events.v1.schema.json`](../contracts/public-showcase-events.v1.schema.json).

The event candidate makes routing and skips visible, carries provider/model
identity only for an actual live run, exposes tool calls and typed synthetic
evidence without raw arguments, represents every investigation failure as
incomplete, and ends with one non-authoritative `run_result`. It contains no
numeric model score, decision threshold, payment action, free-text prompt or
request-selected model. Accepted contract examples cover S01, S04 and S05.
ADR-017 implements these artifacts in the API using the separately accepted
ADR-016 scenario values. Local browser consumption now validates the accepted
event shapes and terminal ordering and has an owned browser-to-FastAPI matrix;
public-environment verification remains the next checkpoint.

## Tests-first implementation slices

1. Complete the unresolved D3 truth-table rows in ADR-006; its routing
   precedence is already accepted.
2. Use the accepted endpoint, request, HTTP-error and trace-event artifacts and
   their S01/S04/S05 examples; do not recreate a competing draft copy.
3. Write authority tests proving a hard HOLD cannot be bypassed and a failed
   investigation cannot appear complete.
4. Write evaluation cases for the three-tool allowlist, at least two distinct
   S04 calls, evidence citation, malformed output, provider outage, timeout and
   step exhaustion.
5. Implement the minimal graph and deterministic provider/test adapter needed
   to pass those cases.
6. Add recorded demonstration playback, then the optional Groq adapter.
7. Add the accepted controlled-window kill switch and admission controls before
   enabling any live external call. Keep always-on anonymous live mode disabled
   until reliable provider-side spending or durable distributed quota exists.
8. Add the trace UI and update the existing tours without adding review
   mutations or claiming F4/F5 completion.
9. Verify the public Docker image contains the new module and no private SDK.
10. Record an explicit cutover decision, then remove the legacy workflow from
    the active application and dependency path while preserving its
    characterization documents and Git history.

## Completion boundary

The MVP 3 slice is complete only when a recruiter can run or play back an
accepted synthetic scenario, distinguish recorded from live execution, inspect
validated tool/evidence events, see recommendation and authority as separate,
and observe truthful unavailable/failure states. Full F4 still requires its
separately accepted operational dependencies and contract.
