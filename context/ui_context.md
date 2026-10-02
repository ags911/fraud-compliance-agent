# UI Context

> Part of the canonical `/context/` baseline — see the authority note at the
> top of [`project_overview.md`](project_overview.md). This file is the current,
> approved description of the web app's UI. Changing a documented token,
> geometry rule or chart convention is a design change requiring explicit
> visual approval.

## One Page: the Risk Console (`/`)

Since 2026-09-27 the web app (`apps/web`) is a single page, the **Risk
Console** (formerly the "Radar" portfolio page, a placeholder name taken from
the Stripe Radar dashboard reference). Everything else was removed: the
shadcn Overview dashboard, the `/simulation` mock, the Payments shell pages
(`/insights`, `/transactions/new`, `/transactions/investigation`, case detail
at `/transactions/:caseId`, the planned placeholders), the six frozen
reference pages, the Payments design system CSS and its
`check:payments-design` gate, and the Kepler typography standard that
governed them. Their history is in git and `docs/archive/`.

- **Entry**: `apps/web/index.html` holds the page shell and all of its layout
  CSS inline; `src/main.tsx` mounts `src/console/RiskConsole.tsx`. There is no
  router and no iframe.
- **URL state**: `?scenario=S01`…`S05` picks a scenario (the default is the
  Mixed feed); `?case=<id>` opens the case drawer, and case links in the
  Cases table use it, so a new tab or a copied link reopens the case. Every
  unknown path falls back to `index.html`
  (`apps/web/public/staticwebapp.config.json`), so old `/radar` links still
  work.
- **Palette**: its own dark LCH palette in `index.html`'s `:root`.
  `src/console/console-controls-theme.css` remaps the shadcn tokens
  (`src/shadcn-defaults-theme.css`) to it, so Radix portals (Select, Sheet,
  Tooltip) match. Font: Inter, set on `:root`; the shadcn `--font-sans` token
  points at the same stack.
- **CSS layering**: the page CSS is unlayered and resets `* { padding: 0 }`,
  so it beats Tailwind `@layer` utilities; prefer the page's own classes.
- **Public deployment**: the deployed showcase has no Sandbox database, so the
  Scenario and Cases tabs and the live feed show their unavailable states
  there; Run showcase still works.

**Structure** (Radix `Tabs` primitive from `radix-ui` directly, not the
shadcn wrapper, whose utilities fight the page CSS; inactive tabs unmount,
so charts replay their grow-in animation on return):
- Top bar: the Averlynx mark + "Fraud Compliance Agent", scenario Select
  (Mixed feed, S01–S05), the Live feed switch (spec 0003), pill "Run
  showcase" (runs the selected scenario's investigation; results appear on
  the Cases tab), and the "How this dashboard works" tour (spec 0007).
- **Scenario** (default): heading `S0x · <label>` + date span and day count;
  one shared `7D / 30D / All` toggle (`src/console/ConsoleRangeToggle.tsx`,
  window from `src/lib/scenario-date-window.ts`, clipped to the dataset's
  time boundary); real Sandbox stat cards (transactions, outbound spend,
  active days, largest day); "Recommendations over time" (Sandbox badge:
  outbound payments per day decided by the scenario's deterministic rule, from
  `GET /sandbox/scenarios/{id}/decisions`, counting up during a feed);
  "Outbound activity" (Sandbox badge); one "About this data" footnote
  carrying the full provenance and the dataset ID.
- **Cases**: the live decision routing board (spec 0006, a Sankey with a
  "Hide board" disclosure), then this browser's saved cases (spec 0002/0004)
  with filters, "Show more", and a case drawer. While a feed runs, `/cases` is
  refetched quietly (at most every 3 seconds, once more when it ends). Feed
  cases show a `Live feed` pill, the S04/S05 copy "Carried from the
  scenario's recorded investigation; no agent ran for this payment.", and a
  Model signal reading "Not scored yet" until an approved score exists.
- **Model**: XGBoost PR-AUC and Brier score cards, labelled as benchmark
  results, not runtime scores. (Model data must never be placed beside
  decisions — it would imply the model made them; MVP 3 has no runtime model
  score.)

**Proposed regulatory-reference surface (F4–F6, not built):** the S04 case
drawer, not the console's Scenario tab, receives a Regulatory references panel
next to investigation evidence and the proposed route. Each reference shows
the FCA provision title and identifier, a short retrieved excerpt, why it is
relevant, a source link, corpus version, and retrieval time. A matching
read-only retrieval event may appear in the investigation trace. The panel
must say “Regulatory reference support, not legal advice.” It is never a
general Handbook chat and must never present an “FCA compliant” claim. In F6,
the console's Health tab may show only corpus version, last review date, and
retrieval availability.

**Tokens and geometry** (all in `apps/web/index.html`'s `:root`):
- **One accent, `--console-accent`** (button, active tab underline, focus
  rings, links, selected tile). Currently **monochrome `#f2f2f2`** with
  `--console-accent-foreground: #0b0b0b` (17.6:1). **Signal blue `#4C8DFF`**
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
- **Tab bar** (layout after Stripe Radar's tabs, colour the console's own): first
  label flush on the content edge, underline exactly the label's width
  (2px, rounded ends, sits on the track), 24px gap, hairline track across
  the full content column.
- **Buttons** are pills (`border-radius: 9999px`).
- **Contrast**: readable supporting copy (section descriptions, stat-card
  detail lines, inactive tab and toggle labels, the Live status, footnote)
  uses `--lch-text-secondary` (≈7:1). `--lch-text-tertiary` (≈3.5:1, fails AA
  for small text) is only for chart axis ticks. Table headers, case fact
  labels and chart data notes still use tertiary and are a known follow up.
  `apps/web/tests/accessibility.spec.ts` runs axe on every tab at both widths.
- **Stat cards**: label and value white; detail line secondary grey.
- **Colour roles**: PASS `--sev-low #4cb782`, CHALLENGE `--sev-moderate
  #f2c94c`, HOLD `--sev-high #eb5757` are for decisions only; spend bars are
  neutral grey (`--lch-text-secondary`).

**Chart conventions** (`src/console/ConsoleRecommendationChart.tsx`,
`ConsoleScenarioActivityChart.tsx`, `ConsoleDecisionRouting.tsx`):
- Card structure (originally from the since removed Rules Performance
  chart): header band with title,
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

`apps/web/public/favicon.svg` is the Averlynx mark
(`src/components/averlynx-logo.tsx`), linked from `index.html`. Favicons
cannot inherit `currentColor`, so the SVG switches colour with a
`prefers-color-scheme` media query.

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
