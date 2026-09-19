# Fraud Compliance Agent — Project Context

This is the tool-neutral, durable project brief for every human and AI
contributor. Read it completely before changing code, contracts, notebooks, or
product documentation. It states stable constraints; it is not a substitute for
an accepted contract or for the current delivery backlog.

## How to use this context

- Keep this file focused on rules that apply to every session: architecture,
  safety, ownership, common commands, and durable product decisions. It should
  remain short enough to read and follow in full.
- Put task-specific procedures and detailed reference material in the linked
  plans, contracts, path-scoped instructions, or reusable skills—not by
  duplicating them here or in `AGENTS.md`/`CLAUDE.md`.
- Before editing, inspect the relevant code and its callers, read the
  task-specific documents in the table below, and state any unresolved
  assumption. Make the smallest cohesive change that satisfies the task; avoid
  opportunistic refactors, new dependencies, or invented product semantics.
- When a stable decision changes, update this canonical context and its source
  document together. Put mutable delivery status in the backlog, PRD, or an
  ADR, rather than growing this file into a work log.

## What we are building

Fraud Compliance Agent is a provider-neutral payment-risk decision engine and
operator console. It demonstrates an auditable flow from transaction signals to
a simulated outcome, evidence, oversight, and review.

It is a recruiter/employer showcase: production-shaped in its architecture,
documentation, testing, safety boundaries, and user experience, but not a
production payment or compliance service. Optimise for a credible, complete
demonstration in a bounded build, rather than implementing every production
integration, control, or operating process.

The product is not a claim of production fraud-detection performance and must
not present synthetic demo data as live customer, Plaid, or model output.

## Current delivery status

- The root monorepo is the active project home.
- `apps/web` is a React/Vite operator-console prototype with approved visual
  reference material and deterministic demo scenarios.
- `apps/web` also holds a standalone shadcn dashboard prototype
  (`dashboard.html`) with its own theme, synthetic data only. It is a candidate
  replacement for the Overview page, not yet routed into the app.
- `apps/api` is a FastAPI Phase 0 demo. Its current public routes and scenario
  fixtures are not yet the approved target operational API.
- The public showcase deployment target is Azure Static Web Apps for the React
  console and Azure Container Apps Consumption with scale-to-zero for the
  FastAPI demo API. Neither is configured yet; the deployment remains
  synthetic-only, database-free, and subject to free-grant/budget review.
- The project has an accepted **mechanics-only** Sparkov benchmark contract and
  a read-only portfolio summary endpoint. They demonstrate reproducibility and
  evaluation only; neither is a model-serving, payment-decision, or production
  data capability.
- The candidate consolidated PRD is [`docs/product/prd.md`](product/prd.md).
- The proposed fast-path model technical record is
  [`docs/proposals/fast-path-fraud-model-technical-spec.md`](proposals/fast-path-fraud-model-technical-spec.md).
- The single active candidate delivery plan is
  [`docs/product/implementation-plan.md`](product/implementation-plan.md).

These documents are candidate/proposed until explicitly approved. Do not
silently turn proposed endpoints, thresholds, models, scenarios, hosting, or
delivery stages into implemented product facts.

Current delivery status belongs in the issue tracker/backlog when one is
adopted. Until then, record material decisions and approval state in the PRD or
an ADR rather than in this file.

## Architecture boundaries

- `apps/web` owns browser UI, client state, accessibility, and browser tests.
- `apps/api` owns operational facts, domain behavior, persistence, risk routing,
  authority, oversight, integrations, and backend tests.
- `docs/contracts` owns versioned API and event contracts shared between apps.
- `fixtures` will own canonical deterministic scenario fixtures once specified.
- `notebooks` contains reproducible, sanitised feasibility work only. Once an
  approach is accepted, its reusable logic moves into tested modules under
  `apps/api` and its parameters into a versioned file under `config`, leaving
  the notebook as a thin runner: `apps/api/modelling` and
  `config/fast-path-model-training.v1.json` are the worked example. Such an
  offline library is not part of the served API and `apps/api/server` must not
  import it.
- `infra` contains local orchestration and deployment configuration, never
  application domain logic.

Web and API communicate only through accepted versioned contracts and generated
clients/types derived from them. Never import API internals, database models, or
secrets into the web app; never add browser rendering/UI logic to the API.

OpenAPI describes HTTP operations. Version SSE events and domain JSON schemas
separately when streaming or non-HTTP contracts are introduced. Any contract
change requires compatible API tests, generated/client type updates, and a
frontend consumer check.

## Product and safety rules

- Payment actions are simulated unless an approved contract explicitly says
  otherwise.
- Preserve the separation between recommendation, authority, oversight, review,
  action, and evidence. A model or LLM can recommend; it cannot independently
  make a real payment decision.
- Deterministic controls precede any model-assisted assessment. Model
  thresholds, calibration, and promotion are explicit approved decisions, not
  defaults an agent may invent.
- Never show invented trends, time series, accuracy, precision, or
  false-positive figures. A chart or trend appears only when it comes from
  recorded or approved data (for example the Sparkov benchmark, labelled as
  such, or approved fixtures scored by the decision engine). Zero, empty, and
  `Unavailable` states are correct until then.
- Any assistant or "Explain" surface is labelled a preview, answers only from
  figures already on screen or from an accepted contract, cites its source, and
  refuses everything else. A free-text or model-backed assistant needs an entry
  in the PRD's showcase technology and service register first.
- Preserve `pending`, failure, and replay/idempotency states; do not report them
  as completed decisions.
