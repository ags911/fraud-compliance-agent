# API instructions

Read the [repository context](../../docs/project-context.md) first. This file
adds only rules that are specific to `apps/api`.

- Python is pinned to 3.13 in `.python-version` (`>=3.11` is supported). Use
  `uv`; change `uv.lock` together with `pyproject.toml`.
- Focused checks, run from the repository root: `make api-lint`,
  `make api-docstring-lint`, `make api-test`, and `make data-check`.
- Do not modify `vendor/`, the pinned Arbiris SDK submodule, without an explicit
  SDK pin or upgrade task.
- The API owns operational facts and domain behaviour and talks to the web app
  only through accepted contracts in `docs/contracts/`. The current routes are
  demo routes, not the target operational API.
- Every new or materially changed public helper needs a docstring (inputs,
  outputs, assumptions, errors, side effects), and every non-obvious block needs
  an adjacent `#` comment. Use the `$python-notebook-documentation` skill.
- Tests live in `tests/`. Data-path tests use the seeded generator in
  `tests/sparkov_fixtures.py`; a test never reads the real Sparkov corpus.
- `GET /demo/model-summary` serves only an approved-mode report that matches
  `docs/contracts/model-training-contract.v1.json`. Do not loosen that guard or
  edit the report by hand.
- Only an approved-mode run of Notebook 08 may write
  `docs/proposals/fast-path-model-release.candidate.json`. Synthetic and gated
  runs must write elsewhere.
