# Code Standards

> Supplementary synthesis — see the authority note at the top of
> [`project_overview.md`](project_overview.md). Path-scoped `apps/web/AGENTS.md`
> and `apps/api/AGENTS.md` remain authoritative for their trees;
> `docs/project-context.md` remains authoritative repo-wide.

## TypeScript Conventions (`apps/web`)

- **Strictness**: not enforced via `tsconfig` (no explicit `strict`/
  `noImplicitAny`); enforced instead via lint — `any` is banned by oxlint's
  `typescript/no-explicit-any` rule. Use `unknown` and narrow it.
- **`type` over `interface`** in observed code, though `apps/web/AGENTS.md`
  phrases the rule as "interface or type." `type` is used for named/reused
  shapes; inline object-type literals for one-off component props.
- **Export style**: named exports for components/hooks/utilities (including
  multiple exports per file forming one feature); default export reserved
  for a file's single page/app-root component.
- **Presentational-component rule**: chart/graph/table components receive
  data only through typed props and never fetch/transform data themselves;
  fetching and data shaping live in hooks (e.g. `useAgentRun`) or `src/lib`.

## Component & File Structure (`apps/web`)

- Naming splits by directory: `src/components/ui/*` (shadcn-generated) uses
  **kebab-case**; `src/components/console/*` and top-level page components
  under `src/` use **PascalCase**.
- Directory layout: `components/` (shared), `components/console/` (domain),
  `components/ui/` (shadcn primitives), `hooks/` (shadcn-only, project hooks
  live in `lib/` instead), `lib/` (hooks + utilities), `references/` (frozen
  visual references), `templates/` (page templates), top-level `src/` (page
  components + Vite entries).
- One primary component per file; small unexported helper components may be
  colocated with the component they serve.
- Tests: flat `apps/web/tests/` (Playwright specs, `base.ts` shared
  fixtures), no unit-test runner.

## Styling Rules (`apps/web`)

See [`ui_context.md`](ui_context.md) for the full token/typography system.
Summary rules: Tailwind v4 CSS-first config (no `tailwind.config.*`); the
console is dark-mode-only by design, except the Overview route's separately
scoped light+dark theme (`src/dashboard-theme.css`, scoped to
`:root[data-app-theme="dashboard"]`); class merging via the `cn` npm package,
re-exported from `src/lib/utils.ts`; variants via `class-variance-authority`.
**The Payments design system is frozen** — see the Change Checklist and
Review Ownership rules in `ui_context.md`; do not approximate an approved
token with the nearest utility class.

## Python Conventions (`apps/api`)

- **Docstrings**: Google-style throughout (module docstrings; `Args:`/
  `Returns:`/`Raises:`/a project-specific `Side effects:` section). Every
  new/materially-changed public helper needs one — enforced by
  `make api-docstring-lint` and Ruff's `D103`.
- **Type hints**: universal, including private helpers; modern union syntax
  and PEP 585 generics throughout.
- **Models**: every API request/response is a strictly-typed Pydantic
  `BaseModel` with restrictive `model_config` (`allow_inf_nan=False`,
  `str_strip_whitespace=True`, and `extra="forbid"` at the showcase
  boundary) and per-field `Field(min_length=..., max_length=..., pattern=...)`
  bounds.
- **Error handling**: a custom exception hierarchy per feature (subclassing
  `RuntimeError`), converted at the HTTP boundary to `HTTPException`s with
  stable, redacted string codes — never a raw exception message or
  traceback.
- **Inline comments**: a `#` comment above every non-obvious block
  (workarounds, provenance notes, broad-except justifications).
- **Naming**: private module-level helpers prefixed `_`.
- **Linting/formatting**: Ruff `extend-select = ["I", "S"]`, zero per-file
  ignores on `server/` (notebooks/scripts have a short, explicitly-justified
  ignore list for provider-call rules like `S310`/`S603`/`S607`); `ruff
  format` enforced repo-wide for API code/tests/scripts.
- **Tests-first**: write the endpoint's pytest tests before its logic, keep
  them green (`apps/api/AGENTS.md`).
- **No ORM/raw SQL today**: when persistence is added (per proposed
  ADR-009), all access goes through a repository with parameterised
  queries — route handlers never contain raw SQL.

## ADR Documentation Standard (`apps/api/docs/adr/`)

