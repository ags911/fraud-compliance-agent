import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const data = [
  { day: "15 Aug", released: 920, review: 42, held: 18, risk: 22 },
  { day: "18 Aug", released: 1080, review: 55, held: 20, risk: 28 },
  { day: "21 Aug", released: 1010, review: 48, held: 16, risk: 24 },
  { day: "24 Aug", released: 1190, review: 61, held: 26, risk: 38 },
  { day: "27 Aug", released: 1160, review: 50, held: 20, risk: 31 },
  { day: "30 Aug", released: 1300, review: 78, held: 38, risk: 67 },
  { day: "2 Sep", released: 1210, review: 54, held: 25, risk: 43 },
  { day: "5 Sep", released: 1360, review: 58, held: 28, risk: 35 },
  { day: "8 Sep", released: 1420, review: 64, held: 31, risk: 55 },
  { day: "11 Sep", released: 1330, review: 52, held: 23, risk: 40 },
  { day: "14 Sep", released: 1480, review: 67, held: 30, risk: 48 },
]

const config = {
  released: { label: "Released", color: "var(--chart-2)" },
  review: { label: "Review", color: "var(--chart-4)" },
  held: { label: "Held", color: "var(--destructive)" },
  risk: { label: "Risk index", color: "var(--primary)" },
} satisfies ChartConfig

export function RiskChart() {
  return <Card>
    <CardHeader className="flex-row items-start justify-between">
      <div><CardTitle>Decision activity</CardTitle><CardDescription>Daily outcomes and aggregate risk index</CardDescription></div>
      <Tabs defaultValue="30d"><TabsList><TabsTrigger value="7d">7d</TabsTrigger><TabsTrigger value="30d">30d</TabsTrigger><TabsTrigger value="90d">90d</TabsTrigger></TabsList></Tabs>
    </CardHeader>
    <CardContent>
      <ChartContainer config={config} className="aspect-auto h-[310px] w-full">
        <ComposedChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} minTickGap={20} />
          <YAxis yAxisId="volume" tickLine={false} axisLine={false} width={38} />
          <YAxis yAxisId="risk" orientation="right" domain={[0,100]} hide />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar yAxisId="volume" dataKey="released" stackId="a" fill="var(--color-released)" radius={[0,0,3,3]} />
          <Bar yAxisId="volume" dataKey="review" stackId="a" fill="var(--color-review)" />
          <Bar yAxisId="volume" dataKey="held" stackId="a" fill="var(--color-held)" radius={[3,3,0,0]} />
          <Area yAxisId="risk" dataKey="risk" type="monotone" fill="var(--color-risk)" fillOpacity={0.08} stroke="var(--color-risk)" strokeWidth={2} />
        </ComposedChart>
      </ChartContainer>
    </CardContent>
  </Card>
}
