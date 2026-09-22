# Repository agent instructions

Before doing any work in this repository, read the six files in
[`context/`](context/) in this exact order. They are the single canonical
source of stable project, architecture, product, safety, and delivery
instructions for all agents:

1. [`context/project_overview.md`](context/project_overview.md)
2. [`context/architecture.md`](context/architecture.md)
3. [`context/code_standards.md`](context/code_standards.md)
4. [`context/ai_workflow_rules.md`](context/ai_workflow_rules.md)
5. [`context/ui_context.md`](context/ui_context.md)
6. [`context/progress_tracker.md`](context/progress_tracker.md)

Then read any feature spec under
[`context/feature_specs/`](context/feature_specs/) relevant to the task,
plus any scoped `AGENTS.md` or `CLAUDE.md` closer to files being changed.
Do not duplicate or override project rules in this file; update the
relevant `context/` file instead.

Before implementing a new feature spec, follow
`context/ai_workflow_rules.md`'s core rules: never rewrite existing working
logic unless a feature spec explicitly commands it; always reuse existing
utility functions, hooks, and UI primitives already in the repo before
writing new ones; and work on exactly one feature spec at a time.

The prior canonical document, `docs/project-context.md`, and the legacy
PRD/ADR/proposal corpus it pointed to, are archived under
[`docs/archive/`](docs/archive/) and are historical only — do not read them
for active development. `context/progress_tracker.md` carries their
distilled decision log forward.
