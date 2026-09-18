import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

// Recharts' <Bar> animates with these defaults (duration 1500ms, CSS
// "ease" curve) — mirrored here so the horizontal distribution bar's
// segments grow in sync with the vertical chart's bars on mount.
const barGrowTransition = { duration: 1.5, ease: [0.25, 0.1, 0.25, 1] } as const

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type RulesPerformanceDatum = {
  date: string
  successful: number
  blocked: number
  refunded: number
  disputed: number
  fraudWarning: number
}

type OutcomeKey = Exclude<keyof RulesPerformanceDatum, "date">

const outcomes = [
  {
    key: "successful",
    label: "Successful",
    color: "var(--chart-successful)",
  },
  {
    key: "blocked",
    label: "Failed & blocked",
    color: "var(--chart-blocked)",
  },
  {
    key: "refunded",
    label: "Refunded",
    color: "var(--chart-refunded)",
  },
  {
    key: "disputed",
    label: "Disputed",
    color: "var(--chart-disputed)",
  },
  {
    key: "fraudWarning",
    label: "Early fraud warning",
    color: "var(--chart-fraud-warning)",
  },
] as const satisfies ReadonlyArray<{
  key: OutcomeKey
  label: string
  color: string
}>

const allKeys = outcomes.map((o) => o.key)

const chartConfig = Object.fromEntries(
  outcomes.map(({ key, label, color }) => [key, { label, color }])
) as ChartConfig

const volumeFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
})

const countFormatter = new Intl.NumberFormat("en-GB")


export type ChartRangeOption = 7 | 30 | 90

const rangeChoices: ChartRangeOption[] = [7, 30, 90]

