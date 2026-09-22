# Web console instructions

Read the [repository context](../../context/project_overview.md) first
(and the rest of `../../context/`). This file adds only rules that are
specific to `apps/web`.

- Focused checks, run from the repository root: `make web-lint`,
  `make web-design-check`, `make web-build`, and `make web-test`. CI uses
  Node 22.
- The product has one app-wide design system: the shadcn dashboard palette in
  `src/app-theme.css` (`:root`/`.dark`, unscoped). It used to be scoped to the
  Overview route only, with the Payments pages carrying a separate
  Stripe-derived palette (`payments-design-system.css`); that split was
  retired in favour of one shared theme. `app-theme.css` loads after
  `shadcn-defaults.css` and overrides both the shadcn `--background`/etc.
  tokens and the legacy `--payments-*` primitives that
  `payments-design-system.css`/`payments-typography.css` still define, so the
  Payments component library renders in the new palette without that shared,
  frozen CSS needing to change. The `references/*.html` pages under
  `references/` do not load `app-theme.css` and still render the old palette
  on purpose — they are frozen visual snapshots of what came before, not
  something to keep matching.
- For dashboard, chart, navigation, or shared UI work, use the
  `$payments-dashboard-consistency` skill, including screenshot validation of
  hover states.
- Playwright screenshot baselines are recorded with Chrome on macOS, which is why
  CI runs the web job on macOS. Do not re-record a baseline to make a test pass.
  Use `npm run test:payments:update` only for an approved visual change.
- The `references/*.html` pages (`index.html` is the only entry left at the
  web root) are Vite entries that the tests load by URL. Moving or renaming
  one means updating `vite.config.ts`, `playwright.config.ts`'s `webServer.url`,
  and the tests together. Do not add an entry whose name shadows a product
  route: the dev server answers `/overview` with an `overview.html` file if
  one exists at the web root, while production serves the app there, and the
  tests would then exercise the wrong page. The Payments Overview is
  `references/overview-reference.html` for exactly that reason.
- The Overview route is the shadcn dashboard (`src/Dashboard.tsx`), routed
  outside the Payments shell. It is still the only page with a light/dark
  toggle; `.dark` is only ever added by its own switch, so in practice dark
  mode stays a Dashboard-only affordance even though the theme itself is now
  global.
- Navigation is unified too: every Payments page uses the same top bar +
  section tabs as Overview (`src/components/section-tabs.tsx`), not a left
  sidebar. `PaymentsTopBar`'s `showSidebarTrigger={false}` swaps its sidebar
  toggle for the Averlynx brand, and `<SectionTabs />` renders under
  `PaymentsPageHeading`. `AppSidebar` (`src/components/app-sidebar.tsx`)
  still exists and is still used, but only by the frozen reference pages
  (`Overview.tsx`, `RulesPerformanceReference.tsx`) — do not wire it back
  into a live route. The demo API health status + Retry control that used to
  live in the sidebar footer moved to `src/components/api-health-status.tsx`,
  rendered in the top bar's actions area.
- No API internals, database models, or secrets in browser code; consume only
  accepted contracts.
- Chart, graph, and table components are presentational: they receive data only
  through typed props and do not fetch or transform data. Fetching and data
  shaping live in hooks (for example `useAgentRun`) or in `src/lib`. Local UI
  state, such as an open menu, a filter, or a draft, is fine in a component.
- Every component's props are typed with a TypeScript `interface` or `type`.
  `any` is banned and enforced by lint (`typescript/no-explicit-any`); use
  `unknown` and narrow it.
