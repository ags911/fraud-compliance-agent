# Repository agent instructions

Before doing any work in this repository, read these two files in
[`context/`](context/) in this order:

1. [`context/project_overview.md`](context/project_overview.md)
2. [`context/ai_workflow_rules.md`](context/ai_workflow_rules.md)

Read the other four only when the task touches their area. They are the
canonical source for their topics, so read them before changing that topic:

- [`context/architecture.md`](context/architecture.md): when changing or
  designing an API route, contract, data store, deployment, or accepted
  invariant.
- [`context/code_standards.md`](context/code_standards.md): when writing or
  reviewing code, tests, or lint and format configuration.
- [`context/ui_context.md`](context/ui_context.md): when changing anything in
  `apps/web` or the console's look, copy, or behaviour.
- [`context/progress_tracker.md`](context/progress_tracker.md): when choosing
  what to work on next, or recording delivery status or a decision.

A typo or wording fix needs only the two files above.

Also read any feature spec under
[`context/feature_specs/`](context/feature_specs/) relevant to the task,
plus any scoped `AGENTS.md` or `CLAUDE.md` closer to files being changed.
Do not duplicate or override project rules in this file; update the
relevant `context/` file instead.

Active ADRs live in [`apps/api/docs/adr/`](apps/api/docs/adr/). Read its
[index](apps/api/docs/adr/README.md) before changing anything an ADR covers,
and do not reverse an accepted ADR without a new one that supersedes it.

Before implementing a new feature spec, follow
`context/ai_workflow_rules.md`'s core rules: never rewrite existing working
logic unless a feature spec explicitly commands it; always reuse existing
utility functions, hooks, and UI primitives already in the repo before
writing new ones; and work on exactly one feature spec at a time.

The prior canonical document, `docs/project-context.md`, and the legacy
PRD/ADR/proposal corpus it pointed to, are archived under
[`docs/archive/`](docs/archive/) and are historical only — do not read them
for active development. The ADR index (`apps/api/docs/adr/README.md`) is
the decision log; `context/progress_tracker.md` points to it.

## Handoffs

`.agents/handoffs/` is gitignored, so a handoff stays on the machine that
wrote it. Before stopping on multi-step work, write or update a handoff there:
what is done, what is next, and each decision with its reason. At the start of
a task, read the newest handoff for that work if there is one. Durable
decisions still go in an ADR or `context/progress_tracker.md`, not only in a
handoff.