export function RulesPerformanceChart({
  data,
  matchingPayments,
  className,
  title = "Rules performance",
  description,
  activeRange,
  onRangeChange,
  compact = false,
}: {
  data: RulesPerformanceDatum[]
  matchingPayments: number
  className?: string
  title?: string
  description?: string
  /** When provided (with onRangeChange), renders the 7D/30D/90D toggle in
   * the panel header. Omit both to hide the toggle entirely. */
  activeRange?: ChartRangeOption
  onRangeChange?: (range: ChartRangeOption) => void
  /** Compact density: 245px chart height instead of 285px. */
  compact?: boolean
}) {
  const [activeSeries, setActiveSeries] = useState<Set<OutcomeKey>>(
    () => new Set(allKeys)
  )
  const totals = useMemo(
    () =>
      outcomes.map((outcome) => ({
        ...outcome,
        value: data.reduce((sum, item) => sum + item[outcome.key], 0),
      })),
    [data]
  )
  const visibleTotal = totals.reduce(
    (sum, outcome) => (activeSeries.has(outcome.key) ? sum + outcome.value : sum),
    0
  )
  const distributionDenominator = Math.max(visibleTotal, 1)
  const [hoveredKey, setHoveredKey] = useState<OutcomeKey | null>(null)
  const [segmentCenter, setSegmentCenter] = useState(0)
  const [tooltipLeft, setTooltipLeft] = useState(0)
  const distributionWrapRef = useRef<HTMLDivElement>(null)
  const distributionTooltipRef = useRef<HTMLDivElement>(null)
  const hoveredTotal = totals.find((outcome) => outcome.key === hoveredKey)

  function showSegmentTooltip(key: OutcomeKey, segment: HTMLElement) {
    setHoveredKey(key)
    setSegmentCenter(segment.offsetLeft + segment.offsetWidth / 2)
  }

  // The tooltip auto-widens to fit its content (no fixed width, no
  // line-wrapping), so its actual width isn't known until after it's
  // rendered — re-center/clamp it against the real measured width here,
  // which runs before the browser paints so there's no visible jump.
  useLayoutEffect(() => {
    if (hoveredKey === null) return
    const wrap = distributionWrapRef.current
    const tooltip = distributionTooltipRef.current
    if (!wrap || !tooltip) return
    const wrapWidth = wrap.clientWidth
    const tooltipWidth = tooltip.offsetWidth
    const left = segmentCenter - tooltipWidth / 2
    setTooltipLeft(Math.max(0, Math.min(left, wrapWidth - tooltipWidth)))
  }, [hoveredKey, segmentCenter])

  function toggleSeries(key: OutcomeKey) {
    setActiveSeries((current) => {
      const next = new Set(current)
      if (next.has(key) && next.size > 1) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const chartDescription =
    description ??
    `${countFormatter.format(matchingPayments)} matching payments. Daily payment volume in thousands of pounds, grouped by outcome.`

  return (
    <Card className={cn("overflow-hidden [--card-spacing:0px] gap-0 ring-0", className)}>
      <CardHeader className="flex !flex-row items-start justify-between gap-[18px] border-b !pb-[17px] px-[18px] pt-[17px] max-[760px]:block">
        <div>
          <CardTitle className="payments-type-section-title">{title}</CardTitle>
          <CardDescription className="mt-[5px] payments-type-support">{chartDescription}</CardDescription>
        </div>
        {activeRange && onRangeChange ? (
          <div
            className="flex w-fit shrink-0 gap-0.5 rounded-[8px] border border-[#e3e8ee] bg-muted p-0.5 max-[760px]:mt-3"
            aria-label="Chart date range"
          >
            {rangeChoices.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={activeRange === range}
                onClick={() => onRangeChange(range)}
                className={cn(
                  "h-[27px] min-w-9.5 cursor-pointer rounded-[6px] payments-type-range-control text-muted-foreground",
                  activeRange === range &&
                    "bg-background text-foreground font-semibold shadow-[0_1px_2px_rgba(10,37,64,0.08)]"
                )}
              >
                {range}D
              </button>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="px-[18px] pt-[17px] pb-3 max-[760px]:px-[10px]">
        {data.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed payments-type-disclosure text-muted-foreground">
            No matching payment activity for this period.
          </div>
        ) : (
          <>
            <div className="relative" ref={distributionWrapRef}>
              <div
                className="flex h-[9px] overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={totals
                  .map(
                    ({ label, value }) =>
                      `${label}: ${volumeFormatter.format(value * 1000)}`
                  )
                  .join(", ")}
              >
                {totals.map(({ key, value, color }, index) => {
                  if (!activeSeries.has(key)) return null
                  const percentage = (value / distributionDenominator) * 100
                  return (
                    <motion.button
                      key={key}
                      type="button"
                      className={cn(
                        "h-full cursor-pointer first:rounded-l-full last:rounded-r-full",
                        index > 0 && "shadow-[-1px_0_0_#ffffff]"
                      )}
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={barGrowTransition}
                      aria-label={`${outcomes.find((o) => o.key === key)?.label}: ${volumeFormatter.format(value * 1000)}, ${percentage.toFixed(1)}% of visible volume`}
                      onMouseEnter={(event) => showSegmentTooltip(key, event.currentTarget)}
                      onFocus={(event) => showSegmentTooltip(key, event.currentTarget)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onBlur={() => setHoveredKey(null)}
                    />
                  )
                })}
              </div>
              {hoveredTotal ? (
                <div
                  ref={distributionTooltipRef}
                  role="tooltip"
                  className="absolute bottom-[17px] z-10 w-max min-w-0 rounded-[8px] border bg-popover p-2.5 payments-type-tooltip whitespace-nowrap text-popover-foreground tabular-nums shadow-[0_8px_22px_rgba(10,37,64,0.14)]"
                  style={{ left: tooltipLeft, fontFamily: "var(--payments-font-ui)" }}
                >
                  <div className="flex items-center justify-between gap-3.5 leading-[1.7]">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: hoveredTotal.color }}
                      />
                      {hoveredTotal.label}
                    </span>
                    <strong className="payments-type-tooltip-value">{volumeFormatter.format(hoveredTotal.value * 1000)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3.5 leading-[1.7]">
                    <span className="text-muted-foreground">Share</span>
                    <strong className="payments-type-tooltip-value">
                      {((hoveredTotal.value / distributionDenominator) * 100).toFixed(1)}%
                    </strong>
                  </div>
                </div>
              ) : null}
            </div>
            <ul
              className="mt-[11px] mb-[6px] flex flex-wrap gap-x-4 gap-y-[7px] payments-type-support"
              aria-label="Toggle payment outcome series"
            >
              {totals.map(({ key, label, color, value }) => {
                const isActive = activeSeries.has(key)
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => toggleSeries(key)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 py-0.5 text-[#425466]",
                        !isActive && "opacity-[0.42] line-through"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: color }}
                      />
                      <span className="payments-type-strong">{label}</span>
                      <span className="payments-type-data-support text-muted-foreground no-underline tabular-nums">
                        {volumeFormatter.format(value * 1000)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <ChartContainer
              config={chartConfig}
              className={cn("w-full", compact ? "h-[245px]" : "h-[285px]")}
              role="img"
              aria-label={chartDescription}
            >
              <BarChart
                accessibilityLayer
                data={data}
                margin={{ top: 16, right: 8, bottom: 0, left: 0 }}
                barCategoryGap="24%"
              >
                <CartesianGrid vertical={false} stroke="#dfe5eb" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                  minTickGap={24}
                  tick={{ fontSize: "var(--payments-type-axis-size)", fontFamily: "var(--payments-font-data)", fill: "#5f708a" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tickFormatter={(value: number) => `£${value}k`}
                  tick={{ fontSize: "var(--payments-type-axis-size)", fontFamily: "var(--payments-font-data)", fill: "#5f708a" }}
                  width={54}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.65 }}
                  // Not using ChartTooltipContent's `formatter` prop here —
                  // when a formatter is supplied it's expected to return the
                  // *entire* row's JSX, not just [value, name]; shadcn skips
                  // its own swatch/spacing/layout in that case, which
                  // rendered as an unstyled "£55kSuccessful" wall of text.
                  // A fully custom row (matching the mockup's
                  // .fc-tooltip-row exactly) is more reliable than fighting
                  // that contract.
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    // Bars render bottom-to-top in reverse `outcomes` order
                    // (see below) so "Successful" draws on top of the
                    // stack; the tooltip payload follows that same render
                    // order, so reverse it back to read top-to-bottom.
                    const rows = [...payload]
                      .reverse()
                      .filter((item) => activeSeries.has(item.dataKey as OutcomeKey))
                    return (
                      <div
                        className="min-w-[150px] rounded-[8px] border border-[#e3e8ee] bg-popover p-2.5 payments-type-tooltip text-popover-foreground shadow-[0_8px_22px_rgba(10,37,64,0.14)]"
                      >
                        <div className="mb-1.5 payments-type-strong whitespace-nowrap">{String(label)}</div>
                        {rows.map((item) => {
                          const key = item.dataKey as OutcomeKey
                          const outcome = outcomes.find((o) => o.key === key)
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3.5 leading-[1.7] whitespace-nowrap"
                            >
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                <span
                                  aria-hidden="true"
                                  className="size-2 shrink-0 rounded-[2px]"
                                  style={{ backgroundColor: outcome?.color }}
                                />
                                {outcome?.label}
                              </span>
                              <strong className="payments-type-tooltip-value">£{item.value}k</strong>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }}
                />
                {[...outcomes]
                  .reverse()
                  .filter(({ key }) => activeSeries.has(key))
                  .map(({ key }, index, visible) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="outcomes"
                    fill={`var(--color-${key})`}
                    stroke="#ffffff"
                    strokeWidth={0.7}
                    radius={index === visible.length - 1 ? [3, 3, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ChartContainer>

            <details className="group mt-3 rounded-lg border">
              <summary className="cursor-pointer px-4 py-3 payments-type-disclosure focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                View chart data
              </summary>
              <div className="border-t px-2 pb-2">
                <Table className="payments-type-data-expanded">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="payments-type-expanded-header">Date</TableHead>
                      {outcomes.map(({ key, label }) => (
                        <TableHead key={key} className="payments-type-expanded-header text-right">
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item) => (
                      <TableRow key={item.date}>
                        <TableCell>{item.date}</TableCell>
                        {outcomes.map(({ key }) => (
                          <TableCell className="text-right tabular-nums" key={key}>
                            £{item[key]}k
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  )
}
