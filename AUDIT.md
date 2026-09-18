# Repository Audit

**Audit date:** 18 September 2026  
**Scope:** Correctness, security, compliance and safety claims, reproducibility,
test coverage, and delivery readiness.  
**Method:** Read-only source review plus the repository's documented checks,
frontend contract tests, browser tests, request-model probes, and dependency
advisory scans.

## Executive summary

The project has strong product thinking and unusually explicit safety
boundaries, but the implementation and delivery controls do not yet enforce
all of those intentions. The most important issues are an unsupported
cryptographic-verification claim in the UI, a broken submodule layout,
machine-dependent repository inventory generation, and unauthenticated
resource-consuming API routes that must not be exposed publicly in their
current form.

The repository is suitable as active prototype work, but it is not currently
ready to be treated as a reproducible, publicly deployable showcase. Resolve
the P1 findings and demonstrate a clean-clone CI run before expanding the
feature surface.

## Remediation update

The repository was hardened after this audit. The implementation now:

- describes records as signature-present and explicitly not verified, while
  exposing only a sanitised record summary to the browser;
- declares the SDK from the root `.gitmodules` file and pins the reviewed SDK
  checkout at `27844250f926fe0ade2250dd99975c7283defc80`;
- derives the repository inventory from Git's tracked and non-ignored
  candidate files, excluding generated and vendored content;
- rejects non-finite and out-of-range request data, while deliberately leaving
  negative amount semantics for the product contract to resolve;
- requires a successful HTTP response and terminal SSE event, reports malformed
  or truncated streams as failures, and supports user cancellation;
- bounds local execution with configurable concurrency and timeout controls;
- disables external LLM investigation by default so public/default demo runs
  cannot spend provider quota without an explicit deployment opt-in;
- ignores the local Stripe dashboard captures and keeps them out of the
  candidate source set; and
- runs web lint, the payments design contract, the production build, browser
  tests, API lint, documentation lint, and API tests through `make check` and CI.

Notebook and documentation follow-up also consolidated the competing delivery
plans into one active candidate plan, removed the obsolete ML visualisation
wishlist, cleared all committed notebook outputs, normalised Python 3.11 kernel
metadata, and added a CI-enforced notebook source policy. The synthetic
Notebook 08 runner now isolates generated reports as well as cell output, so it
cannot replace the reviewed Sparkov mechanics artifact.

The original findings below are retained as the point-in-time evidence that
motivated those changes. Remaining release work is narrower: record the SDK as
a gitlink in the repository's first commit, obtain formal PRD/contract
approval, add trusted-key signature verification if the product requires a
verified claim, and enforce authentication/rate limiting/retention at the
deployment edge before any public live-provider release.

Post-remediation verification on 18 September 2026 completed successfully:
`make check` passed, including 43 passing Playwright tests with one intentional
mobile-only skip, 21 passing API tests, the production build, payments design
contract, repository-inventory check, and Python lint/docstring checks. Web
lint is clean; its Fast Refresh rule explicitly permits the named stable
variant, hook, transition, and scenario exports used by shared components.

## Findings

### P1 — The UI claims cryptographic verification without verifying anything

`apps/web/src/components/console/RecordPanel.tsx:46-57` displays
"Signature verified" whenever a record exists. No client or API verification
is performed; the API reads JSON from disk and returns it.

This is a material audit-integrity misrepresentation. Verify the record hash
and signature using a trusted public key, returning an explicit verification
result, or relabel the state as "Signed record — verification not performed."

### P1 — A clean checkout and CI run are not reproducible

The SDK submodule declaration is stored at `apps/api/.gitmodules`, while Git
only recognizes the root `.gitmodules` file for the root repository. The SDK
directory is currently ordinary untracked content, although the application
and documentation assume a pinned submodule.

A fresh root checkout will not materialize the required dependency as
documented. Move the declaration to the repository root and commit the SDK as
a real gitlink at an explicitly reviewed revision.

### P1 — The generated repository inventory is machine-state-dependent

`docs/repository-inventory.md:23-34` contains ignored `__pycache__/*.pyc`
files. `scripts/generate_repository_inventory.py:22-42` excludes `.venv` but
not `__pycache__`, and scans selected filesystem directories rather than the
tracked-file set.

