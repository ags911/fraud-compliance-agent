# UI Context

> Supplementary synthesis — see the authority note at the top of
> [`project_overview.md`](project_overview.md). The original design-system
> source docs (`payments-design-system.md`, `typography-standard.md`) are
> archived under `docs/archive/apps/web/docs/design/`; this file, plus the
> five live reference pages below, is now the current, approved source.
> **Changing a primitive, semantic token, component contract, or baseline
> screenshot is a design change requiring explicit visual approval** —
> `apps/web/AGENTS.md`: "The Payments design system is frozen... must not
> change as a side effect of feature work."

## Two Coexisting Systems (do not confuse them)

1. **Payments system** (every route except Overview): Satoshi (UI chrome) +
   Inter (dense data) + system monospace (identifiers); dark-mode-only by
   root design ("an ops tool, not a themeable consumer product"); frozen
   visual reference `work/payments-design-concept.html`.
2. **Overview/Dashboard route**: the shadcn surface, with its own separately
   scoped light+dark theme (`src/dashboard-theme.css`, scoped to
   `:root[data-app-theme="dashboard"]`) so it never leaks into the Payments
   shell.
3. **`shadcn-defaults` reference page** (`references/shadcn-defaults.html`):
   a third, fully independent system — **Geist Variable** font, unmodified
   shadcn `radix-nova` preset, **light theme only**. Never import both this
   theme and `index.css` into the same document.

