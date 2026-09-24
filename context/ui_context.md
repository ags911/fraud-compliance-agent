# UI Context

> Supplementary synthesis — see the authority note at the top of
> [`project_overview.md`](project_overview.md). The original design-system
> source docs (`payments-design-system.md`, `typography-standard.md`) are
> archived under `docs/archive/apps/web/docs/design/`; this file, plus the
> five live reference pages below, is now the current, approved source.
> **Changing a component contract or a reference page's baseline screenshot
> is a design change requiring explicit visual approval.**

## One App-Wide System

The live app has a single design system now: the shadcn dashboard palette in
`src/app-theme.css` (unscoped `:root`/`.dark`), Geist Variable throughout.
This used to be two separate systems — a Stripe-derived, Satoshi+Inter
Payments palette on every route except Overview, and the shadcn dashboard
palette scoped to the Overview route only via `:root[data-app-theme="dashboard"]`
— until that split was retired in favour of one shared theme across every
route. Overview/Dashboard remains the only page with a light/dark toggle;
`.dark` is only ever added by its own switch, so dark mode stays a
Dashboard-only affordance in practice even though the palette itself is
global.

`app-theme.css` loads after `shadcn-defaults.css` in `main.tsx` and
overrides both the shadcn tokens (`--background`, `--foreground`, etc.) and
the legacy `--payments-*` primitives/fonts that `payments-design-system.css`
and `payments-typography.css` still define, so the whole
`src/components/payments-ui.tsx` component library (built on those
`--payments-*` tokens) renders in the new palette without that shared CSS
needing to change.

