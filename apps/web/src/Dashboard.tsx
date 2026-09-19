import { useEffect, useState } from "react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { ArrowRight, BarChart3, CalendarDays, LayoutDashboard, LayoutGrid, Moon, Play, RotateCcw, Search, ShieldCheck, Sun } from "lucide-react"

import { AverlynxBrand } from "@/components/averlynx-logo"
import { demoScenarios, type DemoScenarioId } from "@/components/demo-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { scenarioResults, zeroKpis, zeroOutcomes, type Route } from "@/lib/overview-data"

// The content follows the Overview page contract in the implementation plan: KPI strip,
// decision outcomes, operational health, and recent decisions. The figures come from the
// same synthetic scenario data as the Overview page, and stay at zero until a scenario runs.
const routeVariant = { PASS: "outline", CHALLENGE: "secondary", HOLD: "destructive" } as const satisfies Record<Route, string>

// Outcome colours are theme tokens, so they follow light and dark mode.
const toneColor = { success: "var(--outcome-pass)", warning: "var(--outcome-challenge)", danger: "var(--destructive)" } as const

const themeKey = "averlynx-dashboard-theme"

function formatRange(range: DateRange | undefined) {
  if (!range?.from) return "Select dates"
  return range.to ? `${format(range.from, "d")}–${format(range.to, "d MMM yyyy")}` : format(range.from, "d MMM yyyy")
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
        {/* The lockup hard-codes a dark text colour for the light Payments sidebar, so it is overridden for this theme. */}
        <AverlynxBrand className="h-8 px-2 text-sidebar-foreground" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
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
                    className="data-[active=false]:bg-transparent! data-[active=false]:font-normal! data-[active=false]:hover:bg-sidebar-accent!"
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
        <p className="px-2 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
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
  const term = search.trim().toLowerCase()
  const decisions = (result?.decisions ?? []).filter((decision) =>
    !term || [decision.id, decision.customer, decision.amount, decision.route, decision.reason].some((value) => value.toLowerCase().includes(term)),
  )

  return (
    <TooltipProvider>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 h-4" />
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search decisions"
                className="pl-8"
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
                <SelectTrigger aria-label="Demo scenario" className="w-52">
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
                  <Button variant="outline">
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
              <Card>
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
                const share = (label: string) => result?.outcomes.find((outcome) => outcome.label === label)?.share ?? "0%"
                const note = kpi.label === "Processed volume"
                  ? `${share("Passed")} passed`
                  : kpi.label === "Transactions"
                    ? "Across all routes"
                    : kpi.label === "Held volume"
                  ? `${share("Held")} of transactions`
                  : kpi.label === "Review queue"
                    ? `Oldest review ${result?.oldestReview ?? "0 min"}`
                    : null
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
                    {note ? <CardContent className="text-xs text-muted-foreground">{note}</CardContent> : null}
                  </Card>
                )
              })}
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
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

            <Card>
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
                <CardDescription>Open a live decision, or the benchmark evidence behind the model.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  { title: "Analyse a transaction", text: "Submit transaction facts for a simulated risk decision.", href: "/transactions/new", icon: ShieldCheck },
                  { title: "Benchmark insights", text: "Read the mechanics-only model evaluation.", href: "/insights", icon: BarChart3 },
                ].map((action) => (
                  <a
                    key={action.title}
                    href={action.href}
                    className="flex items-center gap-3 rounded-lg border p-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <action.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1 text-sm">
                      <strong className="block font-medium">{action.title}</strong>
                      <span className="text-muted-foreground">{action.text}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </a>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent decisions</CardTitle>
                <CardDescription>Latest mock transaction outcomes across the demo environment. {decisions.length} of {result?.decisions.length ?? 0}</CardDescription>
              </CardHeader>
              <CardContent>
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
                        <TableCell className="tabular-nums">{decision.risk}</TableCell>
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
