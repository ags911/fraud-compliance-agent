import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { motion } from "motion/react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { evenTicks } from "@/lib/chart-ticks"
import type { ScenarioRange } from "@/lib/scenario-date-window"

import { RadarRangeToggle } from "./RadarRangeToggle"

// Recharts' <Bar> animates with these defaults (duration 1500ms, CSS
// "ease" curve) -- mirrored here so the horizontal distribution bar's
// segments grow in sync with the vertical chart's bars on mount, the same
// pairing RulesPerformanceChart uses.
const barGrowTransition = { duration: 1.5, ease: [0.25, 0.1, 0.25, 1] } as const

export type RadarRecommendation = "PASS" | "CHALLENGE" | "HOLD"

/** One x-axis category (a scenario, day or week), split by final recommendation. */
export type RadarRecommendationDatum = { label: string } & Record<RadarRecommendation, number>

const outcomes = [
  { key: "PASS", label: "PASS", color: "var(--sev-low)" },
  { key: "CHALLENGE", label: "CHALLENGE", color: "var(--sev-moderate)" },
  { key: "HOLD", label: "HOLD", color: "var(--sev-high)" },
] as const satisfies ReadonlyArray<{ key: RadarRecommendation; label: string; color: string }>

const allKeys = outcomes.map((outcome) => outcome.key)

const chartConfig = Object.fromEntries(
  outcomes.map(({ key, label, color }) => [key, { label, color }]),
) as ChartConfig

const countFormatter = new Intl.NumberFormat("en-GB")

function runsLabel(count: number): string {
  return `${countFormatter.format(count)} ${count === 1 ? "run" : "runs"}`
}

type RadarRecommendationChartProps = {
  data: readonly RadarRecommendationDatum[]
  title: string
  description: string
  /** Header of the "View chart data" table's first column, e.g. "Scenario". */
  categoryLabel: string
  emptyMessage: string
  /** Short data-source label shown as a pill beside the title, e.g. "Mock data". */
  badge?: string
  /** When provided (with onRangeChange), renders the 7D/30D/All toggle in
   * the card header, as RulesPerformanceChart does. */
  activeRange?: ScenarioRange
  onRangeChange?: (range: ScenarioRange) => void
  /** Show y-axis count labels at this width, matching a neighbouring chart's
   * axis so the two plots line up. Omit to hide the axis and use the full width. */
  yAxisWidth?: number
  /** Rendered at the bottom of the card body, e.g. a run error. */
  children?: ReactNode
}

/**
 * The Rules Performance card (src/components/rules-performance-chart.tsx) --
 * header, distribution bar with hover tooltips, toggleable legend, stacked
 * bar chart and "View chart data" disclosure -- restyled with this page's
 * LCH tokens and stacked by final recommendation. Used for both the
 * Session tab's breakdown by scenario and the Scenario tab's daily history.
 */
