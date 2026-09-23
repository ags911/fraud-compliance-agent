import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { SandboxDailyAggregate } from "@/lib/sandbox-scenario-analytics"

type RadarScenarioActivityChartProps = {
  data: readonly SandboxDailyAggregate[]
}

const chartConfig = {
  outbound_amount_minor: { label: "Outbound amount (minor units)", color: "var(--chart-base)" },
} satisfies ChartConfig

/** Render prepared daily Sandbox totals without fetching or transforming data. */
export function RadarScenarioActivityChart({ data }: RadarScenarioActivityChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-56 w-full" aria-label="Sanitised S04 daily outbound activity">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 16 }}>
        <CartesianGrid vertical={false} stroke="var(--lch-border-soft)" strokeDasharray="3 4" />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: "var(--lch-text-tertiary)", fontSize: 11, fontFamily: "Inter, sans-serif" }} />
        <YAxis axisLine={false} tickLine={false} width={48} tickFormatter={(value) => `£${Number(value) / 100}`} tick={{ fill: "var(--lch-text-tertiary)", fontSize: 11, fontFamily: "Inter, sans-serif" }} />
        <ChartTooltip
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          content={<ChartTooltipContent className="min-w-40 gap-2 px-3 py-2" labelFormatter={(label) => String(label)} />}
          isAnimationActive={false}
        />
        <Bar dataKey="outbound_amount_minor" fill="var(--chart-base)" radius={0} />
      </BarChart>
    </ChartContainer>
  )
}
