# Product and contract documentation

## Current locations

Shared product material now lives in `docs/product/`, regardless of its
candidate approval status:

- `product/prd.md` is the candidate consolidated PRD.
- `product/IMPLEMENTATION-PLAN.md` is the single active
  candidate delivery plan for the showcase and gated later increments.

This move establishes one discoverable source for cross-application product
planning; it does not approve either document. `apps/web/docs/design/` now
contains web-local design evidence only, and `apps/api/docs/` contains
API-local planning and ADR material. Do not maintain duplicate copies of a
ground-truth document.

`docs/contracts/` is already root-owned because it is the API/web integration
boundary.

## Document lifecycle

The repository has many Markdown files because it preserves source-snapshot
notes, experiment evidence, and review proposals. That history is useful, but
only a small subset is authoritative. Use this register when documents appear
to overlap:

| Material | Authority | Lifecycle |
| --- | --- | --- |
| `project-context.md` | Canonical repository guidance | Keep current; link to it rather than repeating it. |
| `product/prd.md` | Candidate product baseline | Promote once its approval record is complete. |
| `docs/contracts/` | Accepted integration contracts only | Change through an ADR and matching tests. |
| `product/IMPLEMENTATION-PLAN.md` | Candidate delivery planning | Keep one active plan; it may organise candidate work but cannot approve PRD, contract, or post-gate scope. |
| `docs/proposals/` | Non-binding review material | Promote accepted decisions; archive closed proposals. |
| `docs/experiments/` and `notebooks/` | Reproducibility evidence | Retain as evidence; do not treat it as product authority. |
| `audits/`, generated inventories, and standards | Point-in-time control evidence | Keep the current standard; date-stamped audit snapshots live in `audits/`; the inventory is a local, git-ignored report. |

Do not add another planning document when an existing canonical or active plan
can be updated. Approval status, owner, and supersession should be visible in
the document itself. Consolidation may remove superseded planning notes while
the PRD is still a candidate, but it must preserve experiment/review evidence
and must never be presented as approval.

## File naming

Use uppercase only for conventional files that GitHub or the agent tooling
recognise by name (`README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`,
`CHANGELOG.md`, `AGENTS.md`, `CLAUDE.md`). Name every other Markdown file in
lowercase kebab-case (for example `data-governance.md`). Apply this to new files;
rename an existing file only when it is otherwise being changed, and fix its
links in the same change.

## Shared engineering governance

- [`project-context.md`](project-context.md) is the durable, tool-neutral
  project context that both Codex and Claude Code must read before work.
- [`data-governance.md`](data-governance.md) defines safe, reproducible handling
  of provider data, fixtures, notebooks, and model artifacts.
- [`experiments/`](experiments/) contains reviewable experiment records until a
  dedicated tracking/registry system becomes necessary.
- [`proposals/`](proposals/) contains Phase 0 review artifacts. They are not
  runtime inputs or accepted API contracts; approved material is promoted into
  `contracts/` with an ADR and tests.
- [`../notebooks/NOTEBOOK-PLAN.md`](../notebooks/NOTEBOOK-PLAN.md) sequences
  the reproducible Plaid, data-feasibility, and evaluation-design work.
