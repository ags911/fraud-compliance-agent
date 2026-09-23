import { useState } from "react"
import { Link } from "react-router-dom"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import { Bot, Cpu, Pause, Play, RotateCcw, ScrollText } from "lucide-react"

import { AuditDrawer } from "@/components/simulation/audit-drawer"
import { AverlynxBrand } from "@/components/averlynx-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import {
  attackVectors,
  scoreBands,
  seedTransactions,
  useSimulationStream,
  type AttackVectorId,
  type ScoreBand,
  type SimulatedTransaction,
} from "@/lib/simulation-data"

// Theme tokens (app-theme.css), same convention Dashboard.tsx uses for its
// outcome colours, so this page follows light/dark like the rest of the app
// instead of a one-off palette.
const toneColor = { success: "var(--outcome-pass)", warning: "var(--outcome-challenge)", danger: "var(--destructive)" } as const

const bandTone: Record<ScoreBand, keyof typeof toneColor> = {
  auto_pass: "success",
  llm_low: "warning",
  llm_high: "warning",
  auto_block: "danger",
}

// Stock shadcn destructive/secondary text on their tints is below WCAG AA
// contrast (see Dashboard.tsx), so decision badges use the foreground
// colour and rely on the variant's background for the distinction.
const decisionVariant: Record<SimulatedTransaction["decision"], "outline" | "secondary" | "destructive"> = {
  PASS: "outline",
  FLAGGED: "secondary",
  BLOCKED: "destructive",
}

const distributionConfig: ChartConfig = {
  count: { label: "Transactions" },
}

const throughputConfig: ChartConfig = {
  tps: { label: "TPS", color: "var(--chart-1)" },
}

function TopNav() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 md:px-6">
        <AverlynxBrand className="text-foreground" />
        <nav aria-label="Primary" className="flex items-center gap-1.5">
          <Link
            to="/simulation"
            aria-current="page"
            className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
          >
            Overview &amp; Stream
          </Link>
          <Link
            to="/insights"
            className="rounded-full px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Statutory Ledger
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline">
            <span aria-hidden="true" className="mr-1">🟢</span>
            SSE Stream: Connected
          </Badge>
        </div>
      </div>
    </header>
  )
}

export default function SimulationPage() {
  const [vector, setVector] = useState<AttackVectorId>("carding")
  const { running, setRunning, transactions, bandCounts, throughput, kpis, reset } = useSimulationStream(vector)
  const [selected, setSelected] = useState<SimulatedTransaction | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, "approved" | "blocked">>({})

  const feedRows = transactions.length > 0 ? transactions : seedTransactions
  const distributionData = scoreBands.map((band) => ({
    band: band.label,
    count: bandCounts[band.id],
    fill: toneColor[bandTone[band.id]],
  }))

  function openAudit(tx: SimulatedTransaction) {
    setSelected(tx)
    setDrawerOpen(true)
  }

  function applyOverride(id: string, outcome: "approved" | "blocked") {
    setOverrides((prev) => ({ ...prev, [id]: outcome }))
    setDrawerOpen(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />

      <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fraud Compliance Simulation Engine</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A sub-millisecond XGBoost fast path scores every simulated transaction; anything it can&apos;t resolve with
              confidence escalates to an LLM agent for a slower, explainable review. Everything on this page is a
              client-side simulation for demonstration only — it is not connected to a real model, a real account, or
              a real payment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={vector} onValueChange={(value) => setVector(value as AttackVectorId)}>
              <SelectTrigger className="w-64 bg-card" aria-label="Attack vector scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {attackVectors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={running} onClick={() => setRunning(true)}>
              <Play aria-hidden="true" fill="currentColor" />
              Run simulation
            </Button>
            <Button variant="outline" disabled={!running} onClick={() => setRunning(false)}>
              <Pause aria-hidden="true" />
              Pause
            </Button>
            <Button variant="outline" onClick={() => { reset(); setOverrides({}) }}>
              <RotateCcw aria-hidden="true" />
              Reset stream
            </Button>
          </div>
        </section>

        <section aria-label="Stream summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total Processed Traffic</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{kpis.totalProcessed.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Live streaming at ~3 tx/sec (simulated)</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Auto-Passed (XGBoost)</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{kpis.autoPassPct}%</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Score ≤ 0.20 (simulated threshold)</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: toneColor.danger }} />
                Auto-Blocked (XGBoost)
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{kpis.autoBlockPct}%</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Score ≥ 0.85 (simulated threshold)</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: toneColor.warning }} />
                LLM Escalations
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{kpis.llmEscalationPct}%</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Ambiguous band 0.21–0.84 (simulated)</CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Risk distribution</CardTitle>
              <CardDescription>Current stream, by score band (simulated)</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={distributionConfig} className="h-48 w-full">
                <BarChart data={distributionData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="band"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={8}
                    tickFormatter={(value: string) => value.split(" ")[0]}
                  />
                  <YAxis axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.65 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const point = payload[0]
                      return (
                        <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
                          <div className="font-medium">{String(point.payload.band)}</div>
                          <div className="text-muted-foreground">{String(point.value)} transactions</div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distributionData.map((entry) => (
                      <Cell key={entry.band} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Stream throughput</CardTitle>
                <CardDescription>Transactions per second (simulated)</CardDescription>
              </div>
              <Badge variant="outline">
                Avg ML latency: {kpis.avgLatencyMs > 0 ? `${kpis.avgLatencyMs}ms` : "—"}
              </Badge>
            </CardHeader>
            <CardContent>
              <ChartContainer config={throughputConfig} className="h-48 w-full">
                <AreaChart data={throughput} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="tps-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-tps)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--color-tps)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} minTickGap={32} />
                  <YAxis axisLine={false} tickLine={false} width={28} />
                  <ChartTooltip cursor={{ stroke: "var(--color-tps)", strokeOpacity: 0.4 }} content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="tps" stroke="var(--color-tps)" fill="url(#tps-fill)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
              {throughput.length === 0 ? (
                <p className="mt-2 text-center text-xs text-muted-foreground">Run the simulation to see live throughput.</p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Live transaction feed</CardTitle>
            <CardDescription>
              {transactions.length > 0 ? "Most recent simulated transactions" : "Example rows — run the simulation to replace these with a live stream"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Merchant &amp; Amount</TableHead>
                  <TableHead>XGBoost Score</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead>Final Decision</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedRows.map((tx) => {
                  const override = overrides[tx.id]
                  const escalated = tx.engine === "LLM Agent"
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(tx.timestamp).toLocaleTimeString("en-GB", { hour12: false })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{tx.accountId}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{tx.merchant}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{tx.amount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span aria-hidden="true" className="size-[7px] rounded-full" style={{ background: toneColor[bandTone[tx.band]] }} />
                          <Badge variant="outline" className="font-mono">{tx.score.toFixed(2)}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          {escalated ? <Bot className="size-3.5" aria-hidden="true" /> : <Cpu className="size-3.5" aria-hidden="true" />}
                          {tx.engine}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={decisionVariant[tx.decision]} className="text-foreground">
                          {override ? (override === "approved" ? "PASS (overridden)" : "BLOCKED (overridden)") : tx.decision}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" disabled={!escalated} onClick={() => openAudit(tx)}>
                          <ScrollText className="size-3.5" aria-hidden="true" />
                          Inspect Audit &gt;
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <AuditDrawer
        transaction={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onApprove={(id) => applyOverride(id, "approved")}
        onBlock={(id) => applyOverride(id, "blocked")}
      />
    </div>
  )
}
