# Payments colors + shadcn defaults

An independent Payments design-system reference. Preview at `/shadcn-defaults.html`; the existing fraud compliance console remains at `/`.

## Styling contract

Use the repository's installed **shadcn radix-nova preset**. Keep generated component classes intact. Only semantic color tokens and color-only status variants are customized.

- Font: the preset's Geist Variable.
- Base radius: the original generated 0.625rem, with the preset's derived radius scale.
- Buttons, inputs, cards, badges, tabs, sliders, tables, and chart helpers: generated sizes, padding, borders, shadows, and focus behavior.
- No compact card overrides, bespoke pills, enlarged slider thumb, pointer cursor override, 14px body override, custom touch sizing, or global animation override.
- Page composition still uses ordinary Tailwind layout utilities; shadcn does not define a universal page layout or metric-card component.
- Light theme only. Payment and chart colors follow the Payments palette in `src/shadcn-defaults-theme.css`.
- Normal-size foreground text meets WCAG AA contrast against its intended surface.
- Outcome information is never communicated by color alone.

## Data visualization

`RulesPerformanceChart` is an original Payments composition built on the generated shadcn chart helper and Recharts. It provides:

- Semantic outcome tokens rather than positional color references.
- A text summary and labelled legend.
- Recharts' keyboard-accessible SVG layer.
- A responsive chart area with an explicit initial dimension.
- A native, expandable data table for exact-value inspection.
- An empty state for periods without matching activity.

Keep chart data numeric and presentation-neutral. Currency, date range, and aggregation labels should be supplied by the product context rather than encoded into primitive components.

## Files

- `src/shadcn-defaults-theme.css`: colors, original preset font, and original preset radius.
- `src/shadcn-defaults.css`: independent Tailwind/shadcn entry and semantic mappings.
- `src/ShadcnDefaults.tsx`: component reference using unmodified primitives.
- `src/components/rules-performance-chart.tsx`: reusable Rules Performance composition.
- `src/components/payments.tsx`: Payments-specific, color-only variants and compositions.
- `src/components/ui/chart.tsx`: generated shadcn chart helper.
- `shadcn-defaults.html`: separate runnable page, included in the production build.

For reuse, import `shadcn-defaults.css` once at the application entry instead of `index.css`. Do not import both themes into the same document. Continue importing primitives from `@/components/ui/*`; use `components/payments.tsx` for the Payments-specific, color-only variants and compositions.

```tsx
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

<Button>Start experiment</Button>
<Badge className="bg-success-soft text-success">Succeeded</Badge>
<Card>
  <CardHeader><CardTitle>Accepted payments</CardTitle></CardHeader>
  <CardContent>140.5K</CardContent>
</Card>
```

All primitive styling comes from the installed generated primitives. Update those through the shadcn CLI when intentionally upgrading the preset; keep product compositions outside `src/components/ui`.
