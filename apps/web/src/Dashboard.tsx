import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, BarChart3, ChevronDown, Moon, PanelRight, Play, RotateCcw, ScanSearch, Search, ShieldCheck, Sun } from "lucide-react"

import { AverlynxBrand } from "@/components/averlynx-logo"
import { DashboardChat } from "@/components/dashboard-chat"
import { DemoHelpDialog, DemoWelcomeDialog } from "@/components/demo-guide"
import { useDemoSession } from "@/components/demo-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TooltipProvider } from "@/components/ui/tooltip"
import { scenarioResults, zeroKpis, zeroOutcomes, type Route } from "@/lib/overview-data"
import {
  showcaseInvestigationHref,
  showcaseScenarios,
  toRunnableShowcaseScenario,
  type RunnableShowcaseScenarioId,
} from "@/lib/showcase-scenarios"
import { useOverviewTour, type OverviewTourCopy } from "@/lib/useOverviewTour"

type ScenarioResult = (typeof scenarioResults)[keyof typeof scenarioResults]

// The content follows the Overview page contract in the implementation plan: KPI strip,
// decision outcomes, operational health, and recent decisions. The figures come from the
// representative synthetic portfolio, and stay at zero until it is loaded. The header's
// S01-S05 scenarios do not fill them: a single investigation has no volumes to report.
// There are deliberately no trend lines or time-series charts: there is no recorded run
// history, and inventing one would misrepresent the demo. They return when the dashboard is
// rebuilt from approved, Plaid-derived fixtures scored by the decision engine.
const routeVariant = { PASS: "outline", CHALLENGE: "secondary", HOLD: "destructive" } as const satisfies Record<Route, string>

// Outcome colours are theme tokens, so they follow light and dark mode.
const toneColor = { success: "var(--outcome-pass)", warning: "var(--outcome-challenge)", danger: "var(--destructive)" } as const
const routeColor: Record<Route, string> = { PASS: toneColor.success, CHALLENGE: toneColor.warning, HOLD: toneColor.danger }

const themeKey = "averlynx-dashboard-theme"