That shared CSS is still live, though, because the **frozen reference
pages** under `references/` do not load `app-theme.css` and intentionally
still render the old Stripe/Satoshi/Inter palette — they are snapshots of
what the app looked like before, not something to keep matching. See
[Reference Pages](#reference-pages) below for all five, their paths, and
which ones are linked from or tested against the live app.

## Payments Design System (frozen; `apps/web/docs/design/payments-design-system.md`)

The tokens, geometry, and components below describe the frozen contract
`payments-design-system.css`/`payments-typography.css` still define, which
the `references/*.html` pages render unchanged. The live app now sources its
actual colours from `src/app-theme.css` (see above), which overrides these
`--payments-*` primitives; the semantic/component tier described here
(spacing, radii, type recipes, sidebar geometry) is unaffected and still
governs both the reference pages and the live Payments components.

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

**Sidebar toggle contract** (frozen exact geometry, `AppSidebar` — no longer
routed live; see [One App-Wide System](#one-app-wide-system)): shadcn-style
**28×28px** ghost button, Lucide `PanelLeft` icon, centred **1×20px** divider;
icon edge and search-field border sit exactly **12px** from the divider;
trigger's **16px** glyph aligns to the page-content edge with a **28px** hit
area extending **6px** left; `aria-expanded` exposed, **⌘/Ctrl+B** shortcut;
desktop folds to a **48px** icon rail via a **240ms** Motion `easeInOut`
tween (instant under reduced motion); mobile opens a **240px** Radix Sheet.
This geometry now governs only the frozen `Overview.tsx` and
`RulesPerformanceReference.tsx` reference pages. Every live Payments page
uses the Overview dashboard's own navigation instead: a top bar (brand +
search, via `PaymentsTopBar` with `showSidebarTrigger={false}`) plus the
shared `SectionTabs` component underneath the page heading — no left
sidebar. The demo API health status + Retry control that used to live in the
sidebar footer now renders in that top bar
(`src/components/api-health-status.tsx`).

**Automated gates**: `npm run check:payments-design` (token/coupling/raw-
colour checks), `npm run test:payments` (computed typography/spacing/
semantic-state/snapshot checks), `npm run test:payments:update` (only after
an intentional, reviewed design change) — run in
`.github/workflows/payments-design-contract.yml` on every PR.

## Typography Standard (`typography-standard.md`, "Kepler," v1.1, 2026-09-15 — the authoritative/adopted spec for the frozen references)

**Font-family tokens** (as the frozen reference pages render them; `app-theme.css`
overrides `--payments-font-ui`/`--payments-font-data` to `"Geist Variable", sans-serif`
for the live app, so live Payments pages use Geist, not Satoshi/Inter):

| Token | Stack (frozen references) | Use |
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

## `shadcn-defaults` Reference Page (frozen; originally documented in `docs/archive/apps/web/docs/design/shadcn-defaults.md`)

`references/shadcn-defaults.html` renders the shadcn `radix-nova` preset with
the frozen Stripe-derived Payments colours layered on via
`src/shadcn-defaults-theme.css` (the same file the live app used to source
its base palette from, before `app-theme.css` started overriding it). Geist
Variable font; base radius **0.625rem**; light theme only; no compact-card
overrides, bespoke pills, or global animation overrides. It does not load
`app-theme.css`, so it still shows the old palette on purpose — see
[One App-Wide System](#one-app-wide-system) above. `RulesPerformanceChart`
(built on the shadcn chart helper + Recharts) provides semantic outcome
tokens, a text summary + labelled legend, a keyboard-accessible SVG layer,
and a native expandable data table for exact values.

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

## Radar Portfolio Page (`/radar`, actively iterated — not a frozen reference)

`/radar` is a **standalone portfolio piece**, not part of the Payments shell
and not one of the five frozen snapshots above. `src/Radar.tsx` embeds
`references/radar-reference.html` (Vite entry `radarReference`) in a
same-origin iframe **without a `sandbox` attribute** — case links from it use
`target="_top"` and it shares `localStorage` with the app, both of which
depend on that setup. The HTML bootstraps `src/radar-reference-main.tsx` →
`src/references/RadarReference.tsx`. It carries its **own dark LCH palette**
in the HTML's `:root` (not `app-theme.css`); `src/references/radar-controls-theme.css`
remaps the shadcn tokens at `:root` so Radix portals (Select) match. Its CSS is
unlayered, so it beats Tailwind `@layer` utilities and the HTML's
`* { padding: 0 }` reset — style it with the HTML's own classes. Stale
leftovers: the code comments in `Radar.tsx`/`ProductApp.tsx` still call it an
"exact unmodified copy" of the mockup (it is not any more), and the HTML still
contains the original static `<main hidden>` mockup markup, which never
renders. **No Playwright coverage** exists for `/radar`.

**Structure** (Radix `Tabs` primitive from `radix-ui` directly, not the
shadcn wrapper, whose utilities fight the Radar CSS; inactive tabs unmount,
so charts replay their grow-in animation and the collapsed breakdown resets
on return):
- Top bar: NetworkMark + "Fraud Compliance Agent" only (no "Averlynx ›"
  breadcrumb — standalone piece), scenario Select (S01–S05), pill "Run
  showcase" (switches to the Cases tab, where results appear), and the Live
  feed switch (spec 0003).
- **Scenario** (default): heading `S0x · <label>` + date span and day count;
  one shared `7D / 30D / All` toggle (`src/references/RadarRangeToggle.tsx`,
  window from `src/lib/scenario-date-window.ts`, clipped to the dataset's
  time boundary); real Sandbox stat cards (transactions, outbound spend,
  active days, largest day); "Recommendations over time" (Sandbox badge:
  outbound payments per day decided by the scenario's deterministic rule, from
  `GET /sandbox/scenarios/{id}/decisions`, counting up during a feed; the
  mock generator was removed in spec 0004);
  "Outbound activity" (Sandbox badge); one "About this data" footnote
  carrying the full provenance and the dataset ID.
- **Session**: one empty state with a `Run S0x` button before any run; then
  Runs completed / PASS / CHALLENGE / HOLD stat cards (recommendation
  vocabulary; route and fail-safe counts moved into detail lines), the
  outcome share bar, the "Current session decisions" table, and a collapsed
  "Breakdown by scenario" chart. Session runs are browser-memory only.
- **Cases and the live feed** (spec 0004): feed cases list with Mode
  `Live feed`; while a feed runs, on any tab, `/cases` is refetched quietly
  (at most every 3 seconds, once more when it ends), keeping rows loaded with
  "Show more" and an open drawer. The drawer and `/transactions/:caseId` show
  a `Live feed` pill, the S04/S05 copy "Carried from the scenario's recorded
  investigation; no agent ran for this payment.", and a Model signal reading
  "Not scored yet" until an approved score exists.
- **Model**: XGBoost PR-AUC and Brier score cards, labelled as benchmark
  results, not runtime scores. Planned home for future ML charts.
  (Model data must never be placed beside session decisions — it would imply
  the model made them; MVP 3 has no runtime model score.)

**Proposed regulatory-reference surface (F4–F6, not built):** the S04 case
detail page, not Radar's Scenario tab, receives a Regulatory references panel
next to investigation evidence and the proposed route. Each reference shows
the FCA provision title and identifier, a short retrieved excerpt, why it is
relevant, a source link, corpus version, and retrieval time. A matching
read-only retrieval event may appear in the investigation trace. The panel
must say “Regulatory reference support, not legal advice.” It is never a
general Handbook chat and must never present an “FCA compliant” claim. In F6,
Radar's Health tab may show only corpus version, last review date, and
retrieval availability.

**Radar tokens and geometry**:
- **One accent, `--radar-accent`** (button, active tab underline, focus
  rings, links, selected tile). Currently **monochrome `#f2f2f2`** with
  `--radar-accent-foreground: #0b0b0b` (17.6:1). **Signal blue `#4C8DFF`**
  (dark label 6.1:1) is the recorded chromatic alternative. It replaced two
  *borrowed* purples — Stripe's `#635bff` (shadcn `--primary`) and Linear's
  `#5E6AD2` — which read as another company's brand in a portfolio. Aqua
  `#3CC6D8` was rejected (too close to PASS green, incl. under
  deuteranopia); warm hues are excluded (they sit between CHALLENGE and
  HOLD). The comparison lives in a published artifact, "Radar Accent Options".
- **Card padding** `--card-pad-y: 12px` / `--card-pad-x: 14px` on every card
  (stat tiles, chart header and body bands, table card, disclosures); table
  cells use the same 14px side inset. Every gap between cards in a tab panel
  is 10px (`.tab-panel` flex gap), not card margins.
- **Tab bar** (layout after Stripe Radar's tabs, colour Radar's own): first
  label flush on the content edge, underline exactly the label's width
  (2px, rounded ends, sits on the track), 24px gap, hairline track across
  the full content column.
- **Buttons** are pills (`border-radius: 9999px`).
- **Contrast**: readable supporting copy (section descriptions, stat-card
  detail lines, inactive toggle labels, footnote) uses `--lch-text-secondary`
  (≈7:1). `--lch-text-tertiary` (≈3.5:1, fails AA for small text) is only for
  chart axis ticks.
- **Stat cards**: label and value white; detail line secondary grey.
- **Colour roles**: PASS `--sev-low #4cb782`, CHALLENGE `--sev-moderate
  #f2c94c`, HOLD `--sev-high #eb5757` are for decisions only; spend bars are
  neutral grey (`--lch-text-secondary`). `--chart-base #7c7ff2` (purple) is
  still defined but no longer used by any chart.

**Radar chart conventions** (`src/references/RadarRecommendationChart.tsx`,
`RadarScenarioActivityChart.tsx`):
- Card structure copied from the Rules Performance chart
  (`src/components/rules-performance-chart.tsx`): header band with title,
  optional source badge and description; distribution share bar with hover
  tooltips; toggleable legend (at least one series stays on); stacked bars;
  "View chart data" table.
- Plot style after the Linear Insights reference: thin **square** bars
  (`maxBarSize`/`barSize` 10, `radius 0`, no segment strokes), dashed
  horizontal gridlines (`--lch-border`), solid baseline.
- Y ticks always from `evenTicks()` in `src/lib/chart-ticks.ts` (nice
  1/2/2.5/5×10ⁿ whole steps, top of scale on a tick) so every gridline gap
  measures the same. Both Scenario charts show y-axis numbers and reserve the
  **same 56px y-axis width**, so a given day sits at the same x in each.
- Time series plot **every calendar day** in the window (zero days included)
  so spacing is honest; labels via date-fns `d MMM` (not `Intl` `en-GB`, which
  prints "Sept").
- **Data-honesty pattern**: every chart keeps a one-word source badge
  (`Mock data`, `Sandbox`) on its title, and each tab ends with one "About
  this data" footnote holding the full explanation. Never rely on a footnote
  alone — a chart must still say what it is when seen on its own.

## Favicon

`apps/web/public/favicon.svg` is the NetworkMark (`src/components/averlynx-logo.tsx`),
app-wide, replacing the Vite placeholder. Favicons cannot inherit
`currentColor`, so the SVG switches `#18181b` / `#fafafa` with a
`prefers-color-scheme` media query. `references/radar-reference.html` links it
too.

## Layout, Radius, and Other Tokens (code-verified, `src/app-theme.css`)

Tailwind v4 CSS-first config (no `tailwind.config.*`); base palette (`:root`)
`--background: #fcfcfc`, `--foreground: #0b0b0b`, `--primary: #0b0b0b`; `.dark`
(Overview-only, see above) `--background: #151515`, `--foreground: #f2f2f2`;
domain outcome tokens `--outcome-pass`/`--outcome-challenge` and the chart
tokens `--chart-1`..`--chart-5`; a `--radius` base token feeds the generated
`--radius-sm`/`--radius-md`/etc. utilities. Icon library: `lucide-react`.
Class merging via the `cn` npm package (`src/lib/utils.ts` re-export). No
`pages/` directory — page components sit directly under `src/`; the Payments
shell is provided by `PaymentsShellLayout` wrapping every non-Overview route.
`src/index.css` also exists in the tree but is **dead code** — nothing
imports it — and describes a dark-only palette that was never actually live;
do not treat it as a source of truth.

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
