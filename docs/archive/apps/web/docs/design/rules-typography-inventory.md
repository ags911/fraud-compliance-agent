# Rules typography inventory

Measured in Chrome on 15 September 2026 at 1440px desktop and 390px mobile widths. Sizes and weights below are computed CSS values, not proof of the exact font face used for each glyph. Repeated styles are grouped. Offscreen screen-reader text is excluded from the visible inventory.

| Text / role examples | Family | Size | Weight | Line height | Tracking |
| --- | --- | ---: | ---: | ---: | --- |
| Kepler | Satoshi | 17px | 600 | 20px | -0.17px |
| Overview; Transactions; Reviews; Insights; Settings (and repeated items) | Satoshi | 14px | 400 | 20px | normal |
| 7 | Satoshi | 13px | 500 | 18.5714px | normal |
| Rules | Satoshi | 14px | 700 | 20px | normal |
| Policy set v12 | Satoshi | 13px | 500 | 19.5px | normal |
| All systems operational | Satoshi | 13px | 400 | 19.5px | normal |
| Rules performance | Satoshi | 26px | 700 | 31.2px | -0.65px |
| Monitor payment outcomes, identify changes in rule behavior, and inspect the transactions behind them. | Satoshi | 14px | 400 | 21px | normal |
| Select rules; Create rule | Satoshi | 13px | 650 | 19.5px | normal |
| Performance | Satoshi | 14px | 650 | 20px | normal |
| 1–23 Sep 2026 | Inter | 14px | 400 | 20px | normal |
| Matching payments; Success rate; Failed & blocked; Early warnings; 1–4 of 3,424 payments | Inter | 12px | 400 | 18px | normal |
| 3,424; 93.5%; 6.8%; 18 | Inter | 20px | 670 | 30px | -0.4px |
| Payment outcomes | Satoshi | 16px | 700 | 22.8571px | normal |
| Payment volume by outcome, GBP; 7D; 90D | Satoshi | 12px | 400 | 17.1429px | normal |
| 30D | Satoshi | 12px | 650 | 17.1429px | normal |
| Successful; Failed & blocked; Refunded; Disputed; Early fraud warning | Satoshi | 12px | 700 | 17.1429px | normal |
| £599,000; £118,000; £45,000; £24,000; £20,000 | Inter | 12px | 400 | 17.1429px | normal |
| 1 Sep; 3 Sep; 5 Sep; 7 Sep; 9 Sep (and repeated items) | Inter | 11px | 400 | 14.6667px | normal |
| View chart data | Satoshi | 15px | 500 | 21.4286px | normal |
| Matching payments | Satoshi | 16px | 700 | 24px | normal |
| Transactions influenced by the selected rules and date range | Satoshi | 12px | 400 | 18px | normal |
| AMOUNT; STATUS; CUSTOMER; DATE; ACTIONS | Inter | 11px | 700 | 15.7143px | 0.55px |
| £141.00 GBP; £84.20 GBP; £62.00 GBP; £11.00 GBP | Inter | 13px | 700 | 18.5714px | normal |
| Disputed; Succeeded; Early fraud warning; Refund pending | Inter | 11px | 700 | 15.7143px | normal |
| cus_JF019FNas284NF; cus_NAQk8Q825nadfh; cus_mxbOQJE25T7nzkN; cus_fgbs8152ABSbf46 | System monospace | 12px | 400 | 17.1429px | normal |
| Today, 09:54; •••; Today, 09:41; Today, 09:18; Today, 08:57 | Inter | 13px | 400 | 18.5714px | normal |
| £0k | Geist | 11px | 400 | 16.5px | normal |

## Expanded chart table

Headers: Satoshi, 15px, 500, 21.43px line height. Body dates and currency values: Satoshi, 15px, 400, 21.43px line height. Numeric cells use tabular figures but currently retain the UI family.

## Distribution tooltip

Inter, 11px; labels at 400 and values at 700; 18.7px row line height. The bar-chart tooltip uses the same 11px / 1.7 row recipe by source inspection.

## Calendar

Month caption: Geist, **14px**, 500, 20px line height. Weekdays: Geist, 13.8px, 400, 19.71px line height. Day numbers: Geist, 15px, 400, 15px line height. The intended 15px month-caption override does not win in the rendered page; this corrects the earlier audit’s claimed caption size.

## Conditional and inherited styles

Source inspection: payment empty/error title is Satoshi 17px/700; guidance is Satoshi 17px/400 with inherited 1.5 line height. Chart empty text is Satoshi 15px/400 with inherited 1.4286 line height. Shared sidebar tooltips use Geist 12px/400; they are portaled outside the Satoshi shell. Loading skeletons and arrow icons have no visible text size.

## Responsive and font evidence

Main visible text sizes remain the same at 390px. Text wrapping, table scrolling, and sidebar presentation change rather than the type scale. Raw desktop/mobile records, calendar records, and FontFace declarations are in `work/rules-typography-audit/computed-styles.json`.

Declared font faces in this run: Satoshi 400, 500, 700; Inter 400, 500, 600, 700 (separate subset declarations); Geist variable range 100–900. Satoshi has no declared 600 face in this capture despite the HTML requesting it. The computed 600, 650, and 670 values should not be interpreted as confirmation that those exact glyph weights are rendered.
