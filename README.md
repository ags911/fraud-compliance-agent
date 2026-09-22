# Fraud Compliance Agent

Monorepo for the payment-risk engine and its operator console.

## Layout

- `apps/api` — FastAPI modular monolith; owns operational facts, contracts,
  risk routing, review/action state, integrations, and backend tests.
- `apps/web` — React operator console; consumes API contracts and contains no
  backend or database imports.
- `context` — the single source of truth for active development and agent
  execution; see [AI-assisted development workflow](#ai-assisted-development-workflow)
  below.
- `docs/contracts` — cross-application, versioned contract artifacts.
- `docs/architecture` — rendered architecture diagrams (source and SVG).
- `docs/archive` — archived historical documentation and legacy orchestrator
  files, superseded by `context/`; not for active development.
- `fixtures` — versioned deterministic scenario and contract fixtures; only
  explicitly accepted sets may be consumed at runtime.
- `notebooks` — reproducible, sanitised feasibility work only.
- `infra` — local orchestration and deployment configuration.

For how the parts fit together, and what is built rather than planned, read
[`context/architecture.md`](context/architecture.md).

The copied applications remain independently runnable. Root-level contracts and
automation are added incrementally; neither app should be moved, rewritten, or
made dependent on the other as part of this migration.

## AI-assisted development workflow

[`context/`](context/) is this repository's single source of truth for
active development and agent execution. This spec-driven workflow exists to
prevent context drift and unverified AI refactoring. Root
[`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) both direct every
agent, human-directed or autonomous, to `context/` first. The former
canonical document, `docs/project-context.md`, and the PRD/ADR/proposal
corpus it pointed to, are archived under [`docs/archive/`](docs/archive/)
and are historical only — do not reference them for active development.

### Context baseline

`context/` holds the six canonical baseline files:

- `project_overview.md` — product scope, goals, and user journeys.
- `architecture.md` — tech stack, system boundaries, and accepted invariants.
- `code_standards.md` — TypeScript and Python conventions and patterns.
- `ai_workflow_rules.md` — execution bounds and single-spec constraints.
- `ui_context.md` — design tokens, state indicators, and layout rules.
- `progress_tracker.md` — active phase, completed specs, and the ADR log.

### Process for a feature spec

1. **Draft a spec.** Write a scoped unit in `context/feature_specs/` (for
   example `01-langgraph-orchestration.md`) with a goal, its invariants and
   constraints, an implementation plan, and a verification checklist.
2. **Start a fresh session.** Begin a new chat session per spec file, so
   context doesn't accumulate or drift across unrelated work.
3. **Execute the spec** with the `/develop` skill, pointed at the spec file:
   `/develop spec=context/feature_specs/<name>.md`. The agent implements only
   the scoped changes.
4. **Verify.** Run `/check` for build, type, and behavioural checks, plus an
   automated diff review, before treating the spec as done.
5. **Sync state.** Run `/sync` to record the spec as complete in
   `progress_tracker.md` and log any new architectural decision it produced.

### Rules

- No raw prompts: don't ask an agent to implement a feature without a spec
  file under `context/feature_specs/`.
- Single-spec scope: an agent works on exactly one feature spec per session.
- No speculative logic: if a spec is missing an assumption the work depends
  on, the agent halts and asks, rather than guessing.

## Current source snapshots

| Application | Source revision copied | Notes |
| --- | --- | --- |
| API | `e67d795243816ed5cc4abc1b472c26faed86f759` | Source working tree included uncommitted documentation/dashboard changes. |
| Web | `f6f182b3dacbf51ece5f55fe9374812ddda5ec5c` | Source working tree included uncommitted product/design changes. |

Local environment files, dependencies, caches, test output, and Git metadata
were deliberately excluded. Copy `.env.example` to a local `.env` in the
specific app only when running it.

## Commands

```bash
make web-build
make web-test
make api-test
make check
```

`make check` runs web lint and design contract, the production web build, Playwright browser tests, Python lint and docstring
checks, the API smoke check, and API tests. It does not fetch dependencies or
imply that the two current apps are already integrated. Install the web and API
dependencies, including the Playwright Chrome browser, before running it in a
new checkout.

## The optional private SDK

The live demo pipeline (`/scenarios` and the run routes) uses the private
Arbiris SDK, which lives in a git submodule. Everything else, including the
benchmark endpoint, the data checks, and the web console's static pages, runs
without it. On a clone without submodule access:

```bash
cd apps/api
uv sync --frozen            # --frozen skips validating the absent SDK
uv run --frozen pytest tests
```

The routes that need the SDK then return `503 demo_pipeline_unavailable`, and
their tests skip. With access, run `git submodule update --init` and
`uv sync --extra sdk`; the `make` targets use the SDK automatically when the
submodule is present.

The approved public-showcase direction is not to publish that private SDK.
Instead, MVP 3 uses a repository-owned, SDK-free bounded LangGraph
investigation: recorded synthetic playback is the default, S04 is the only
normal agent scenario, S05 is its failure path, and an explicitly labelled live
Groq run is optional behind safety controls. ADR-015 accepts the HTTP/SSE
contract and ADR-016 accepts the synthetic S01–S08 values for showcase use;
ADR-017 implements the SDK-free S01–S05 API runtime. Local browser,
public-container, Azure, CORS, redaction, and public Chrome checks pass. The
recorded-only showcase is available at
<https://thankful-grass-0e239cb1e.4.azurestaticapps.net>; see
[`context/progress_tracker.md`](context/progress_tracker.md) for the current
record, or the archived
[`public investigation record`](docs/archive/docs/proposals/public-showcase-investigation.proposed.md)
and [`2026-09-21 release evidence`](docs/archive/docs/audits/2026-09-21-mvp3-azure-release.md)
for the original detail.
Groq is the sole selected live provider for that boundary; credentials and
allowlisted model selection remain server-side, provider/model identity is
recorded per run, only validated structured output is retained, and unavailable
live execution falls back to labelled playback rather than another LLM.
The current private-SDK A–F workflow remains local-only until the replacement's
contracts, runtime evaluations, browser acceptance and public-container checks
pass. An explicit cutover decision is still required; retirement preserves the
legacy characterization documents and Git history.
