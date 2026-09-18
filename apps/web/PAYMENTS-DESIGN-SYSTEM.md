# Payments UI design system

The current typography target is documented in
[Kepler typography standard](docs/design/TYPOGRAPHY-STANDARD.md), based on the
Rules page's original hierarchy with a 1px increase. The
[measured Rules inventory](docs/design/RULES-TYPOGRAPHY-INVENTORY.md) records
the pre-migration rendered values and known drift. Shared recipes in
`src/payments-typography.css` now apply the standard across Rules, Overview,
and the catalog; automated checks validate the common roles.

`work/payments-design-concept.html` is the approved visual reference for the
Payments product surface. New pages must consume the shared contracts in
`src/payments-design-system.css` and `src/components/payments-ui.tsx` instead of
copying approved values into page-local Tailwind class lists.

Open `/payments-design-system.html` to inspect the production Payments catalog.
Rules Performance retains its compact geometry while consuming the shared
typography recipes.

## Boundaries

- Payments UI uses Satoshi for product chrome and Inter for dense data.
- `src/ShadcnDefaults.tsx` remains a separate Geist-based component showcase.
- Chart-series colours identify datasets. Status-pill colours communicate
  semantic state; the two palettes must not be coupled.
- shadcn components remain the accessibility foundation, but Payments wrappers
  own their final spacing, type, borders, radii and interaction states.

## Required components

Use the exports from `src/components/payments-ui.tsx` for the app shell, top
bar, page headings, buttons, subnavigation, date ranges, KPI strips, panels,
progress bars, range toggles and status pills. `PaymentsTopBar` owns the approved toggle,
divider and search geometry; page implementations provide only the search
value and behavior. Add new product recipes there when a visual contract is
repeated; do not modify global shadcn primitives to make one Payments page
match.

## Token rules

- Tier 1 primitive tokens contain approved literal values and are private to the
  token file.
- Tier 2 semantic tokens describe intent (`background`, `border`, `success`).
- Tier 3 component tokens describe stable geometry and typography contracts
  (`control-height`, `table-row-height`, `type-page-title-size`).
- Use a named `--payments-*` token whenever a value has semantic meaning or is
  shared by more than one component.
- Use literal approved values for exceptional geometry such as 17px panel
  padding and 9px distribution bars. Do not round them to a
  Tailwind scale step.
- Typography uses only 400/500/600/700 weights. Use named typography roles from
  `src/payments-typography.css`; do not introduce local font-size/weight recipes.
- Never source status-pill colours from `--chart-*` tokens.
- Runtime font switching must use a real `font-family` declaration. Tailwind
  v4 `@theme inline` values are compiled into utilities and cannot be replaced
  reliably by changing `--font-sans` on a descendant.
- Never use the `font` shorthand on a page or shell wrapper. It resets child
  component size, weight and line-height declarations; inherit only
  `font-family`. The browser suite compares sidebar computed styles across Rules and Overview.
- Use `PaymentsProgress` for every product progress indicator. Its approved
  track, fill, 6px height, and pill radius are defined by the shared progress
  contracts; page CSS may not override that geometry.

## Change checklist

Any change to an approved Payments component must verify:

1. Resolved colours, font family/size/weight/spacing/line-height, spacing,
   borders and radii against the reference.
2. Desktop and the 760px responsive breakpoint.
3. Hover, focus-visible, active, disabled and tooltip states.
4. Visible copy and accessibility labels.
5. Shared state between duplicate controls, such as the reporting-period pill
   and chart range toggle.

## Creating a page

1. Start with `PaymentsPageTemplate` from
   `src/templates/payments-page-template.tsx`.
2. Compose controls from `src/components/payments-ui.tsx`; use shadcn primitives
   underneath new Payments wrappers.
3. Add a named contract to `src/payments-design-system.css` when a value repeats.
   Do not add a page-local hex colour or arbitrary pixel utility.
4. Cover comfortable, compact and 760px responsive layouts.
5. Include loading, empty, error and populated states where data is involved.
6. Update visual snapshots only after comparing the result with the approved
   mockup and recording the intentional change in review.

## Automated gates

- `npm run check:payments-design` verifies critical token values, prevents
  status/chart token coupling, and rejects raw colour or pixel recipes in new
  Payments consumers.
- `npm run test:payments` checks browser-computed typography, spacing, borders,
  radii, semantic states, shared range behavior and visual snapshots.
- `npm run test:payments:update` regenerates snapshots after an intentional,
  reviewed design change.
- `.github/workflows/payments-design-contract.yml` runs the contract check,
  production build and browser suite on pull requests.

## Review ownership

Changing a primitive, semantic token, component contract or baseline screenshot
is a design change. It requires explicit visual approval. Page copy and data may
change independently only when they do not alter the shared component contract.

## Sidebar toggle contract

- The shared content header uses a shadcn-style 28×28px ghost button with the
  Lucide `PanelLeft` icon and a vertically centred 1×20px divider. The painted
  icon edge and search-field border each sit exactly 12px from the divider;
  spacing is optical rather than measured from the button's invisible hitbox.
- The trigger's 16px glyph aligns with the page-content edge; its 28px hit area
  extends 6px to the left without reducing its clickable size.
- The button exposes `aria-expanded`, supports the ⌘/Ctrl+B shortcut, and uses
  the standard muted hover and focus-visible states.
- Desktop folds into the 48px icon rail using a shared 240ms Motion
  `easeInOut` tween, with an effectively instant reduced-motion fallback.
  Mobile uses the same trigger to open a 240px Radix Sheet.
- The header, logo mark and navigation rows retain identical dimensions and
  alignment in both states. Only the rail width and label visibility change,
  so icons never shift horizontally or vertically during the tween.
