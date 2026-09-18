# Kepler product typography standard

Version 1.1, 15 September 2026. Scope: the Payments product UI, using the current Rules page's original scale +1px as the visual baseline. Implemented in `src/payments-typography.css` across Rules, Overview, and the Payments catalog. The pre-migration measured inventory is in [RULES-TYPOGRAPHY-INVENTORY.md](RULES-TYPOGRAPHY-INVENTORY.md).

## Audit findings

| Finding | Evidence | Standard decision |
| --- | --- | --- |
| Product UI mixes font families | Satoshi shell, Inter metrics, system monospace IDs, Geist calendar and inherited portaled content | Keep three intentional product families: Satoshi UI, Inter data, system monospace IDs. Geist remains the separate shadcn showcase family. Product popovers and tooltips must explicitly receive the product font. |
| Numeric table styles drift | Payments table uses Inter 13px; expanded chart values use Satoshi 15px | Keep the two density sizes as explicit roles, but use Inter for data in both tables. |
| Font weights are not reliably represented by loaded faces | CSS uses 400, 500, 600, 650, 670, 700. Captured Satoshi faces expose 400/500/700; Inter exposes 400/500/600/700 | Use only 400/500/600/700. Controls use 600, metrics use 700. Product HTML loads Satoshi variable (300–900) so 600 is supported. |
| Shared tokens differ from the selected scale | Shared title/panel/value sizes are 28/20/24px; Rules uses 26/16/20px | The Rules scale below is now shared through semantic recipes and legacy token aliases. |
| Automated contract is stale | Contract expects title 25px, metric 19px/670; shared CSS contains 28px, 24px/700 | Contract checks now read the shared typography stylesheet and validate the implemented 26px title, 20px/700 metric, and 13px/600 control roles. |
| Inherited line height creates slight differences | Section headings are 22.86px vs 24px; supporting text is 17.14px vs 18px | Specify line height in each semantic recipe instead of inheriting it from Card/Table. |
| Calendar has a fractional size and ineffective override | Weekdays 13.8px; month caption remains 14px despite intended 15px | Weekdays now use 14px and captions 15px; browser tests validate computed values. |
| Sidebar typography varies by page | Rules navigation is 14px; Overview remains 13px through an opt-in flag | Rules and Overview now use the same 14px role. The opt-in flag has been removed. |

## Font-family rules