- Treat provider data, tokens, raw errors, personally identifying information,
  and hidden chain-of-thought as sensitive. Do not commit secrets, expose raw
  provider errors, or use wildcard CORS for authenticated/sensitive APIs.
- Free-tier hosting is suitable only for synthetic demos, never as a production
  reliability or sensitive-data decision.
- Do not add a managed product, external API, or infrastructure service merely
  to look production-like. It needs a named showcase use case, an owner, a
  synthetic-data boundary, and a removal/fallback path in the PRD's showcase
  technology and service register.

## Scenario and data rules

The target scenario set is S01–S08: trusted pass, high-risk hold, APP-drain
hold, ambiguous challenge/investigation, outage hold, review conflict,
idempotency/retry, and pending-correction/replay. Legacy A–F demo scenarios are
not automatically equivalent to that target set; document any mapping before
reusing them.

Plaid sandbox data may be used only through an approved mapping and a sanitised,
reproducible notebook/fixture workflow. It must never silently replace a chosen
scenario with generic provider data.

Plaid Sandbox is integration and feature-feasibility evidence, not a labelled
fraud-training corpus. The accepted Sparkov dataset is limited to
mechanics-only benchmark evaluation; it cannot support a production-performance
claim, threshold, runtime score, or payment action.

Stripe/Radar is not yet a selected provider integration. A Radar score, risk
level, block, or review outcome is Stripe's payment-specific prediction or
policy result, not independent fraud truth and must never be used as a model
training label. Stripe test-mode/Sandbox outcomes are scripted test cases, not
training data. Future delayed labels may be considered only for a correlated
Stripe payment with an accepted lineage contract, approved data access, a
maturity window, provenance, and bias/leakage review. An Early Fraud Warning
or fraud-related dispute is evidence requiring that review, not an automatic
ground-truth label.

## Design-system rules

`apps/web/work/payments-design-concept.html` is the approved visual source for
the Rules Performance reference page. The frozen reference implementation and
the shared Payments design-system documentation/tokens must not be changed as a
side effect of feature work. New UI follows the documented tokens and reusable
components; do not approximate approved values with the nearest utility class.

The standalone dashboard prototype's theme (`src/dashboard.css`) is deliberately
separate from the frozen Payments tokens and is loaded only by its own entry, so
it cannot change the approved pages. Do not import it elsewhere or copy Payments
tokens into it.

For dashboard screen, chart, navigation, or shared UI-component work, use the
`$payments-dashboard-consistency` skill. It records the project chart/tooltip
conventions and requires screenshot-based visual validation, including hover
states.

For Python source and Jupyter notebook work, use the
`$python-notebook-documentation` skill. It requires inline `#` comments above
non-obvious logical blocks and docstrings that explain inputs, outputs,
assumptions, errors, and side effects.

This is a project-wide review rule for Python and notebooks: every new or
materially changed public/reusable helper needs a truthful docstring, and every
non-obvious data, provider, persistence, or safety boundary needs an adjacent
`#` comment. `make check` and CI enforce public-function docstrings with Ruff
(`D103`); reviewers must still judge comment quality and the completeness of
docstring inputs, outputs, assumptions, errors, and side effects.

Notebook work must be linear, reproducible, and safe to review: start with the
decision question, status/non-goals, inputs, data boundary, environment, and
expected sanitised output; make each code cell explain its purpose and run from
a fresh kernel without hidden manual state; use deterministic seeds where
randomness is involved; and end with findings, limitations, unknowns, and a
`proposed` decision recommendation. Never commit raw provider data, secrets,
identifiers, or large/model artefacts in outputs. The full notebook quality
standard, structure by notebook, kernel, and execution commands live in
[`notebooks/README.md`](../notebooks/README.md).

## Required reading by task

| Task | Read first |
| --- | --- |
| API route, request/response, state, or event work | Accepted contract in `docs/contracts`; then the PRD and applicable API plan section |
| Web screen or interaction work | Console plan, design-system documentation/tokens, and applicable component/reference page |
| Risk routing, scenarios, model, or data work | PRD, active delivery plan, and fast-path model technical specification |
| Plaid, notebooks, fixtures, or enrichment work | PRD data/notebook sections and applicable approved mapping/contract |
| Infrastructure or deployment work | PRD hosting section and `infra/README.md` |

If the required contract or approval does not exist, stop before inventing its
semantics. Propose the contract or ADR change instead.

## Verification and working conventions

- Preserve both copied applications' existing behavior while the monorepo is
  being integrated.
- Use `make check` for the full repository verification before handoff. Use
  `make web-build`, `make api-lint`, `make api-test`, or
  `make api-notebook-lint` for focused feedback while working.
- Review the final diff for scope, contract, safety, and generated-file
  mistakes; report the verification actually run and any known limitation.
- `make check` also enforces `ruff format` on API code, tests, and scripts
  (notebooks excluded), Ruff's security rules (`S`) on the API, and a lint ban
  on `any` in the web app. Fix findings; a new ignore needs a written reason.
  Typed-schema, tests-first, and presentational-component rules live in
  `apps/api/AGENTS.md` and `apps/web/AGENTS.md`.
- Do not commit dependencies, local environments, caches, generated test
  output, or secrets.
- Do not modify `apps/api/vendor` without an explicit SDK pin/upgrade task.
- More-specific `AGENTS.md` or `CLAUDE.md` files closer to edited files take
  precedence for files in their scope. Product and contract authority still
  follows the documents named above.
