# AI-ready template pilot log

Pilot of [ags911/ai-repo-template](https://github.com/ags911/ai-repo-template) pinned to tag `v1.0.0`.
Goal: add the verification layer, find where it does not fit a real project, report friction.
Not a conversion of this repo into the template.

## Preflight (2026-11-12)

- **Other sessions:** the sessions named in the brief (75ab3d50, ebdb1351, d13a8172) were idle, not busy.
  Other sessions in this repo or in the template (3af0e43e, c24442e0, 8dccb0a2) were also idle. Shared notes folder empty.
- **Branches:** the main checkout is on `docs/fix-context-authority` (clean, 14 behind origin) and was not used.
  The pilot worktree was cut from `main` at `eecddf0`.
- **Baseline:** `make check` on `main` at `eecddf0`. The first run failed once in `web-test`:
  `tests/mixed-feed.spec.ts:240` ("a tab hidden for two minutes stops its feed without switching Live off"),
  expected `Stopped · 5`, got `5 / 200`. The test passed when run alone. A full re-run passed:
  exit 0, 230 s total, web-test 169 passed (about 3.1 min), API pytest 584 passed, 6 skipped.
  - Classification: repo problem, timing-sensitive browser test. Not yet confirmed flaky. Not a template problem.
  - Decision: the user chose to re-run the full baseline before starting. It came back green.

## Step 1: read-up (how checks run today)

| Check | Where | How it runs | Time (approx) |
|---|---|---|---|
| Web lint | `apps/web` | `npm run lint` (oxlint) | seconds |
| Web build | `apps/web` | `npm run build` (`tsc -b && vite build`) | not timed separately |
| Web test | `apps/web` | `npm test` (Playwright, desktop and mobile projects) | about 3.1 min |
| API lint | `apps/api` | `uv run --frozen ruff check server modelling` | seconds |
| API format | `apps/api` | `ruff format --check server modelling tests ../../scripts` | seconds |
| Notebook lint | `apps/api` | `ruff check ../../notebooks ../../scripts` | seconds |
| Docstring lint | `apps/api` | `ruff check --select D103 ...` | seconds |
| Notebook policy | `apps/api` | `scripts/validate_notebooks.py` | seconds |
| API tests | `apps/api` | `pytest tests` (includes import smoke) | about 46 s |

- **Typecheck:** no separate script. `tsc -b` runs inside `build`.
- **Boundaries:** none in the Makefile. Boundary-style rules are covered by pytest files such as
  `test_modelling_boundaries.py`.
- **CI:** `.github/workflows/verify.yml` has five jobs.
  - `web` ("Web build") on `macos-14` (visual baselines are recorded on macOS), Node 22: `npm ci`, `npm run lint`,
    `npm run build`, `npm test`. Since at least 2026-11-10 it is cancelled before it starts on every run (see friction item 9).
  - `api` ("API checks") on `ubuntu-latest`, with the private SDK submodule and `uv sync --extra sdk`: the ruff, format,
    notebook, docstring and notebook-policy checks, the import smoke check and `pytest tests`.
  - `api-public` ("API checks (no private SDK)") on `ubuntu-latest`, `uv sync --frozen`: ruff, format check and `pytest tests`.
  - `container` ("API container image") and `infrastructure` ("Deployment configuration") on `ubuntu-latest`.
- **Python toolchain:** `apps/api/.python-version` is 3.13. `uv.lock` is present. `apps/api/vendor/arbiris-sdk` is an
  uninitialised submodule, so the optional `sdk` extra is off. The Makefile sets `SDK_EXTRA` only when the submodule is present.

## Friction log

| # | What happened | What I did | Type |
|---|---|---|---|
| 1 | `make check` failed once on a timing-sensitive Playwright test, then passed on re-run. | Re-ran the full baseline (green). Logged here. | Repo problem (likely flaky test; to confirm) |
| 2 | Template `ts` profile requires `lint`, `typecheck` and `test` scripts in `apps/web/package.json`. The repo has `lint`, `build` and `test` (Playwright). No `typecheck`. | Not changed yet. Decision needed in step 2. | Mismatch |
| 3 | Template `ts` profile runs `npm run test`, which here is Playwright (slow, browser-based). Putting it in every verify run would be heavy. | Not changed yet. Options to be proposed in step 2. | Mismatch |
| 4 | Template CI reads `apps/web/.nvmrc` through `setup-node`. The repo has no `.nvmrc`. The existing CI pins Node 22 directly. | Stop-and-ask point in the brief. Not changed. | Mismatch |
| 5 | Template `python` profile hard-codes `uv run --locked`. The brief says CI must use `uv sync --frozen`, and `mypy` is not a declared dependency of `apps/api`. The profile checks the whole `.` tree, but the Makefile checks selected directories. | Stop-and-ask point in the brief. Not changed. | Mismatch |
| 6 | Template `verify.yml` runs on `ubuntu-latest`. The repo's web tests need `macos-14` for stable visual baselines. | Not changed. Needs a decision in step 2 (the new workflow must not change `verify.yml`). | Mismatch |
| 7 | `.github/CODEOWNERS` is absent. The template's AGENTS.md and README assume one exists. | Noted; optional step 4. | Mismatch |
| 8 | The main checkout sits on `docs/fix-context-authority`, not `main`. The brief says to stop if another branch is checked out. | Pilot worktree cut from `main` instead. Main checkout left alone. | Process note |
| 9 | The `web` job in `verify.yml` never runs: GitHub cancels it with "The configuration 'macos-14-arm64-us-default' is not supported". Every `main` push since at least 2026-11-10 shows it cancelled, so web lint, build and tests have no CI coverage. Found while reviewing PR #77, whose own "Web build" check was cancelled the same way. | Not changed. The step 2 decision (new verify workflow on `ubuntu-latest`) avoids it. Moving the existing `web` job off `macos-14` needs its own PR. Item 6's macOS assumption needs revisiting with it. | Repo problem |

## Decisions (recorded 2026-11-12)

- ts tests: add a fast unit-test script for verify; keep Playwright out of verify. The new test dependency needs a named, approved package before it is added.
- apps/web/.nvmrc: add it, containing 22.
- New verify workflow runner: ubuntu-latest.
- python profile: drop mypy from the profile (needs the profile edit to be approved in the PR). Ruff and pytest stay.

Step 2 starts only after PR #77 is merged or declined.
