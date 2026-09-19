import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ArrowRight, BarChart3, CalendarDays, LayoutDashboard, LayoutGrid, Moon, Play, RotateCcw, Search, ShieldCheck, Sun, TrendingDown, TrendingUp } from "lucide-react"

import { AverlynxBrand } from "@/components/averlynx-logo"
import { demoScenarios, type DemoScenarioId } from "@/components/demo-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TooltipProvider } from "@/components/ui/tooltip"
import { portfolioSeries, weekOverWeek, type DayPoint } from "@/lib/dashboard-series"
import { scenarioResults, zeroKpis, zeroOutcomes, type Route } from "@/lib/overview-data"

// The content follows the Overview page contract in the implementation plan: KPI strip,
// decision outcomes, operational health, and recent decisions. The figures come from the
// same synthetic scenario data as the Overview page, and stay at zero until a scenario runs.
// Trends and the 30-day chart are drawn only for the portfolio scenario, from its own
// deterministic synthetic series. They are never presented as recorded run history.
const routeVariant = { PASS: "outline", CHALLENGE: "secondary", HOLD: "destructive" } as const satisfies Record<Route, string>

// Outcome colours are theme tokens, so they follow light and dark mode.
const toneColor = { success: "var(--outcome-pass)", warning: "var(--outcome-challenge)", danger: "var(--destructive)" } as const
const routeColor: Record<Route, string> = { PASS: toneColor.success, CHALLENGE: toneColor.warning, HOLD: toneColor.danger }

const themeKey = "averlynx-dashboard-theme"

const outcomeChartConfig = {
  passed: { label: "Passed", color: "var(--outcome-pass)" },
  challenged: { label: "Challenged", color: "var(--outcome-challenge)" },
  held: { label: "Held", color: "var(--destructive)" },
} satisfies ChartConfig

function formatRange(range: DateRange | undefined) {
  if (!range?.from) return "Select dates"
  return range.to ? `${format(range.from, "d")}–${format(range.to, "d MMM yyyy")}` : format(range.from, "d MMM yyyy")
}

/**
 * Make a table's scroll container keyboard-reachable, but only while it actually scrolls.
 *
 * The shared Table component owns its scroll container, so this labels it from outside
 * rather than changing a component that other pages use.
 *
 * Args:
 *   host: The element that contains the table.
 *   label: The accessible name for the scrollable region.
 *   rows: A value that changes when the table's content changes, so it is re-measured.
 */
