# Review, refactor/risk-console, 2026-09-27

**Reviewed by**: Codex (fresh-model review)
**Scope**: `git diff main...refactor/risk-console`
**Verdict**: Approve

## Summary

No reportable findings. I concentrated on the requested high-risk paths:

- simulation start/reveal concurrency, advisory locks, idempotent feed-case creation, retention sweep, and SQL construction;
- durable showcase-case capture, atomic writes, browser scoping, and log redaction;
- route error ordering and anonymous browser-ID handling; and
- console hook cancellation, stale-response handling, scenario changes, unmounting, and `pagehide` cleanup.

The implementation has the expected protections: the simulation-start lock serialises cap/rate-limit decisions; each due event is claimed with `FOR UPDATE ... SKIP LOCKED` and revealed in its own transaction; the feed-case insert shares that transaction; and case inserts serialise per browser before cap trimming. SQL values are parameterised and dynamic identifiers are fixed/composed with psycopg's SQL helpers. The case stream wrapper forwards every frame verbatim, and persistence errors are deliberately contained and logged only as fixed diagnostic classes. Browser IDs remain header-only and are neither interpolated into URLs nor logged or returned.

The client hooks cancel obsolete feeds, abort stale case-list requests, ignore late pages after a filter/reload change, and register/removes lifecycle listeners correctly. The quiet-poll merge previously identified on this branch is addressed by `firstPageInto`.

## Findings

None.

## Validation

- `UV_CACHE_DIR=/private/tmp/fca-codex-review-uv-cache uv sync --frozen` — environment created, but its final editable metadata step cannot complete because the deliberately absent `vendor/arbiris-sdk` submodule is not a Python project.
- `UV_CACHE_DIR=/private/tmp/fca-codex-review-uv-cache uv run --no-sync pytest tests/test_showcase_cases.py tests/test_sandbox_scenario_data.py tests/test_feed_decisions.py tests/test_mixed_feed.py -q` — **138 passed** (one Starlette deprecation warning).
- `npm ci` — completed; 0 vulnerabilities reported.
- `npm run lint` — completed; five non-blocking Fast Refresh warnings in `src/components/evilcharts/ui/recharts-chart.tsx`.
- `npx playwright test tests/sandbox-feed.spec.ts tests/mixed-feed.spec.ts tests/showcase-cases.spec.ts --reporter=line` — could not execute: managed-environment Chrome processes aborted during launch (`SIGABRT`) before test code ran. This is an environment limitation, not a branch assertion failure.
