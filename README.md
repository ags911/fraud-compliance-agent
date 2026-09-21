# Fraud Compliance Agent

Monorepo for the payment-risk engine and its operator console.

## Layout

- `apps/api` — FastAPI modular monolith; owns operational facts, contracts,
  risk routing, review/action state, integrations, and backend tests.
- `apps/web` — React operator console; consumes API contracts and contains no
  backend or database imports.
- `docs/contracts` — cross-application, versioned contract artifacts.
- `docs` — shared product, contract, governance, experiment, and proposal
  documentation; see `docs/README.md` for authority and lifecycle.
- `fixtures` — versioned deterministic scenario and contract fixtures; only
  explicitly accepted sets may be consumed at runtime.
- `notebooks` — reproducible, sanitised feasibility work only.
- `infra` — local orchestration and deployment configuration.

For how the parts fit together, and what is built rather than planned, read
[the system architecture](docs/architecture/system-architecture.md).

The copied applications remain independently runnable. Root-level contracts and
automation are added incrementally; neither app should be moved, rewritten, or
made dependent on the other as part of this migration.

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
<https://thankful-grass-0e239cb1e.4.azurestaticapps.net>; see the
[`public investigation record`](docs/proposals/public-showcase-investigation.proposed.md)
and [`2026-09-21 release evidence`](docs/audits/2026-09-21-mvp3-azure-release.md).
Groq is the sole selected live provider for that boundary; credentials and
allowlisted model selection remain server-side, provider/model identity is
recorded per run, only validated structured output is retained, and unavailable
live execution falls back to labelled playback rather than another LLM.
The current private-SDK A–F workflow remains local-only until the replacement's
contracts, runtime evaluations, browser acceptance and public-container checks
pass. An explicit cutover decision is still required; retirement preserves the
legacy characterization documents and Git history.