A clean CI clone will produce a different inventory and can fail before the
test suite runs. The claimed complete inventory also omits important manifests,
lockfiles, app tests, app documentation, and top-level application files. Base
the inventory on tracked project files, explicitly exclude generated files,
and add a clean-checkout test for the generator.

### P1 before public deployment — Resource-consuming routes are unauthenticated and unbounded

`apps/api/server/main.py:209-235` exposes `/run` and `/run/preset` without
authentication, rate limiting, concurrency control, request-size limits, or an
output retention policy. These routes can invoke the pipeline/provider and
generate local records.

This is acceptable only for isolated local demonstration. A public deployment
would permit provider-cost, disk, and compute exhaustion. Put a bounded demo
control in front of the routes or replace live provider execution with
deterministic precomputed scenarios for the public showcase.

### P2 — Invalid financial inputs are accepted and can enter signed records

`apps/api/server/models.py:68-85` places no domain constraints on amounts,
balances, history length, velocity, identifier lengths, or
`account_balance_pct_remaining`.

A validation probe accepted `amount=-1`, `velocity_6h=-2`, and
`account_balance_pct_remaining=5`; it also accepted `NaN`. Add finite-number
constraints, appropriate domain ranges, bounded collections, identifier length
limits, and tests for rejected edge cases.

### P2 — HTTP failures and truncated streams can be reported as successful runs

`apps/web/src/lib/useAgentRun.ts:52-101` does not check `response.ok`, does not
require the terminal SSE `done` event, ignores malformed events, and sets the
state to `done` whenever iteration ends. The initial `fetch()` calls also occur
outside `consume()`'s error handler.

A 404, 422, malformed response, or prematurely closed connection can leave the
UI idle or display a completed run. Handle fetch and HTTP errors, require an
explicit terminal event, distinguish incomplete streams, and cover these cases
with client tests.

### P2 — Account-derived Stripe dashboard captures are candidate commit material

`apps/web/Radar – Instagram – Stripe [Test].html:2` embeds a specific Stripe
account identifier. The capture is accompanied by approximately 27 MB of
copied third-party dashboard assets.

This conflicts with the project's sanitised/provider-data boundary, creates
licensing and supply-chain noise, and causes the linter to scan minified
third-party bundles. Replace the captures with sanitised screenshots or
purpose-built references, then exclude raw browser captures from Git.

### P2 — Required web quality gates are not enforced, and one currently fails

`Makefile:3-6` and `.github/workflows/verify.yml:12-28` build the frontend but
do not run its linter, payments design contract, or Playwright suite.

`npm run check:payments-design` currently fails because
`apps/web/src/ModelBenchmark.tsx:130` uses a local `h-[248px]` recipe instead
of an approved Payments contract. Add the web checks to both `make check` and
CI after correcting the existing violation. Configure lint scope so saved or
vendor assets cannot bury application findings in third-party warnings.

## Verification performed

- `make check`: passed on the current machine.
- API tests: 1 passed, with one dependency deprecation warning.
- Playwright on a clean port: 33 passed and 1 intentionally skipped.
- Payments design contract: failed on `ModelBenchmark.tsx`.
- npm production dependency audit: no known vulnerabilities.
- Python environment audit: no known vulnerabilities; the local `arbiris` and
  application packages could not be independently audited through PyPI.
- Notebook status inspection: completed without executing notebooks or reading
  provider data.
- Git state during audit: the repository had no commits and 496 untracked
  files, so there was no committed baseline or historical diff to review.

## Recommended remediation order

1. Correct the signature-verification claim.
2. Repair the root submodule declaration and prove a fresh checkout can build.
3. Make repository inventory generation deterministic on a clean clone.
4. Decide and enforce the public-demo execution boundary for `/run` routes.
5. Add request-domain validation and streaming failure semantics with tests.
6. Remove or sanitise the Stripe dashboard capture.
7. Promote web lint, design-contract, and browser tests into `make check` and CI.

## Overall assessment

This is not a fundamentally disorganized project. Its architecture notes,
product boundaries, data-governance rules, and proposed-vs-accepted distinction
are better than those of many prototypes. The weakness is that repository
mechanics and runtime behavior do not consistently enforce those written
standards. In practical terms, it is a thoughtful prototype with a brittle
delivery shell—not yet a trustworthy release candidate.