| Token | Stack | Use |
| --- | --- | --- |
| `--payments-font-ui` | `"Satoshi", Inter, ui-sans-serif, system-ui, -apple-system, sans-serif` | Headings, navigation, buttons, explanatory text, badges, calendar labels and general product UI |
| `--payments-font-data` | `Inter, ui-sans-serif, system-ui, -apple-system, sans-serif` | Amounts, percentages, metric labels/values, dates/times, chart axes and numeric tooltip values |
| `--payments-font-code` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` | Customer, transaction and review identifiers |

Use UI font for human-readable outcome labels, including statuses. Use data font for their accompanying figures. A mixed tooltip may deliberately combine UI labels and data values. Numeric cells use `font-variant-numeric: tabular-nums`; IDs preserve their case and use the code font. Do not assign Inter merely because a label contains a digit, such as a policy version.

Font ownership belongs to product wrappers, including portaled wrappers. Never change a global shadcn primitive solely to fix one product page. Never use the `font` shorthand on the shell: inherit the family without resetting size, weight, or line height.

## Semantic recipes

These are implemented recipes. Size hierarchy matches the selected compact scale; explicit line heights normalize incidental inheritance. Sizes are shown in CSS pixels for design review, and should be stored as rem at a default 16px root. The role name represents a complete family/size/weight/line-height/tracking recipe, not a size utility alone.

| Recipe suffix (`--payments-type-*`) | Family | Size | Weight | Line height | Tracking | Use |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `page-title` | UI | 26px | 700 | 1.2 | -0.025em | One primary page heading |
| `metric-value` | Data | 20px | 700 | 1.5 | -0.02em | KPI values |
| `brand` | UI | 17px | 600 | 20px | -0.01em | Wordmark only |
| `state-body` | UI | 17px | 400 | 1.5 | normal | Empty/error guidance; title variant 700 |
| `section-title` | UI | 16px | 700 | 1.5 | normal | Chart and table section titles |
| `data-expanded` | Data | 15px | 400 | 1.4286 | normal | Expanded chart data table; UI header variant 500 |
| `disclosure` | UI | 15px | 500 | 1.4286 | normal | View chart data |
| `calendar-caption` | UI | 15px | 500 | 1.4286 | normal | Month/year caption |
| `calendar-day` | Data | 15px | 400 | 1 | normal | Calendar day numbers |
| `body` | UI | 14px | 400 | 1.5 | normal | Page introduction and ordinary body text |
| `navigation` | UI | 14px | 400 | 20px | normal | Sidebar/tabs; active sidebar 700, active tab 600 |
| `input` | UI | 14px | 400 | 20px | normal | Search and short input values |
| `date-filter` | Data | 14px | 400 | 20px | normal | Reporting period |
| `calendar-weekday` | UI | 14px | 400 | 20px | normal | Weekday abbreviation |
| `control` | UI | 13px | 600 | 1.5 | normal | Select rules/Create rule and equivalent actions |
| `data` | Data | 13px | 400 | 1.4286 | normal | Payment amounts/dates; amount emphasis variant 700 |
| `metadata` | UI | 13px | 400 | 1.5 | normal | Sidebar operational text; policy/count variant 500 |
| `support` | UI | 12px | 400 | 1.5 | normal | Descriptions and legend labels; legend emphasis 700 |
| `metric-label` | Data | 12px | 400 | 1.5 | normal | KPI label |
| `data-support` | Data | 12px | 400 | 1.5 | normal | Legend totals and result counts |
| `identifier` | Code | 12px | 400 | 1.4286 | normal | Customer and transaction IDs |
| `range-control` | UI | 12px | 400 | 1.4286 | normal | 7D/30D/90D; selected variant 600 |
| `table-header` | UI | 11px | 700 | 1.4286 | 0.05em | Compact payment table uppercase labels |
| `status` | UI | 11px | 700 | 1.4286 | normal | Compact status pills |
| `axis` | Data | 11px | 400 | 1.3333 | normal | Chart ticks |
| `tooltip` | UI labels / Data values | 11px | 400 / 700 | 1.7 | normal | Compact chart tooltips |

The 17px brand/state styles and 15px calendar/expanded-data styles are intentional roles. Do not use them as ad hoc intermediate sizes. Compact 11px text is a retained design choice, not a universal accessibility recommendation. Longer explanations and error messages use body/state roles rather than compact tooltip text. Ordinary navigation tooltips use the 12px support role.

## Weight rules

- 400: ordinary text and data.
- 500: metadata emphasis, disclosure labels, expanded table headers, calendar captions.
- 600: wordmark, controls, selected tabs, and selected chart ranges. Satoshi variable is loaded to support this weight.
- 700: page/section headings, amounts, selected sidebar navigation, bold labels and statuses.
- 650 and 670: removed. Do not reintroduce arbitrary intermediate weights.

[MDN's font-weight documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-weight) explains that browsers select an available face when an exact requested weight is absent. Computed `font-weight: 650` does not prove a genuine 650-weight face is rendered. The current implementation supplies Satoshi variable and uses supported standard Inter weights.

## Implementation contract

Each recipe owns `-size`, `-weight`, `-leading`, and `-tracking` tokens plus its font family. For example:

```css
--payments-type-page-title-size: 1.625rem; /* 26px */
--payments-type-page-title-weight: 700;
--payments-type-page-title-leading: 1.2;
--payments-type-page-title-tracking: -0.025em;
```

Reusable `.payments-type-page-title`, `.payments-type-section-title`, and corresponding role classes are defined in `src/payments-typography.css`. Consumers select a role rather than adding arbitrary font-size/weight declarations. Recharts ticks must reference the axis token explicitly. Do not expose a general mechanism for arbitrary per-page font sizes.

Responsive layouts may wrap text, reduce chart tick density, and scroll dense tables; they retain the role hierarchy. Density settings change padding/row height, not font size. Use a single tested font-loading path per family and preserve fallback stacks. Check popovers, calendar and tooltips separately because React portals do not inherit a shell's DOM font family.

## Adoption and verification

Rules uses semantic typography classes for titles, controls, metrics, labels, badges, IDs and chart text. Shared Payments and Overview selectors consume the same complete recipes; geometry remains in the page/component stylesheets. Legacy panel-title/data-value tokens alias the section-title/metric-value tokens to keep older consumers consistent.

Product calendars and sidebar tooltips receive explicit product typography through their wrappers. Chart tooltip labels use Satoshi and numeric values use Inter. Expanded chart data uses Inter, with Satoshi headers. Status pills and compact table headers use Satoshi. Overview transaction IDs use system monospace.

`npm run check:payments-design` checks critical typography tokens and rejects the removed intermediate weights. Browser tests cover computed typography, product calendar/tooltip/data-table families, sidebar consistency, navigation/filter state and the Overview demo workflow. Desktop/mobile snapshots cover Rules, Overview and the catalog. New role sizes require intentional review; do not update snapshots to hide unexplained differences.

The earlier audit tables record pre-migration behavior. Current implementation evidence is saved in `work/typography-standard-preview/`, including desktop/mobile images and computed styles.

[Carbon's typography system](https://carbondesignsystem.com/elements/typography/type-sets/) is a reference for assigning tokens by semantic role. Our compact sizes remain a product decision grounded in the user's selected Rules hierarchy, rather than a claim that Carbon prescribes this exact scale.
