# ADR-014 — Adopt the public-safe showcase investigation boundary

Status: Accepted for scoped preparation only  
Date: 2026-09-20  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3, Sections 8–9 and 13–14  
Backlog task: MVP 3 public-safe investigation  
Related decisions: ADR-001, ADR-006, ADR-011, ADR-012 and ADR-013  
Repository scope: Public showcase API, contracts, fixtures, evaluation and UI trace

## Context and evidence

The current local demo imports a mostly fixed LangGraph example from the
private Arbiris SDK. The reviewed public image excludes that SDK and therefore
cannot run the current scenario endpoints. Publishing or copying private SDK
code is not an acceptable default for the public showcase.

LangGraph and Groq are already registered showcase technologies, and the API
already carries direct runtime dependencies for them. A repository-owned,
SDK-free module can therefore provide the intended visible tool-using agent
without changing the private SDK or making it part of the public image.

## Decision

Adopt a repository-owned, SDK-free bounded investigation as the planned MVP 3
public runtime. It may be prepared under
`apps/api/server/showcase_investigation/` after its contracts are accepted. The
legacy private-SDK A–F pipeline remains a local compatibility reference during
migration and is not copied into the new module.

Recorded synthetic demonstration playback is the default public experience. A
clearly labelled live Groq mode is optional and may appear only when its
provider, admission, quota and kill-switch controls are enabled.

S04 is the sole normal tool-using agent path. S05 exercises the same boundary's
incomplete/failure path. S01–S03 and S06–S08 bypass the agent. This decision
does not accept the proposed fixture values or establish an A–F mapping.

## Contracts and invariants

- Requests are scenario-only; no public free-text prompt is accepted.
- Tools and fixture reads are allowlisted, read-only and schema-validated.
- The graph returns a recommendation and cited evidence, never authority or an
  action.
- Deterministic controls and authority remain outside the graph and always win.
- Recorded and live execution are visibly distinct.
- Provider, tool, validation, timeout and step-limit failures remain incomplete
  or failed investigation states; they cannot appear successfully completed.
- The private SDK remains excluded from the public image.
- This showcase slice does not imply F3, F3a, F4 or F5 completion.

## Authorised preparation

This decision authorises documentation, contract drafts, schema fixtures,
tests-first scaffolding and evaluation-harness preparation within the boundary
above. It does not authorise runtime semantics that depend on the unresolved
ADR-006 truth table, public live Groq access, deployment, a database,
authentication, provider data, a served fraud model or a payment action.

## Verification and consequences

Before implementation can be called complete, repository checks must cover the
contract/event schemas, scenario eligibility, authority non-bypass, evidence
citations, malformed output, provider/tool failure, timeout, step exhaustion,
recorded/live labelling, public admission controls and absence of the private
SDK from the image.

ADR-012 remains the accepted contract for the legacy demo until a separate
showcase contract revision is accepted. Full F4 remains separately gated.

## Open questions

Later ADR-006 operational route and authority rows and contract acceptance
remain unresolved. Migration evidence must still be produced before cutover.

## Acceptance record

Decision revision: working tree, 2026-09-20  
Approver: Darren Gidado (product owner)  
Approval date: 2026-09-20  
Approved scope: public-safe module boundary, recorded-playback default, optional
labelled live mode, and S04/S05 eligibility only  
Supporting artifact:
`docs/proposals/public-showcase-investigation.proposed.md`

## Subsequent clarification

On 2026-09-20 the product owner accepted the ADR-006 routing precedence. Clear
and hard-control paths must emit an explicit investigation-skipped trace; S04
must require at least two distinct read-only evidence-tool calls; S05 injects a
deterministic outage without contacting Groq. Future S06 review-conflict
fixtures may reference an immutable recorded S04 recommendation snapshot, but
must not call the agent live merely to create prerequisite state.

The product owner also excluded numeric runtime fraud-model scores and decision
thresholds from MVP 3. They remain deferred to F3a's separate target, corpus,
feature, calibration, threshold, release and rollback approvals. Sparkov
benchmark evidence is not a substitute.

The product owner accepted three initial read-only synthetic evidence tools:
`get_payee_evidence`, `get_account_activity_evidence`, and
`get_device_session_evidence`. Basic transaction facts are graph input rather
than a tool. Policy evaluation, scoring, authority, mutations, external
provider access and recalled case memory are not tools. D7 must still define
their exact typed input, output and evidence-ID schemas before implementation.

The product owner set an observable budget of no more than three tool calls per
investigation and no more than one call per tool. S04 must use at least two
distinct tools. Budget exhaustion is an incomplete investigation with no
action. LangGraph recursion limits remain defensive implementation settings,
not product-facing step semantics.

The product owner accepted one failure contract for provider unavailable, tool
failure, invalid output, timeout and tool-budget exhaustion:
`investigation_status=incomplete`, fail-safe HOLD recommendation,
`authority_status=not_evaluated`, no simulated action, and one stable redacted
reason code. A failed investigation cannot appear successfully completed.

The product owner accepted evidence grounding for preparation: tools are bound
server-side to the current scenario; evidence has stable IDs and synthetic
fixture provenance; every visible claim cites evidence returned in the same
run; unknown or missing citations take the `invalid_output` path; and no hidden
chain-of-thought is requested or stored. The proposed JSON Schema and examples
remain non-runtime artifacts until contract acceptance.

The product owner selected controlled demonstration windows for live Groq
access. Recorded playback remains continuously public; anonymous live mode
defaults off and requires a server-side operator kill switch plus admission and
cost controls. Disablement or exhaustion returns to clearly labelled playback.
Always-on anonymous live mode is prohibited until a reliable provider spending
limit or durable distributed quota is approved. The accepted initial controlled
window is one concurrent live investigation, two per observed client per 10
minutes, ten per process enablement window, a maximum 30-minute enablement
window, and a 45-second overall investigation timeout. Per-client keys must
come from trusted ingress metadata, not arbitrary request headers. These are
safety limits, not performance claims, and process-local counters are not
durable quota enforcement.

The product owner selected Groq as the only optional live provider. Its
credential remains server-side, and its model identifier is selected from an
allowlisted server-side configuration and recorded with each live run. The
adapter accepts only schema-validated structured output. Raw prompts, raw
provider output, hidden reasoning and provider exceptions are not logged or
exposed; public failures use the stable redacted contract. There is no fallback
to another LLM. When live execution is unavailable, the experience returns to
clearly labelled recorded playback. MVP 3 retains only validated contract
fields in ephemeral run state and does not add durable persistence.

The product owner accepted a gated migration. The private-SDK A–F workflow
remains a local-only compatibility reference until the S01–S08 contracts are
accepted and the public runtime evaluation, browser acceptance and container
boundary checks pass. It is never a dependency of the public runtime. Passing
those gates does not cause an automatic switch: cutover requires an explicit
decision. Retirement then removes the legacy workflow from the active
application and dependency path while preserving its characterization
documents and Git history.

ADR-015 subsequently accepted the resulting HTTP and SSE boundary as
`docs/contracts/public-showcase-api.v1.openapi.json` and
`docs/contracts/public-showcase-events.v1.schema.json`, with synthetic
request/error/transcript examples. That decision authorises contract-driven
implementation but does not accept the proposed S01–S08 runtime fixture values.
ADR-016 later accepts those values for the database-free showcase only.
