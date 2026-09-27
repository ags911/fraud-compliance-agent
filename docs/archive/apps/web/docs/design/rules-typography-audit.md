# Rules page typography audit

Audited 15 September 2026. Page: `/rules-performance.html`, implemented by `src/references/RulesPerformanceReference.tsx` with the shared sidebar and rules chart.

**Verdict: the hierarchy is sound, but I would not keep the current sizing throughout.** The title and section headings are legible. Too much essential information—payment status, chart units, legend totals, KPI labels, and customer identifiers—is set at 10–11px. Prioritize increasing these over enlarging the title.

## Benchmarks and interpretation

There is no single industry-standard minimum size for every UI. [IBM Carbon](https://carbondesignsystem.com/elements/typography/type-sets/) provides a useful enterprise dashboard benchmark: 14px productive body text, 16px expressive body text, and 12px supporting labels/helper text. [GOV.UK](https://design-system.service.gov.uk/styles/type-scale/) takes a more generous approach, with 19px body text and 16px small body text. Those are reference systems, not mandatory sizes for this product.

For this dashboard, my recommendation is **14px for frequently read data and controls, 14–16px for explanatory copy, and 12px as the lower bound for brief supporting labels**. These are audit recommendations based on the role of each element, rather than a claim that all design systems prescribe these exact numbers.

[WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) requires 4.5:1 contrast for ordinary text and 3:1 for large text (24px regular or approximately 18.67px bold). [WCAG text resizing](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) requires resizing to 200% without losing content or functionality. WCAG does not impose a universal minimum font size. A small size alone is not a WCAG failure, and a larger size alone does not establish accessibility.

## Comments on every text style

Sizes are CSS pixels. Repeated elements with the same role and styling share a row; all labels in each group are covered. Main-page sizes, expanded chart table, calendar text, and distribution tooltip were checked in Chrome. Bar-chart tooltip and conditional empty/error states were inspected in source. Measurements used a default 16px root font size.

| Text element | Current size | Recommended size | Audit comment against the benchmarks |
| --- | ---: | ---: | --- |
| Kepler wordmark | 16px | Keep 16px | Comfortable for a short brand label; matches the larger Carbon base size. |
| Sidebar: Overview, Transactions, Reviews, Rules, Insights, Settings | 13px | 14px | Slightly below Carbon's productive base. Increase for navigation scanning; retain weight/color cues for the active page. |
| Reviews count: 7 | 12px | Keep 12px | Appropriate brief supporting information, consistent with Carbon's label scale. |
| Sidebar: Policy set v12 | 12px | Keep 12px | Suitable metadata at the supporting-text size. |
| Sidebar: All systems operational | 12px | 12–14px | Acceptable brief supporting text. Use 14px if operational status needs frequent attention; check the muted color separately. |
| Search placeholder and entered query | 13px | 14px desktop; 16px mobile | A frequently used input deserves the productive body size. A larger mobile input makes reading and editing easier. |
| Rules performance title | 25px, bold; 30px line height | Keep 25px; optionally 28px | Clear page hierarchy and comfortable size. Carbon's 28px layout heading is a reference, not a reason this must change. |
| Page introduction | 13px; 19.5px line height | 14–16px; 1.5 line height | Below both referenced body scales. Line spacing is reasonable, but the sentence is forced into one truncated line; allow wrapping. |
| Select rules button | 12px | 14px | A task control rather than a caption. Increase to the productive body scale for easier recognition. |
| Create rule button | 12px | 14px | Same recommendation; bold weight does not replace sufficient text size. |
| Tabs: Overview, Performance, Lists, Activity | 13px | 14px | Slightly small for frequently scanned navigation; align with the sidebar and controls. |
| Reporting-period date | 13px | 14px | A key filter should be easy to verify. Inter and tabular numerals help, but a size increase improves comfort. |
| KPI labels: Matching payments, Success rate, Failed & blocked, Early warnings | 11px | 12–14px | Below Carbon's supporting label size. These labels determine the meaning of the metrics; prefer 14px when space allows. |
| KPI values: 3,424, 93.5%, 6.8%, 18 | 19px; 28.5px line height | Keep 19px; optionally 22–24px | Readable with good emphasis. Enlargement is a hierarchy choice, lower priority than fixing the labels. |
| Payment outcomes heading | 15px, bold | Keep 15px; optionally 16px | Between Carbon's 14px and 16px compact heading styles. Legible; 16px would simplify the scale. |
| Chart description: Payment volume by outcome, GBP | 11px | 12–14px | Below the supporting scale. Units explain the chart and should not require effort to read. |
| Chart presets: 7D, 30D, 90D | 11px | 13–14px | Below the supporting scale despite being interactive filters. Increase text and adjust the control dimensions if needed. |
| Legend labels: Successful, Failed & blocked, Refunded, Disputed, Early fraud warning | 11px, bold | 12–14px | Below the supporting scale. These are both labels and series controls; 14px is preferable for repeated use. |
| Legend currency totals | 11px | 12–14px | Important comparison data, not incidental decoration. Prefer 14px; allow the legend to wrap rather than shrinking it. |
| X-axis dates | 10px | 12px | Smaller than the supporting benchmark. Increase text and reduce tick density if necessary to avoid collisions. |
| Y-axis currency labels | 10px | 12px | Essential quantitative labels are too small for comfortable scanning. Retain sufficient axis width when increasing size. |
| Distribution tooltip: outcome, total, Share, percentage | 10px; rows at 17px line height | 12–14px | Good relative row spacing, but tiny glyphs. Tooltips supply exact values and should be readable without magnification. |
| Bar-chart tooltip: date, outcomes, currency values | 10px; rows at 17px line height | 12–14px | Same concern. Increase the tooltip text and let its container accommodate the content. Source inspected. |
| View chart data disclosure | 14px; 20px line height | Keep 14px | Matches Carbon's productive body scale and is a good baseline for other controls. |
| Expanded chart data table: headers, dates, all outcome values | 14px; 20px line height | Keep 14px | Comfortable enterprise data size. The payment table should approach this level of legibility. |
| Matching payments section heading | 15px, bold; 22.5px line height | Keep 15px; optionally 16px | Appropriate compact section heading, consistent with the chart heading. |
| Matching payments explanatory sentence | 11px; 16.5px line height | 14px | A complete explanatory sentence deserves body sizing rather than text smaller than a supporting label. |
| Payment table headers: AMOUNT, STATUS, CUSTOMER, DATE, ACTIONS | 10px, bold, uppercase | 12px minimum; preferably 14px | Below the supporting scale. Uppercase and letter spacing cannot compensate for tiny text. Sentence case would also soften the visual density. |
| Payment amounts | 12px, bold | 14px | Core transaction data is currently at supporting-text size. Use the productive body scale for reliable repeated reading. |
| Status badges: Disputed, Succeeded, Early fraud warning, Refund pending; shared Failed/Blocked/Refunded variants | 10px, bold | 12–14px | Highest-priority change: these communicate the outcome and potential risk. Increase badge height/padding along with text if needed. |
| Customer identifiers | 11px, monospace | 13–14px | Below even Carbon's 12px code style. Similar-looking characters in IDs benefit from larger monospace text and sufficient column width. |
| Payment dates/times | 12px | 14px | Core table data should use the same legibility baseline as the amounts and IDs. |
| Row action glyph: ••• | 12px | 14–16px, or an SVG icon | Size mainly affects discoverability here rather than reading. The existing accessible name helps; keep a comfortably sized control. |
| Pagination: 1–4 of 3,424 payments | 11px | 12–14px | Below the supporting scale. Increase so users can easily understand their position in the results. |
| Calendar month captions | 14px | Keep 14px | Suitable compact heading/control text at the productive base. |
| Calendar weekday labels | 12.8px | Keep approximately 13px | Brief supporting labels above the 12px reference; reasonable for a compact calendar. |
| Calendar day numbers | 14px | Keep 14px | Appropriate productive-size text. Single-line numerals do not need paragraph-like line spacing. |
| Empty payments message and guidance | Inherited 16px | Keep 16px | Appropriate body size for explaining how to recover. Source inspected; no explicit font-size override. |
| Payment error message and guidance | Inherited 16px | Keep 16px | Readable body size for an important recovery state. Source inspected. |
| Chart empty-state sentence | 14px | Keep 14px | Appropriate productive body size. Source inspected. |
| Sidebar hover/collapsed-navigation tooltips | 12px | 12–14px | Meets the supporting benchmark; 14px would make longer availability explanations easier to read. Source inspected. |

The loading skeleton has no visible text to size. Sidebar toggle and pagination arrows are icons, with accessible names rather than visible labels; they need interaction/target-size review rather than a font-size judgment.

## Implementation and responsive observations

- At 390px viewport width, the main text styles retain their desktop sizes. The introduction truncates and the tables use horizontal scrolling. Improve narrow-screen legibility by wrapping copy and retaining readable data sizes, rather than reducing type further.
- Satoshi is used for the page UI, Inter for much of the numeric data, and a system monospace stack for customer IDs. The portaled calendar uses Geist. Font choice and character shapes affect perceived legibility even when pixel sizes match.
- The shared payments design system defines larger title, panel-heading, and metric tokens (28px, 20px, 24px), but this page uses explicit 25px, 15px, and 19px classes. Those token values are not the current rendered sizes and are not themselves an industry standard.
- Most supporting text already has roughly 1.4–1.5 line height. The primary weakness is glyph size, not insufficient line spacing. Preserve sensible spacing when increasing sizes.
- Prefer rem-based semantic typography tokens when implementing the revised scale so it can respond to root text-size preferences. Pixel sizing is not automatically a WCAG failure.

## Recommended order

1. Increase 10px statuses, axes, tooltips, and table headers to at least 12px.
2. Set primary controls and payment data to 14px; increase customer IDs to 13–14px.
3. Bring 11px labels to 12–14px and explanatory sentences to 14–16px.
4. Keep the existing heading hierarchy, optionally normalize section headings to 16px, and let the introduction wrap.
5. Verify contrast, 200% resizing, user text-spacing overrides, and narrow-screen layout after implementation. This audit does not certify WCAG conformance; those functional checks were not performed.

## Current preview: original scale +1px

The larger redesign was replaced at the user's request. The current page restores the original control heights, badge dimensions, axis width, and single-line introduction, with a consistent 1px increase over the original text scale:

| Original | Current | Roles |
| ---: | ---: | --- |
| 10px | 11px | Status badges, payment headers, axes, chart tooltips |
| 11px | 12px | KPI labels, chart descriptions and legends, customer IDs, pagination |
| 12px | 13px | Action buttons, amounts, payment dates, sidebar metadata/count |
| 13px | 14px | Search, navigation, introduction, reporting period |
| 14px | 15px | Chart disclosure/data table, calendar captions and days |
| 15px | 16px | Section headings |
| 16px | 17px | Wordmark and payment empty/error messages |
| 19px | 20px | KPI values |
| 25px | 26px | Page title |

Calendar weekday labels increase from 12.8px to 13.8px. Font families, weights, tracking, and the original hierarchy are retained. The initial recommendations above remain an audit record; the current implementation follows the user's preference for a modest increase.

Follow-up browser measurement found that the month-caption override does not win: captions remain 14px, not the intended 15px listed above. See [the complete measured inventory](rules-typography-inventory.md) and [the typography standard](typography-standard.md) for current families, weights, line heights, and adoption decisions.

Rules navigation opts into the larger shared sidebar typography; Overview retains its current navigation size. The Rules reference entry point shares the updated page implementation. Current desktop and mobile previews are saved in `work/rules-typography-preview/`.
