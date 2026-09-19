# Web console instructions

Read the [repository context](../../docs/project-context.md) first. This file
adds only rules that are specific to `apps/web`.

- Focused checks, run from the repository root: `make web-lint`,
  `make web-design-check`, `make web-build`, and `make web-test`. CI uses
  Node 22.
- The Payments design system is frozen. `work/payments-design-concept.html` is
  the approved visual source, and the frozen Rules Performance reference and the
  tokens in `docs/design/payments-design-system.md` must not change as a side
  effect of feature work. Use the documented tokens and components; do not
  approximate a value with the nearest utility class.
- For dashboard, chart, navigation, or shared UI work, use the
  `$payments-dashboard-consistency` skill, including screenshot validation of
  hover states.
- Playwright screenshot baselines are recorded with Chrome on macOS, which is why
  CI runs the web job on macOS. Do not re-record a baseline to make a test pass.
  Use `npm run test:payments:update` only for an approved visual change.
- The root `*.html` pages are Vite entries that the tests load by URL. Moving or
  renaming one means updating `vite.config.ts` and the tests together.
- No API internals, database models, or secrets in browser code; consume only
  accepted contracts.
- Chart, graph, and table components are presentational: they receive data only
  through typed props and do not fetch or transform data. Fetching and data
  shaping live in hooks (for example `useAgentRun`) or in `src/lib`. Local UI
  state, such as an open menu, a filter, or a draft, is fine in a component.
- Every component's props are typed with a TypeScript `interface` or `type`.
  `any` is banned and enforced by lint (`typescript/no-explicit-any`); use
  `unknown` and narrow it.