See [Reference Pages](#reference-pages) below for all five standalone pages,
their current paths, and which ones are actually linked from or tested
against the live app.

## Payments Design System (`apps/web/docs/design/payments-design-system.md`)

**Token tiers**: Tier 1 primitives (approved literal values, private to the
token file) → Tier 2 semantic tokens (`background`, `border`, `success`) →
Tier 3 component tokens (stable geometry/typography contracts:
`control-height`, `table-row-height`, `type-page-title-size`). Use a named
`--payments-*` token whenever a value has semantic meaning or is shared by
more than one component. Two literal exceptions kept as-is (do not round to
a Tailwind scale step): **17px panel padding**, **9px distribution bars**.

**Palette separation rule**: chart-series colours (identify datasets) and
status-pill colours (communicate semantic state) are two separate palettes
that must never be coupled — status pills must never source `--chart-*`
tokens.

**Required components** (`src/components/payments-ui.tsx`): app shell, top
bar, page headings, buttons, subnavigation, date ranges, KPI strips, panels,
progress bars, range toggles, status pills. `PaymentsTopBar` owns the
approved toggle/divider/search geometry. `PaymentsProgress` is the only
progress-indicator component — **6px height**, pill radius, not overridable
by page CSS.

**Change checklist** (any change to an approved Payments component must
verify): (1) resolved colours/font/spacing/borders/radii against the
reference; (2) desktop and the **760px** responsive breakpoint; (3) hover,
focus-visible, active, disabled, tooltip states; (4) visible copy and
accessibility labels; (5) shared state between duplicate controls (e.g. the
reporting-period pill and the chart range toggle).

**Sidebar toggle contract** (frozen exact geometry): shadcn-style **28×28px**
ghost button, Lucide `PanelLeft` icon, centred **1×20px** divider; icon edge
and search-field border sit exactly **12px** from the divider; trigger's
**16px** glyph aligns to the page-content edge with a **28px** hit area
extending **6px** left; `aria-expanded` exposed, **⌘/Ctrl+B** shortcut;
desktop folds to a **48px** icon rail via a **240ms** Motion `easeInOut`
tween (instant under reduced motion); mobile opens a **240px** Radix Sheet.

**Automated gates**: `npm run check:payments-design` (token/coupling/raw-
colour checks), `npm run test:payments` (computed typography/spacing/
semantic-state/snapshot checks), `npm run test:payments:update` (only after
an intentional, reviewed design change) — run in
`.github/workflows/payments-design-contract.yml` on every PR.

## Typography Standard (`typography-standard.md`, "Kepler," v1.1, 2026-09-15 — the authoritative/adopted spec)

**Font-family tokens**:

| Token | Stack | Use |
|---|---|---|
| `--payments-font-ui` | `"Satoshi", Inter, ui-sans-serif, system-ui, -apple-system, sans-serif` | Headings, nav, buttons, explanatory text, badges, calendar labels |
| `--payments-font-data` | `Inter, ui-sans-serif, system-ui, -apple-system, sans-serif` | Amounts, percentages, metric labels/values, dates/times, chart axes |
| `--payments-font-code` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` | Customer/transaction/review identifiers |

Numeric cells use `font-variant-numeric: tabular-nums`. Weights are limited
to **400/500/600/700** — 650 and 670 were removed and must not be
reintroduced. 400 = ordinary text/data; 500 = metadata emphasis/disclosure/
calendar captions; 600 = wordmark/controls/selected tabs/selected chart
ranges; 700 = headings/amounts/selected nav/statuses.

**Semantic type recipes** (`--payments-type-*`, defined in
`src/payments-typography.css`):

| Recipe | Family | Size | Weight | Line height | Use |
|---|---|---:|---:|---:|---|
| `page-title` | UI | 26px | 700 | 1.2 | Primary page heading |
| `metric-value` | Data | 20px | 700 | 1.5 | KPI values |
| `brand` | UI | 17px | 600 | 20px | Wordmark only |
| `state-body` | UI | 17px | 400 (700 title) | 1.5 | Empty/error guidance |
| `section-title` | UI | 16px | 700 | 1.5 | Chart/table section titles |
| `data-expanded` | Data | 15px | 400 (500 header) | 1.4286 | Expanded chart data table |
| `disclosure` | UI | 15px | 500 | 1.4286 | "View chart data" |
| `calendar-caption` | UI | 15px | 500 | 1.4286 | Month/year caption |
| `calendar-day` | Data | 15px | 400 | 1 | Calendar day numbers |
| `body` | UI | 14px | 400 | 1.5 | Page intro, ordinary body |
| `navigation` | UI | 14px | 400 (700 active sidebar / 600 active tab) | 20px | Sidebar/tabs |
| `input` | UI | 14px | 400 | 20px | Search / short inputs |
| `date-filter` | Data | 14px | 400 | 20px | Reporting period |
| `calendar-weekday` | UI | 14px | 400 | 20px | Weekday abbreviation |
| `control` | UI | 13px | 600 | 1.5 | "Select rules" / "Create rule" actions |
| `data` | Data | 13px | 400 (700 amount emphasis) | 1.4286 | Payment amounts/dates |
| `metadata` | UI | 13px | 400 (500 policy/count) | 1.5 | Sidebar operational text |
| `support` | UI | 12px | 400 (700 legend emphasis) | 1.5 | Descriptions/legend labels |
| `metric-label` | Data | 12px | 400 | 1.5 | KPI label |
| `data-support` | Data | 12px | 400 | 1.5 | Legend totals, result counts |
| `identifier` | Code | 12px | 400 | 1.4286 | Customer/transaction IDs |
| `range-control` | UI | 12px | 400 (600 selected) | 1.4286 | 7D/30D/90D |
| `table-header` | UI | 11px | 700 | 1.4286 | Compact table uppercase labels |
| `status` | UI | 11px | 700 | 1.4286 | Compact status pills |
| `axis` | Data | 11px | 400 | 1.3333 | Chart ticks |
| `tooltip` | UI labels / Data values | 11px | 400 / 700 | 1.7 | Compact chart tooltips |

Compact 11px is a retained intentional design choice, not a universal a11y
recommendation. Font ownership belongs to product wrappers, including
portaled ones (calendar/tooltips are React portals and don't inherit shell
DOM font-family) — **never change a global shadcn primitive to fix one
page**, and never use the CSS `font` shorthand on a shell wrapper (it resets
child size/weight/line-height).

**Verified via**: `npm run check:payments-design` (rejects removed 650/670
weights) and browser tests covering computed typography, calendar/tooltip
families, sidebar consistency, and desktop/mobile snapshots. "New role sizes
require intentional review; do not update snapshots to hide unexplained
differences."

## `shadcn-defaults` Reference System (independent — originally documented in `docs/archive/apps/web/docs/design/shadcn-defaults.md`)

Unmodified shadcn `radix-nova` preset; **Geist Variable** font; base radius
**0.625rem**; light theme only; payment/chart colors still follow the
Payments palette via `src/shadcn-defaults-theme.css`. No compact-card
overrides, bespoke pills, or global animation overrides. Import
`shadcn-defaults.css` once at app entry instead of `index.css` — never both
in the same document. `RulesPerformanceChart` (built on the shadcn chart
helper + Recharts) provides semantic outcome tokens, a text summary +
labelled legend, a keyboard-accessible SVG layer, and a native expandable
data table for exact values.

## Reference Pages

Five standalone Vite entries live under `apps/web/references/` (`index.html`
is the only HTML file left at the web root). Each is its own build target in
`vite.config.ts` and loads its React entry via an absolute `/src/*-main.tsx`
script path, so none of them depend on the app's client-side router.

| Page | Bootstraps | Linked from the live app? | Tested? |
|---|---|---|---|
| `references/overview-reference.html` | `src/overview-reference-main.tsx` → the pre-dashboard Payments Overview | No (code comment only, in `ProductApp.tsx`) | Yes, 4 Playwright checks incl. a visual snapshot |
| `references/payments-design-system.html` | `src/payments-design-system-main.tsx` → the Payments component catalog | No | Yes, 2 checks; also Playwright's own dev-server readiness URL (`playwright.config.ts`'s `webServer.url`) |
| `references/rules-performance-reference.html` | `src/rules-performance-reference-main.tsx` → `references/RulesPerformanceReference.tsx`, the frozen ground truth | No | Yes, 2 checks incl. a visual snapshot |
| `references/rules-performance.html` | `src/rules-performance-main.tsx` → `RulesPerformance.tsx` | **Yes** — the only one of the five reachable by clicking through the app: the `/rules/performance` placeholder page's "Open the visual reference" link, and a link on `ShadcnDefaults.tsx` | Yes, 3 checks |
| `references/shadcn-defaults.html` | `src/shadcn-defaults-main.tsx` → the independent shadcn showcase | No | **No** — built and shipped, but no test visits it |

Two things worth knowing, not just where the files live:

- **`rules-performance.html` and `rules-performance-reference.html` render
  identical output.** `RulesPerformance.tsx` is a pure pass-through wrapper
  around `RulesPerformanceReference`, so the app currently maintains two
  separate build entries, bootstrap files, and Playwright coverage sets for
  byte-identical content. The live "Open the visual reference" link on the
  `/rules/performance` placeholder page points at the non-canonical
  `rules-performance.html` rather than the actual frozen reference. This is
  a known duplication, not a bug introduced by moving the files — consider
  it a candidate for consolidation, but doing so removes a build entry and
  a chunk of test coverage, so it needs an explicit decision, not a silent
  fix.
- **`shadcn-defaults.html` has no automated coverage.** It ships in
  production (per `vite.config.ts` and the API's `.dockerignore`-equivalent
  allowlist pattern for the web build) but nothing in the Playwright suite
  or the live app ever navigates to it — it's reachable only by typing the
  URL directly. Its own archived design doc calls it an "independent
  reference," so this may be intentional, but it means a regression there
  would not be caught by CI.

## Layout, Radius, and Other Tokens (code-verified, `src/index.css`)

Tailwind v4 CSS-first config (no `tailwind.config.*`); base palette
`--background: #0a0c10`, `--foreground: #e7eaf0` (identical for `:root` and
`.dark` — deliberately dark-only for the Payments shell); domain outcome
tokens `--color-pass`/`--color-hold`/`--color-challenge` (+ `-soft`
variants) consumed by `OutcomeBadge.tsx`; a `--radius` base token feeds the
generated `--radius-sm`/`--radius-md`/etc. utilities. Icon library:
`lucide-react`. Class merging via the `cn` npm package
(`src/lib/utils.ts` re-export). No `pages/` directory — page components sit
directly under `src/`; the Payments shell is provided by `PaymentsShellLayout`
wrapping every non-Overview route.

## Diagram Styling Convention (`docs/architecture/diagrams/`, D2 language)

Every architecture diagram: one scale (<900 units wide); stacks vertically
rather than shrinking text; colours are the console's Payments tokens, type
is Inter, embedded per-SVG; colour communicates build state only (a dashed
border repeats the signal for greyscale survival); no hard background — each
SVG carries a derived `prefers-color-scheme: dark` palette since the
Payments system itself has no dark-theme diagrams elsewhere; every
connection is one colour (arrow = direction only); every node carries its
build state (Built/Planned/Proposed) — "mixing what runs with what's
planned is how a demo becomes a false claim."
