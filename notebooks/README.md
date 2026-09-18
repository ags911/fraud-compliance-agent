# Notebooks

Notebooks are reproducible Phase 0 discovery artifacts, not production
pipelines. They examine Plaid Sandbox evidence, mapping, feature feasibility,
enrichment, corpus/label viability, evaluation design, and only later approved
model/investigation evaluation. Notebooks must not contain access tokens,
secrets, PII, live account exports, or production ingestion logic.

## Conventions

- Name notebooks in the approved execution order. The current sequence is
  `01-plaid-sandbox-source-inventory.ipynb` through
  `10-model-monitoring-and-champion-challenger.ipynb`; names and gates are defined in
  [`NOTEBOOK-PLAN.md`](NOTEBOOK-PLAN.md).
- Begin with purpose, inputs, expected outputs, source revision, and how to run
  it. Record the Git commit in the matching experiment record.
- Use a local `.env` or approved secret manager for credentials; never place a
  token, raw payload, or account identifier in a cell or output.
- Clear outputs before commit. Commit only sanitised samples small enough to
  review, or a manifest pointing to approved secure storage.
- Once an approach is accepted, move reusable logic and validation into
  `apps/api`; keep the notebook as an explanatory, reproducible record.

See [`docs/data-governance.md`](../docs/data-governance.md) and
[`docs/experiments/README.md`](../docs/experiments/README.md). The ordered
Phase 0 workstream is defined in [`NOTEBOOK-PLAN.md`](NOTEBOOK-PLAN.md).

## Quality standard

Treat each notebook as a small, reviewable research report—not as an informal
scratchpad or a production runtime.

- Start with the decision question, decision owner, status, non-goals, inputs,
  permitted data class, expected sanitised outputs, reproduction command, and
  current Git revision. List environment-variable names only.
- Put Markdown before each meaningful code cell so a reviewer can understand
  its purpose, inputs, outputs, assumptions, and safety boundary without
  reading ahead. Use concise `#` comments above non-obvious code blocks and
  truthful docstrings for reusable helpers, including inputs, outputs, errors,
  and side effects.
- A clean kernel must be able to run cells top-to-bottom without hidden state,
  manual edits, local paths outside the documented setup, or reliance on a
  prior cell being re-run out of order. Make randomness reproducible with an
  explicit seed and record relevant package/config versions where they affect
  a result.
- Keep computation small and purposeful. Move accepted reusable transforms,
  validation, and runtime behaviour into tested API modules; notebooks retain
  the explanation, evidence, and experiment record.
- Display only aggregated or sanitised, reviewable outputs. Clear transient
  outputs before committing; do not save raw provider payloads, identifiers,
  credentials, downloaded corpora, trained models, or charts that disclose
  sensitive values.
- Cite datasets, external methods, and source material near their use. Label
  assumptions, unsupported fields, and unavailable data as such—never fill a
  gap with an inferred value or production-performance claim.
- Finish with findings, limitations, availability/unknowns, links to the
  experiment record and any proposal/manifest, and a recommendation explicitly
  marked `proposed`. A notebook cannot approve or deploy a contract, model,
  threshold, payment action, or production champion.

## Current notebook set

| Status | Notebooks |
| --- | --- |
| Completed source observation | 01 — Plaid Sandbox source inventory; 02 — Plaid Sandbox lifecycle probes |
| Proposal prepared; review pending | 03 — canonical mapping; 04 — feature availability; 05 — enrichment design; 06 — Sparkov corpus/labels |
| Proposal prepared; review pending | 07 — leakage/evaluation design |
| Mechanics-only Sparkov evaluation complete; review pending | 08 — fast-path model |
| Draft, post-Phase-0 gated evaluation | 09 — slow-path investigation; 10 — model monitoring and champion/challenger |

Each notebook from 01–10 has a matching experiment record in
[`docs/experiments/`](../docs/experiments/). A gate means the notebook may be
reviewed and prepared now, but it must not manufacture missing evidence or run
model work before the plan's required approval.

## Notebook structures

Use the structure that suits the decision being made; do not force a modelling
template onto source-evidence or safety-evaluation work.

| Notebooks | Required structure |
| --- | --- |
| 01–05 | Step-based evidence/probe structure |
| 06–08 | CRISP-DM: Business Understanding, Data Understanding, Data Preparation, Modelling, Evaluation, Deployment, then references/review |
| 09 | Step-based investigation evaluation and safety-test structure |
| 10 | Monitoring/champion-challenger evaluation structure; not a full CRISP-DM model-training notebook |

## Safe pipeline commands

Run `make notebook-policy-check` to enforce output-free source notebooks,
portable paths, the documented Python 3.11 kernel metadata, a Markdown
explanation immediately before every code cell, and the required review
narrative. `make notebook-policy-fix` may be used to clear transient outputs
and normalise kernel metadata; it never executes a cell or reads data.

Run `make notebook-status` to inspect all ten notebooks in order. It does not
open datasets, environment-variable values, raw notebook outputs, provider
payloads, or model artifacts. It reports source observations separately from
proposed artifacts and accepted-contract gates.

Run `make notebook-synthetic` only to execute Notebook 08's synthetic
mechanics fixture. It renders no committed outputs and writes any execution
result to a temporary directory. It never runs Plaid, approved-mode, or other
real-data notebook paths. An accepted contract and the reviewed process remain
required for any real-data execution.

## Kernel

Open these notebooks with the dedicated **Fraud Compliance Agent API (Python
3.11)** kernel. It runs from `apps/api/.venv`, so it has the project’s approved
notebook dependencies without relying on a global Python installation.

After cloning or recreating the environment, run `uv sync` in `apps/api`, then
run `make api-notebook-kernel` from the repository root. Select the named kernel
in VS Code or Jupyter before running a notebook.
