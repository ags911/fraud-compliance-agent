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
- **CI:** `.github/workflows/verify.yml` has one job, `web`, on `macos-14` (visual baselines are recorded on macOS).
  It runs `npm ci`, `npm run lint`, `npm run build`. The API checks have no CI job in that file. It uses Node 22.
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

## Open decisions (waiting on the user)

- Step 2 items 2 to 6 above need the user's call before anything in `scripts/` or CI is added.
- Step 3 needs the user to say where the template's rules go in `context/`.
- Friction 1 needs confirmation that the Playwright test is flaky (and whether to log a repo issue).