export function RadarRecommendationChart({
  data,
  title,
  description,
  categoryLabel,
  emptyMessage,
  activeRange,
  onRangeChange,
  badge,
  yAxisWidth,
  children,
}: RadarRecommendationChartProps) {
  const [activeSeries, setActiveSeries] = useState<Set<RadarRecommendation>>(() => new Set(allKeys))
  const totals = useMemo(
    () => outcomes.map((outcome) => ({ ...outcome, value: data.reduce((sum, item) => sum + item[outcome.key], 0) })),
    [data],
  )
  const total = totals.reduce((sum, outcome) => sum + outcome.value, 0)
  const visibleTotal = totals.reduce((sum, outcome) => (activeSeries.has(outcome.key) ? sum + outcome.value : sum), 0)
  const distributionDenominator = Math.max(visibleTotal, 1)
  const yTicks = useMemo(
    () => evenTicks(Math.max(0, ...data.map((item) => allKeys.reduce((sum, key) => (activeSeries.has(key) ? sum + item[key] : sum), 0)))),
    [activeSeries, data],
  )
  const [hoveredKey, setHoveredKey] = useState<RadarRecommendation | null>(null)
  const [segmentCenter, setSegmentCenter] = useState(0)
  const [tooltipLeft, setTooltipLeft] = useState(0)
  const distributionWrapRef = useRef<HTMLDivElement>(null)
  const distributionTooltipRef = useRef<HTMLDivElement>(null)
  const hoveredTotal = totals.find((outcome) => outcome.key === hoveredKey)

  function showSegmentTooltip(key: RadarRecommendation, segment: HTMLElement) {
    setHoveredKey(key)
    setSegmentCenter(segment.offsetLeft + segment.offsetWidth / 2)
  }

  // Re-center/clamp the auto-width tooltip against its measured width
  // before paint, so it never overflows the card or visibly jumps.
  useLayoutEffect(() => {
    if (hoveredKey === null) return
    const wrap = distributionWrapRef.current
    const tooltip = distributionTooltipRef.current
    if (!wrap || !tooltip) return
    const left = segmentCenter - tooltip.offsetWidth / 2
    setTooltipLeft(Math.max(0, Math.min(left, wrap.clientWidth - tooltip.offsetWidth)))
  }, [hoveredKey, segmentCenter])

  function toggleSeries(key: RadarRecommendation) {
    setActiveSeries((current) => {
      const next = new Set(current)
      if (next.has(key) && next.size > 1) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <section className="chart-card radar-chart-card radar-outcome-card">
      <div className="radar-outcome-header">
        <div>
          <div className="radar-outcome-title-row">
            <div className="card-title">{title}</div>
            {badge ? <span className="radar-source-pill">{badge}</span> : null}
          </div>
          <p className="card-copy">{description}</p>
        </div>
        {activeRange && onRangeChange ? <RadarRangeToggle label="Chart date range" onChange={onRangeChange} value={activeRange} /> : null}
      </div>
      <div className="radar-outcome-body">
        {total === 0 ? (
          <p className="radar-chart-empty">{emptyMessage}</p>
        ) : (
          <>
            <div className="radar-outcome-distribution-wrap" ref={distributionWrapRef}>
              <div
                aria-label={totals.map(({ label, value }) => `${label}: ${runsLabel(value)}`).join(", ")}
                className="radar-outcome-distribution"
                role="img"
              >
                {totals.map(({ key, label, value, color }) => {
                  if (!activeSeries.has(key)) return null
                  const percentage = (value / distributionDenominator) * 100
                  return (
                    <motion.button
                      animate={{ width: `${percentage}%` }}
                      aria-label={`${label}: ${runsLabel(value)}, ${percentage.toFixed(1)}% of visible runs`}
                      className="radar-outcome-distribution-segment"
                      initial={{ width: 0 }}
                      key={key}
                      onBlur={() => setHoveredKey(null)}
                      onFocus={(event) => showSegmentTooltip(key, event.currentTarget)}
                      onMouseEnter={(event) => showSegmentTooltip(key, event.currentTarget)}
                      onMouseLeave={() => setHoveredKey(null)}
                      style={{ backgroundColor: color }}
                      transition={barGrowTransition}
                      type="button"
                    />
                  )
                })}
              </div>
              {hoveredTotal ? (
                <div className="radar-outcome-tooltip radar-outcome-tooltip-floating" ref={distributionTooltipRef} role="tooltip" style={{ left: tooltipLeft }}>
                  <div className="radar-outcome-tooltip-row">
                    <span className="radar-outcome-tooltip-label">
                      <span aria-hidden="true" className="radar-outcome-swatch" style={{ backgroundColor: hoveredTotal.color }} />
                      {hoveredTotal.label}
                    </span>
                    <strong>{countFormatter.format(hoveredTotal.value)}</strong>
                  </div>
                  <div className="radar-outcome-tooltip-row">
                    <span className="radar-outcome-tooltip-label">Share</span>
                    <strong>{((hoveredTotal.value / distributionDenominator) * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              ) : null}
            </div>

            <ul aria-label="Toggle recommendation outcomes" className="radar-outcome-legend">
              {totals.map(({ key, label, color, value }) => (
                <li key={key}>
                  <button aria-pressed={activeSeries.has(key)} className="radar-outcome-toggle" onClick={() => toggleSeries(key)} type="button">
                    <span aria-hidden="true" className="radar-outcome-swatch" style={{ backgroundColor: color }} />
                    <span className="radar-outcome-name">{label}</span>
                    <span className="radar-outcome-count">{countFormatter.format(value)}</span>
                  </button>
                </li>
              ))}
            </ul>

            <ChartContainer aria-label={description} className="h-[285px] w-full" config={chartConfig} role="img">
              {/* Plot styling follows the Linear-style Insights Dashboard
                  reference (same reading as RadarRiskLevelChart): thin
                  square bars, dashed horizontal gridlines, a solid baseline
                  and no y-axis numbers -- exact counts live in the tooltip
                  and the "View chart data" table. */}
              <BarChart accessibilityLayer data={[...data]} margin={{ top: 16, right: 8, bottom: 0, left: yAxisWidth ? 0 : 8 }}>
                <CartesianGrid stroke="var(--lch-border)" strokeDasharray="3 4" vertical={false} />
                <XAxis
                  axisLine={{ stroke: "var(--lch-border)" }}
                  dataKey="label"
                  minTickGap={24}
                  tick={{ fill: "var(--lch-text-tertiary)", fontSize: 11, fontFamily: "Inter, sans-serif" }}
                  tickLine={false}
                  tickMargin={12}
                />
                {yAxisWidth ? (
                  <YAxis
                    axisLine={false}
                    domain={[0, yTicks[yTicks.length - 1]]}
                    tick={{ fill: "var(--lch-text-tertiary)", fontSize: 11, fontFamily: "Inter, sans-serif" }}
                    tickFormatter={(value: number) => countFormatter.format(value)}
                    tickLine={false}
                    tickMargin={10}
                    ticks={yTicks}
                    width={yAxisWidth}
                  />
                ) : (
                  <YAxis domain={[0, yTicks[yTicks.length - 1]]} hide ticks={yTicks} />
                )}
                <ChartTooltip
                  cursor={{ fill: "var(--lch-bg-hover)", fillOpacity: 0.5 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    // Bars render bottom-to-top in reverse `outcomes` order,
                    // and the payload follows that render order -- reverse it
                    // back so the tooltip reads top-to-bottom.
                    const rows = [...payload].reverse().filter((item) => activeSeries.has(item.dataKey as RadarRecommendation))
                    return (
                      <div className="radar-outcome-tooltip">
                        <div className="radar-outcome-tooltip-title">{String(label)}</div>
                        {rows.map((item) => {
                          const outcome = outcomes.find((o) => o.key === item.dataKey)
                          return (
                            <div className="radar-outcome-tooltip-row" key={String(item.dataKey)}>
                              <span className="radar-outcome-tooltip-label">
                                <span aria-hidden="true" className="radar-outcome-swatch" style={{ backgroundColor: outcome?.color }} />
                                {outcome?.label}
                              </span>
                              <strong>{countFormatter.format(Number(item.value))}</strong>
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
                  .map(({ key }) => (
                    <Bar barSize={10} dataKey={key} fill={`var(--color-${key})`} key={key} radius={0} stackId="outcomes" />
                  ))}
              </BarChart>
            </ChartContainer>

            <details className="radar-chart-data">
              <summary>View chart data</summary>
              <table>
                <thead>
                  <tr>
                    <th>{categoryLabel}</th>
                    {outcomes.map(({ key, label }) => <th key={key}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      {outcomes.map(({ key }) => <td key={key}>{countFormatter.format(item[key])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
        {children}
      </div>
    </section>
  )
}