// The header's Run opens an investigation rather than filling this page, so the tour says so.
const tourCopy: OverviewTourCopy = {
  choose: "Open this menu and pick one of the synthetic S01–S05 payment paths.",
  run: "Press Run to open Showcase investigation and play back that scenario's recorded trace from the demo API.",
  inspectTitle: "Inspect the dashboard",
  inspect: "Load the representative portfolio here to see its outcomes, health signals, and recent decisions.",
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

type Tab = { title: string; href: string; active?: boolean }

// Live pages are tabs. Everything the plan lists that is not built yet sits under "More",
// grouped by section, so nothing looks finished that is not.
const liveTabs: Tab[] = [
  { title: "Overview", href: "/overview", active: true },
  { title: "Analyse a transaction", href: "/transactions/new" },
  { title: "Insights", href: "/insights" },
]

type PlannedItem = {
  title: string
  // A planned page that already exists as a labelled placeholder. Views with no page are disabled.
  href?: string
}

const plannedSections: Array<{ section: string; items: PlannedItem[] }> = [
  { section: "Transactions", items: [{ title: "All decisions", href: "/transactions" }] },
  { section: "Reviews", items: [{ title: "Queue", href: "/reviews" }] },
  { section: "Rules", items: [{ title: "Performance", href: "/rules/performance" }, { title: "Changes" }] },
  { section: "Insights", items: [{ title: "Drift" }] },
  { section: "Settings", items: [{ title: "Policies" }, { title: "Access" }, { title: "Integrations" }] },
]

function SoonBadge() {
  return <span className="rounded-full border px-1.5 text-[10px] leading-4 text-muted-foreground">Soon</span>
}

const tabClass = (active: boolean) =>
  `-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-sm font-medium outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`

/**
 * The page tabs. These are links between pages rather than panels of this one, so they are a
 * navigation landmark, not ARIA tabs. "More" lists the planned sections that have no live page.
 */
function SectionTabs() {
  return (
    <nav aria-label="Sections" className="-mx-4 mt-4 flex gap-6 overflow-x-auto border-b px-4 md:-mx-6 md:px-6">
      {liveTabs.map((tab) => (
        <Link key={tab.title} to={tab.href} aria-current={tab.active ? "page" : undefined} className={tabClass(Boolean(tab.active))}>
          {tab.title}
        </Link>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={tabClass(false)}>
            More
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <p className="px-2 pb-1 text-xs text-muted-foreground">Planned, not built yet</p>
          {plannedSections.map((group) => (
            <div key={group.section} className="pt-2">
              <p className="px-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{group.section}</p>
              <ul className="flex flex-col">
                {group.items.map((item) => (
                  <li key={item.title}>
                    {item.href ? (
                      <Link to={item.href} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                        {item.title}
                        <SoonBadge />
                      </Link>
                    ) : (
                      <span aria-disabled="true" className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                        {item.title}
                        <SoonBadge />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </nav>
  )
}

/**
 * The right-hand sidebar that holds the Explain panel.
 *
 * Args:
 *   result: The scenario result on screen, or null before a scenario has run.
 */
function ExplainSidebar({ result }: { result: ScenarioResult | null }) {
  const { open, isMobile } = useSidebar()
  return (
    <Sidebar side="right" collapsible="offcanvas" widthPx={352} mobileWidthPx={340} className="border-l">
      {/* A closed desktop drawer is only slid off-screen, so it is made inert to keep its
          controls out of the tab order and the accessibility tree until it is opened. */}
      <SidebarContent className="gap-0 overflow-hidden" inert={!isMobile && !open}>
        <DashboardChat result={result} />
      </SidebarContent>
    </Sidebar>
  )
}

export default function Dashboard() {
  const {
    activeScenario: active,
    selectScenario,
    runScenario,
    resetScenario,
    welcomeSeen,
    dismissWelcome,
  } = useDemoSession()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  // The header runs one of the same S01-S05 scenarios as the Showcase
  // investigation, and Run hands off to that page, which calls the API. The
  // dashboard figures below are separate: they come only from the representative
  // portfolio, loaded from the empty-state card.
  const [headerScenario, setHeaderScenario] = useState<RunnableShowcaseScenarioId | null>(null)
  const { start: startTour } = useOverviewTour({ selectedScenario: headerScenario, activeScenario: active, copy: tourCopy })

  // The dashboard theme is scoped to this attribute, so the tokens apply while
  // this route is mounted and the Payments pages keep their own on every other
  // route. The dark class is removed with it: no other page has a dark theme.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.appTheme = "dashboard"
    return () => {
      delete root.dataset.appTheme
      root.classList.remove("dark")
    }
  }, [])

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
  const tableHost = useRef<HTMLDivElement>(null)
  useFocusableWhenScrollable(tableHost, "Recent decisions", decisions.length)
  const share = (label: string) => result?.outcomes.find((outcome) => outcome.label === label)?.share ?? "0%"

  return (
    <TooltipProvider>
      {/* Shown once per browser session, before anything else on the page is reachable. */}
      <DemoWelcomeDialog open={!welcomeSeen} onAnswer={dismissWelcome} onStartTour={startTour} />
      {/* The right-hand sidebar holds the Explain panel. It is closed until asked for. */}
      <SidebarProvider defaultOpen={false} style={{ "--sidebar-width": "22rem" } as CSSProperties}>
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-10 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b bg-background/85 px-4 py-2 backdrop-blur">
            <AverlynxBrand className="mr-auto h-8 text-foreground sm:mr-2" />
            <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />
            <div className="relative order-4 w-full sm:order-none sm:w-auto sm:min-w-40 sm:flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search decisions"
                className="bg-card pl-8"
                placeholder={result ? "Search transaction, customer, or review ID" : "Search decisions after loading the portfolio"}
                value={search}
                disabled={!result}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-none sm:ml-auto sm:w-auto sm:justify-end">
              <Badge variant="outline" className="hidden sm:inline-flex">Synthetic data</Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              </Button>
              <Select value={headerScenario ?? ""} onValueChange={(value) => setHeaderScenario(toRunnableShowcaseScenario(value))}>
                <SelectTrigger aria-label="Demo scenario" className="w-52 bg-card" id="payments-demo-scenario-trigger">
                  <SelectValue placeholder="Select demo scenario" />
                </SelectTrigger>
                <SelectContent align="end">
                  {showcaseScenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>{scenario.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                id="payments-demo-run"
                disabled={!headerScenario}
                onClick={() => {
                  if (headerScenario) navigate(showcaseInvestigationHref(headerScenario), { state: { autoRun: true } })
                }}
              >
                <Play aria-hidden="true" fill="currentColor" />
                Run
              </Button>
              {active ? (
                <Button variant="outline" onClick={() => { resetScenario(); setHeaderScenario(null); setSearch("") }} aria-label="Reset demo and return all values to zero">
                  <RotateCcw aria-hidden="true" />
                  <span className="hidden md:inline">Reset</span>
                </Button>
              ) : null}
            </div>
            <DemoHelpDialog onStartTour={startTour} />
            <SidebarTrigger aria-label="Toggle explain panel" variant="outline" size="sm" className="order-2 gap-1.5 sm:order-none sm:ml-1">
              <PanelRight aria-hidden="true" />
              <span aria-hidden="true">Explain</span>
            </SidebarTrigger>
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Fraud risk</h1>
              <SectionTabs />
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Choose a scenario in the header and run it to open its investigation trace, or load the representative portfolio to inspect decisions, review pressure, and model health. All data is synthetic, and nothing here can approve, release, or execute a real payment.
                </p>
              </div>
              <Button asChild>
                <Link to="/transactions/new">
                  <ScanSearch aria-hidden="true" />
                  Analyse a transaction
                </Link>
              </Button>
            </div>

            {result ? null : (
              <Card className="border-primary/20 bg-accent/60">
                <CardHeader>
                  <CardTitle>No portfolio loaded</CardTitle>
                  <CardDescription>Every figure below is zero until you load the representative portfolio. The data is synthetic.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => { selectScenario("portfolio"); runScenario() }}>
                    <Play aria-hidden="true" fill="currentColor" />
                    Load the mixed 30-day portfolio
                  </Button>
                </CardContent>
              </Card>
            )}

            <section aria-label="Dashboard summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(result?.kpis ?? zeroKpis).map((kpi) => {
                // Held volume and the review queue are the figures an operator acts on, so they also carry a marker.
                const note = kpi.label === "Processed volume"
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
                    <CardContent className="mt-auto text-xs text-muted-foreground">{note}</CardContent>
                  </Card>
                )
              })}
            </section>

            <section className="grid gap-4 lg:grid-cols-2" id="overview-results">
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
                      : "Load the portfolio to evaluate operational health."}
                  </p>
                </CardContent>
              </Card>
            </section>

            <Card id="overview-quick-actions">
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
                <CardDescription>Open a live decision, a bounded synthetic investigation, or the benchmark evidence behind the model.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  { title: "Analyse a transaction", text: "Submit transaction facts for a simulated risk decision.", href: "/transactions/new", icon: ScanSearch },
                  { title: "Showcase investigation", text: "Run one bounded synthetic scenario and inspect its evidence.", href: "/transactions/investigation", icon: ShieldCheck },
                  { title: "Benchmark insights", text: "Read the mechanics-only model evaluation.", href: "/insights", icon: BarChart3 },
                ].map((action) => (
                  <Link
                    key={action.title}
                    to={action.href}
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
                  </Link>
                ))}
              </CardContent>
            </Card>

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
                          {result ? "No decisions match your search." : "Load the portfolio to see decisions."}
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
        <ExplainSidebar key={active ?? "none"} result={result} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
