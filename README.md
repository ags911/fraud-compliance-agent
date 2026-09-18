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
- `fixtures` — future canonical deterministic scenario fixtures.
- `notebooks` — reproducible, sanitised feasibility work only.
- `infra` — local orchestration and deployment configuration.

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

`make check` runs the repository inventory check, web lint and design contract,
the production web build, Playwright browser tests, Python lint and docstring
checks, the API smoke check, and API tests. It does not fetch dependencies or
imply that the two current apps are already integrated. Install the web and API
dependencies, including the Playwright Chrome browser, before running it in a
new checkout.
