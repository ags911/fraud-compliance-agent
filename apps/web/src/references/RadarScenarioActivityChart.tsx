import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { evenTicks } from "@/lib/chart-ticks"
import type { SandboxActivityDatum } from "@/lib/sandbox-scenario-analytics"

type RadarScenarioActivityChartProps = {
  /** One entry per calendar day, or null when no dataset is loaded. */
  data: readonly SandboxActivityDatum[] | null
  title: string
  description: string
  unavailableMessage: string
}

const chartConfig = {
  outboundAmountMinor: { label: "Outbound", color: "var(--lch-text-secondary)" },
} satisfies ChartConfig

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })
const wholePounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })
const countFormatter = new Intl.NumberFormat("en-GB")

/**
 * Daily S04 outbound spend, on the same card, grid and bar treatment as
 * RadarRecommendationChart. Bars are neutral grey: this is spend, not a
 * decision, so it never borrows the PASS/CHALLENGE/HOLD colours. Unlike the
 * count charts it keeps its y-axis numbers -- money is worth reading off
 * the scale. Presentational only: the page fetches and shapes the data.
 */
export function RadarScenarioActivityChart({ data, title, description, unavailableMessage }: RadarScenarioActivityChartProps) {
  const activeDays = useMemo(() => (data ?? []).filter((day) => day.transactionCount > 0), [data])
  // Ticks are chosen in whole pounds, then converted back to the minor
  // units the data is plotted in.
  const yTicks = useMemo(
    () => evenTicks(Math.max(0, ...(data ?? []).map((day) => day.outboundAmountMinor)) / 100).map((tick) => tick * 100),
    [data],
  )

  return (
    <section className="chart-card radar-chart-card radar-outcome-card">
      <div className="radar-outcome-header">
        <div>
          <div className="card-title">{title}</div>
          <p className="card-copy">{description}</p>
        </div>
      </div>
      <div className="radar-outcome-body">
        {data === null ? (
          <p className="radar-chart-empty">{unavailableMessage}</p>
        ) : (
          <>
            <ChartContainer aria-label={`${title}. ${description}`} className="h-[285px] w-full" config={chartConfig} role="img">
              <BarChart accessibilityLayer barCategoryGap="20%" data={[...data]} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--lch-border)" strokeDasharray="3 4" vertical={false} />
                <XAxis
                  axisLine={{ stroke: "var(--lch-border)" }}
                  dataKey="label"
                  interval="preserveStartEnd"
                  minTickGap={32}
                  tick={{ fill: "var(--lch-text-tertiary)", fontSize: 11, fontFamily: "Inter, sans-serif" }}
                  tickLine={false}
                  tickMargin={12}
                />
                <YAxis
                  axisLine={false}
                  domain={[0, yTicks[yTicks.length - 1]]}
                  tick={{ fill: "var(--lch-text-tertiary)", fontSize: 11, fontFamily: "Inter, sans-serif" }}
                  tickFormatter={(value: number) => wholePounds.format(value / 100)}
                  tickLine={false}
                  tickMargin={10}
                  ticks={yTicks}
                  width={48}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--lch-bg-hover)", fillOpacity: 0.5 }}
                  content={({ active, payload }) => {
                    const day = payload?.[0]?.payload as SandboxActivityDatum | undefined
                    if (!active || !day) return null
                    return (
                      <div className="radar-outcome-tooltip">
                        <div className="radar-outcome-tooltip-title">{day.longLabel}</div>
                        <div className="radar-outcome-tooltip-row">
                          <span className="radar-outcome-tooltip-label">
                            <span aria-hidden="true" className="radar-outcome-swatch" style={{ backgroundColor: "var(--lch-text-secondary)" }} />
                            Outbound
                          </span>
                          <strong>{pounds.format(day.outboundAmountMinor / 100)}</strong>
                        </div>
                        <div className="radar-outcome-tooltip-row">
                          <span className="radar-outcome-tooltip-label">Transactions</span>
                          <strong>{countFormatter.format(day.transactionCount)}</strong>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="outboundAmountMinor" fill="var(--color-outboundAmountMinor)" maxBarSize={10} radius={0} />
              </BarChart>
            </ChartContainer>

            <details className="radar-chart-data">
              <summary>View chart data</summary>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transactions</th>
                    <th>Outbound</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((day) => (
                    <tr key={day.date}>
                      <td>{day.longLabel}</td>
                      <td>{countFormatter.format(day.transactionCount)}</td>
                      <td>{pounds.format(day.outboundAmountMinor / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="radar-chart-data-note">
                {countFormatter.format(activeDays.length)} of {countFormatter.format(data.length)} days had activity. Days with none are omitted from this table.
              </p>
            </details>
          </>
        )}
      </div>
    </section>
  )
}