function useFocusableWhenScrollable(host: React.RefObject<HTMLElement | null>, label: string, rows: number) {
  useEffect(() => {
    const container = host.current?.querySelector<HTMLElement>('[data-slot="table-container"]')
    if (!container) return
    const update = () => {
      if (container.scrollWidth > container.clientWidth) {
        container.setAttribute("tabindex", "0")
        container.setAttribute("role", "region")
        container.setAttribute("aria-label", label)
      } else {
        container.removeAttribute("tabindex")
        container.removeAttribute("role")
        container.removeAttribute("aria-label")
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [host, label, rows])
}

/** A small, decorative trend line. The delta text beside it carries the meaning. */
function Sparkline({ data, dataKey, color }: { data: readonly DayPoint[]; dataKey: keyof DayPoint & ("transactions" | "volume" | "heldVolume"); color: string }) {
  return (
    <ChartContainer config={{ [dataKey]: { color } }} className="aspect-auto h-10 w-full" aria-hidden="true">
      <AreaChart accessibilityLayer={false} data={data as DayPoint[]} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area dataKey={dataKey} type="monotone" stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.14} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  )
}

function Delta({ change }: { change: number }) {
  const Icon = change < 0 ? TrendingDown : TrendingUp
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden="true" />
      {`${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}% vs prior 7 days`}
    </span>
  )
}

const navigation = [
  { title: "Dashboard", href: "/dashboard.html", icon: LayoutDashboard, active: true },
  { title: "Overview", href: "/overview", icon: LayoutGrid },
  { title: "Analyse a transaction", href: "/transactions/new", icon: ShieldCheck },
  { title: "Benchmark insights", href: "/insights", icon: BarChart3 },
]

function DashboardSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* The lockup hard-codes a dark text colour for the Payments sidebar, so it follows this theme instead. */}
        <AverlynxBrand className="h-8 px-2 text-foreground" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {/* The shared sidebar renders data-active="false", which Tailwind v4's data-active: variant
                      still matches, so inactive items are reset here rather than editing the shared component. */}
                  <SidebarMenuButton
                    asChild
                    isActive={item.active}
                    tooltip={item.title}
                    className="rounded-xl data-[active=false]:bg-transparent! data-[active=false]:font-normal! data-[active=false]:hover:bg-sidebar-accent!"
                  >
                    <a href={item.href} aria-current={item.active ? "page" : undefined}>
                      <item.icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 text-xs text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          Synthetic demo. Nothing here is a real payment.
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export default function Dashboard() {
  const [selected, setSelected] = useState<DemoScenarioId | null>(null)
  const [active, setActive] = useState<DemoScenarioId | null>(null)
  const [search, setSearch] = useState("")
  const [range, setRange] = useState<DateRange | undefined>({ from: new Date(2026, 8, 1), to: new Date(2026, 8, 23) })

  // Light is the default, and the choice is remembered. Storage can be blocked, so it is optional.
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return window.localStorage.getItem(themeKey) === "dark" ? "dark" : "light"
    } catch {
      return "light"
    }
  })
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try {
      window.localStorage.setItem(themeKey, theme)
    } catch {
      // The theme still applies for this visit.
    }
  }, [theme])

  const result = active ? scenarioResults[active] : null
  const series = active === "portfolio" ? portfolioSeries : null
  const term = search.trim().toLowerCase()
  const decisions = (result?.decisions ?? []).filter((decision) =>
    !term || [decision.id, decision.customer, decision.amount, decision.route, decision.reason].some((value) => value.toLowerCase().includes(term)),
  )
  const tableHost = useRef<HTMLDivElement>(null)
  useFocusableWhenScrollable(tableHost, "Recent decisions", decisions.length)
  const share = (label: string) => result?.outcomes.find((outcome) => outcome.label === label)?.share ?? "0%"

  return (
    <TooltipProvider>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 h-4" />
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search decisions"
                className="bg-card pl-8"
                placeholder={result ? "Search transaction, customer, or review ID" : "Search decisions after running a scenario"}
                value={search}
                disabled={!result}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:inline-flex">Demo data</Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              </Button>
              <Select value={selected ?? undefined} onValueChange={(value) => { setSelected(value as DemoScenarioId); setActive(null) }}>
                <SelectTrigger aria-label="Demo scenario" className="w-52 bg-card">
                  <SelectValue placeholder="Select demo scenario" />
                </SelectTrigger>
                <SelectContent align="end">
                  {demoScenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>{scenario.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button disabled={!selected} onClick={() => { setActive(selected); setSearch("") }}>
                <Play aria-hidden="true" fill="currentColor" />
                Run
              </Button>
              {active ? (
                <Button variant="outline" onClick={() => { setSelected(null); setActive(null); setSearch("") }} aria-label="Reset demo and return all values to zero">
                  <RotateCcw aria-hidden="true" />
                  <span className="hidden md:inline">Reset</span>
                </Button>
              ) : null}
            </div>
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="sr-only">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Choose a scenario in the header, run it, then inspect decisions, review pressure, and model health.
                </p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-card">
                    <CalendarDays aria-hidden="true" />
                    {formatRange(range)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} defaultMonth={range?.from} />
                </PopoverContent>
              </Popover>
            </div>

            {result ? null : (
              <Card className="border-primary/20 bg-accent/60">
                <CardHeader>
                  <CardTitle>Nothing has run yet</CardTitle>
                  <CardDescription>Every figure below is zero until you run a demo scenario. The data is synthetic.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => { setSelected("portfolio"); setActive("portfolio") }}>
                    <Play aria-hidden="true" fill="currentColor" />
                    Run the mixed 30-day portfolio
                  </Button>
                </CardContent>
              </Card>
            )}

            <section aria-label="Dashboard summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(result?.kpis ?? zeroKpis).map((kpi) => {
                // Held volume and the review queue are the figures an operator acts on, so they also carry a marker.
                const trend = series
                  ? kpi.label === "Processed volume"
                    ? { key: "volume" as const, color: "var(--chart-1)" }
                    : kpi.label === "Transactions"
                      ? { key: "transactions" as const, color: "var(--chart-1)" }
                      : kpi.label === "Held volume"
                        ? { key: "heldVolume" as const, color: "var(--destructive)" }
                        : null
                  : null
                const note = trend && series
                  ? <Delta change={weekOverWeek(series, trend.key)} />
                  : kpi.label === "Processed volume"
                    ? `${share("Passed")} passed`
                    : kpi.label === "Transactions"
                      ? "Across all routes"
                      : kpi.label === "Held volume"
                        ? `${share("Held")} of transactions`
                        : `Oldest review ${result?.oldestReview ?? "0 min"}`
                const marker = kpi.label === "Held volume" ? toneColor.danger : kpi.label === "Review queue" ? toneColor.warning : null
                return (
                  <Card key={kpi.label}>
                    <CardHeader>
                      <CardDescription className="flex items-center gap-2">
                        {marker ? <span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: marker }} /> : null}
                        {kpi.label}
                      </CardDescription>
                      <CardTitle className="text-2xl font-semibold tabular-nums">{kpi.value}</CardTitle>
                    </CardHeader>
                    <CardContent className="mt-auto flex flex-col gap-2">
                      <span className="text-xs text-muted-foreground">{note}</span>
                      {trend && series ? <Sparkline data={series} dataKey={trend.key} color={trend.color} /> : null}
                    </CardContent>
                  </Card>
                )
              })}
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Transactions by outcome</CardTitle>
                  <CardDescription>
                    {series
                      ? "Synthetic 30-day series defined by this scenario. It is not recorded run history."
                      : result
                        ? "This scenario is a single transaction, so there is no time series."
                        : "Run the mixed 30-day portfolio to draw the 30-day series."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {series ? (
                    <figure aria-label="Daily transactions by outcome over 30 days">
                      <ChartContainer config={outcomeChartConfig} className="aspect-auto h-64 w-full">
                        <AreaChart data={series as DayPoint[]} margin={{ left: 4, right: 8 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={4} />
                          <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value: number) => value.toLocaleString("en-GB")} />
                          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Area dataKey="passed" type="monotone" stackId="a" fill="var(--color-passed)" fillOpacity={0.3} stroke="var(--color-passed)" />
                          <Area dataKey="challenged" type="monotone" stackId="a" fill="var(--color-challenged)" fillOpacity={0.4} stroke="var(--color-challenged)" />
                          <Area dataKey="held" type="monotone" stackId="a" fill="var(--color-held)" fillOpacity={0.5} stroke="var(--color-held)" />
                        </AreaChart>
                      </ChartContainer>
                      {/* A text alternative for the chart: the same daily figures, for assistive technology. */}
                      <table className="sr-only">
                        <caption>Daily transactions by outcome, 30 days. Totals: {series.reduce((sum, day) => sum + day.transactions, 0).toLocaleString("en-GB")} transactions.</caption>
                        <thead><tr><th>Day</th><th>Passed</th><th>Challenged</th><th>Held</th></tr></thead>
                        <tbody>
                          {series.map((day) => (
                            <tr key={day.label}><td>{day.label}</td><td>{day.passed}</td><td>{day.challenged}</td><td>{day.held}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </figure>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                      No time series to show
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Operational health</CardTitle>
                  <CardDescription>Current production model and review coverage.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <dl className="flex flex-col divide-y text-sm">
                    {[
                      ["Production model", result ? "fraud-risk-v4.2" : "Not evaluated"],
                      ["Drift state", result ? "Stable" : "Not evaluated"],
                      ["p95 scoring latency", result?.latency ?? "0 ms"],
                      ["Oldest review", result?.oldestReview ?? "0 min"],
                      ["Estimated false-positive rate", result ? "Unavailable" : "0%"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 py-2 first:pt-0">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="text-right font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    {result
                      ? "Labelled outcomes are required before false-positive rate can be calculated."
                      : "Run a demo scenario to evaluate operational health."}
                  </p>
                </CardContent>
              </Card>

            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Decision outcomes</CardTitle>
                  <CardDescription>Route mix across processed transaction volume.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  {(result?.outcomes ?? zeroOutcomes).map((outcome) => (
                    <div key={outcome.label} className="flex flex-col gap-2 tabular-nums">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 text-sm">
                        <div className="grid min-w-0 grid-cols-[7px_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5">
                          <span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: toneColor[outcome.tone] }} />
                          <strong className="font-medium">{outcome.label}</strong>
                          <span className="col-start-2 truncate text-muted-foreground">{outcome.count} transactions</span>
                        </div>
                        <div className="grid grid-cols-[76px_46px] items-center text-right sm:grid-cols-[92px_54px]">
                          <strong className="font-medium">{outcome.value}</strong>
                          <span className="text-muted-foreground">{outcome.share}</span>
                        </div>
                      </div>
                      <div
                        role="meter"
                        aria-label={`${outcome.label}: ${outcome.value}, ${outcome.count} transactions, ${outcome.share}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Number.parseFloat(outcome.share)}
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                      >
                        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: outcome.share, background: toneColor[outcome.tone] }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick actions</CardTitle>
                  <CardDescription>Open a live decision, or the benchmark evidence behind the model.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {[
                    { title: "Analyse a transaction", text: "Submit transaction facts for a simulated risk decision.", href: "/transactions/new", icon: ShieldCheck },
                    { title: "Benchmark insights", text: "Read the mechanics-only model evaluation.", href: "/insights", icon: BarChart3 },
                  ].map((action) => (
                    <a
                      key={action.title}
                      href={action.href}
                      className="group flex items-center gap-3 rounded-lg border bg-card p-3 outline-none transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <action.icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex-1 text-sm">
                        <strong className="block font-medium">{action.title}</strong>
                        <span className="text-muted-foreground">{action.text}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </a>
                  ))}
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Recent decisions</CardTitle>
                <CardDescription>Latest mock transaction outcomes across the demo environment. {decisions.length} of {result?.decisions.length ?? 0}</CardDescription>
              </CardHeader>
              <CardContent ref={tableHost}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Primary reason</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decisions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          {result ? "No decisions match your search." : "Run a scenario to see decisions."}
                        </TableCell>
                      </TableRow>
                    ) : decisions.map((decision) => (
                      <TableRow key={decision.id}>
                        <TableCell className="font-mono text-xs">{decision.id}</TableCell>
                        <TableCell>{decision.customer}</TableCell>
                        <TableCell className="text-right tabular-nums">{decision.amount}</TableCell>
                        <TableCell>
                          {/* The bar shows the score's position on 0-100. It carries no threshold, because none is approved. */}
                          <div className="flex items-center gap-2 tabular-nums">
                            <span className="w-9">{decision.risk}</span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                              <div className="h-full rounded-full" style={{ width: decision.risk, background: routeColor[decision.route] }} />
                            </div>
                          </div>
                        </TableCell>
                        {/* Stock shadcn destructive text on its tint is 4.0:1, below WCAG AA, so labels use the foreground colour. */}
                        <TableCell><Badge variant={routeVariant[decision.route]} className="text-foreground">{decision.route}</Badge></TableCell>
                        <TableCell>{decision.reason}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{decision.time}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
