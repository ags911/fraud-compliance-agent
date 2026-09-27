# Web console instructions

Read the [repository context](../../context/project_overview.md) first
(and the rest of `../../context/`). This file adds only rules that are
specific to `apps/web`.

- Focused checks, run from the repository root: `make web-lint`,
  `make web-build`, and `make web-test` (`npm test` in `apps/web`, Playwright
  only; there is no unit runner). CI uses Node 22.
- The app is one page, the Risk Console: `index.html` holds its markup shell
  and all of its layout CSS inline, and `src/main.tsx` mounts
  `src/console/RiskConsole.tsx`. There is no router. View state lives in the
  query string (`?scenario=`, `?case=` for the case drawer), and every unknown
  path falls back to `index.html` (`public/staticwebapp.config.json`), so old
  `/radar` links still land on the console.
- Style with the page's own tokens in `index.html`'s `:root`: the `--lch-*`
  neutral ramp, `--sev-low`/`--sev-moderate`/`--sev-high` for PASS,
  CHALLENGE and HOLD only, and `--console-accent`.
  `src/console/console-controls-theme.css` remaps the shadcn tokens to them so
  Radix portals (Select, Sheet, Tooltip) match. Readable text uses
  `--lch-text-secondary`; `--lch-text-tertiary` fails AA for small text and is
  for chart axis ticks only. `tests/accessibility.spec.ts` runs axe on every
  tab at both widths.
- The page CSS is unlayered and resets `* { padding: 0 }`, so it beats
  Tailwind `@layer` utilities: a utility loses to any page rule that sets the
  same property. Prefer the page's own classes for console markup.
- For chart or shared UI work, use the `$payments-dashboard-consistency`
  skill, including screenshot validation of hover states.
- No API internals, database models, or secrets in browser code; consume only
  accepted contracts.
- Chart, graph, and table components are presentational: they receive data only
  through typed props and do not fetch or transform data. Fetching and data
  shaping live in hooks (for example `useSandboxFeed`) or in `src/lib`. Local UI
  state, such as an open menu, a filter, or a draft, is fine in a component.
- Every component's props are typed with a TypeScript `interface` or `type`.
  `any` is banned and enforced by lint (`typescript/no-explicit-any`); use
  `unknown` and narrow it.