Every ADR follows the template in `0000-template.md`: Status/Date/Owner/PRD
revision/Backlog task/Related decisions/Repository scope header; Context and
evidence; Decision to be made; Constraints; Options considered; Proposed
decision; Contracts and invariants; Verification; Consequences and
ownership; Open questions; Acceptance record. **"An author or coding agent
proposing the ADR must not fill in approval on someone else's behalf."**
Status values used in practice: Proposed, Accepted, Accepted for
(preparation/scoped preparation) only, Accepted-superseded-in-part. Supersede
an accepted record rather than rewriting history.

## Notebook & Data-Science Standard (`notebooks/`, `apps/api/modelling/`)

Governed by `notebooks/README.md` and `notebooks/notebook-plan.md`, and by
the project-wide rule that every new/materially-changed public helper needs
a truthful docstring and every non-obvious boundary needs an adjacent `#`
comment (enforced for Python via Ruff `D103`; reviewers judge comment
quality manually). Full detail is in
[`ai_workflow_rules.md`](ai_workflow_rules.md#notebook-and-experiment-conventions);
key coding-standard points:

- **Kernel**: the dedicated "Fraud Compliance Agent API (Python 3.13)"
  kernel, running from `apps/api/.venv` (`uv sync` in `apps/api`, then `make
  api-notebook-kernel`). Running outside it breaks Notebook 08's `modelling`
  imports.
- **Determinism**: a clean kernel must run top-to-bottom with no hidden
  state, no manual edits, and an explicit reproducible seed.
- **Structure by group**: 01–05 step-based evidence/probe structure; 06–08
  CRISP-DM (Business Understanding → Data Understanding → Data Preparation →
  Modelling → Evaluation → Deployment → references/review); 09 step-based
  investigation-evaluation/safety-test structure; 10 monitoring/champion-
  challenger structure (explicitly not a full CRISP-DM notebook).
- **Migration pattern**: once an approach is accepted, its reusable logic
  moves into tested modules under `apps/api` (worked example: `apps/api/modelling`,
  parameters in `config/fast-path-model-training.v1.json`) and the notebook
  becomes a thin runner. `apps/api/tests/test_notebook_08_runner.py` enforces
  Notebook 08 has no function/class defs, no estimator/metric/seed/digest
  logic, and no hard-coded report path.
- **Mechanical enforcement**: `make notebook-policy-check` (output-free
  source notebooks, portable paths, documented kernel metadata,
  Markdown-before-every-code-cell); `make notebook-policy-fix` (clears
  outputs/normalises kernel metadata, never executes/reads data); `make
  notebook-status` (inspects all 10 without opening datasets/provider
  payloads); `make notebook-synthetic` (runs only Notebook 08's synthetic
  fixture, writes to a temp dir).

## Data-Pipeline Quality Gates (`docs/proposals/data-engineering-showcase-plan.proposed.md` — items A1/A3 implemented, A2 folded into A1)

- `scripts/build_sparkov_mechanics_dataset.py` fails on an unapproved
  column, missing values, out-of-range features, a non-binary target, a
  non-reconciling row count, or a non-chronological partition; the build
  manifest records passed checks, source row counts, and each partition's
  time span.
- `apps/api/tests/sparkov_fixtures.py` generates seeded Sparkov-shaped data
  plus seven deliberately broken variants, each asserted to fail for the
  right reason — run on every clean checkout via `make data-check`.
- No orchestrator, warehouse, or feature store is in scope (deferred per
  PRD §9.1/§14.4).

## Contract / Fixture / Config Status Naming Convention

A consistent filename convention signals approval state across the repo:
`*.proposed.*` or `*.candidate.*` = not yet runtime-authoritative (lives
under `docs/proposals/` or `config/*.candidate.json`); `*.v1.*` (no
`.proposed`/`.candidate` suffix) under `docs/contracts/`, `fixtures/`, or
`config/` = accepted, versioned, and frozen by drift tests. The lifecycle is
always **candidate/proposed → ADR resolution → accepted** — "the draft and
an accepted copy must never coexist as competing sources of truth"
(`docs/proposals/README.md`). Applying a lower-effort version of the same
rule to Markdown filenames: use uppercase only for GitHub/tooling-recognised
conventional files (`README.md`, `AGENTS.md`, `CLAUDE.md`, `SECURITY.md`,
`LICENSE`); every other Markdown file is lowercase kebab-case
(`docs/README.md`'s naming convention).
