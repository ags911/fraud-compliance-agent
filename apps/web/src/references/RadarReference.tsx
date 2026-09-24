import { useEffect, useMemo, useRef, useState } from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { NetworkMark } from "@/components/averlynx-logo"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fetchDemoModelSummary, type DemoModelSummary } from "@/lib/demo-model-summary"
import { mockScenarioRecommendationHistory } from "@/lib/mock-scenario-recommendation-history"
import {
  fetchSandboxScenarioAnalytics,
  sandboxDailyActivitySeries,
  summariseSandboxActivity,
  type SandboxScenarioAnalytics,
} from "@/lib/sandbox-scenario-analytics"
import {
  formatDateWindow,
  scenarioDateWindow,
  windowDayCount,
  type ScenarioRange,
} from "@/lib/scenario-date-window"
import { useShowcaseInvestigation } from "@/lib/useShowcaseInvestigation"
import type { ShowcaseScenarioId } from "@/lib/showcase-types"

import { RadarRangeToggle } from "./RadarRangeToggle"
import { RadarRecommendationChart, type RadarRecommendationDatum } from "./RadarRecommendationChart"
import { RadarScenarioActivityChart } from "./RadarScenarioActivityChart"

const scenarios: ReadonlyArray<{ id: ShowcaseScenarioId; label: string }> = [
  { id: "S01", label: "Trusted recurring payment" },
  { id: "S02", label: "High-value / high-velocity risk" },
  { id: "S03", label: "Account drain / new payee" },
  { id: "S04", label: "Ambiguous contextual case" },
  { id: "S05", label: "Investigation failure path" },
]

type DashboardTab = "scenario" | "session" | "model"

type SessionRun = {
  runId: string
  scenarioId: ShowcaseScenarioId
  timestamp: string
  route: "PASS" | "HOLD" | "INVESTIGATE"
  recommendation: "PASS" | "CHALLENGE" | "HOLD"
  investigationStatus: "skipped" | "complete" | "incomplete"
  executionMode: "recorded" | "live"
  evidenceCount: number
  isFailSafe: boolean
}

// The Sandbox result is stored with the scenario it belongs to, so a
// scenario switch reads as "loading" until its own response arrives.
type SandboxResult = { scenarioId: ShowcaseScenarioId; analytics: SandboxScenarioAnalytics | null }

const recommendationColors = {
  PASS: "var(--sev-low)",
  CHALLENGE: "var(--sev-moderate)",
  HOLD: "var(--sev-high)",
} as const

// Both Scenario charts reserve the same y-axis width, so a given day sits
// at the same x position in each and the two can be read together.
const CHART_Y_AXIS_WIDTH = 56

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })
const countFormatter = new Intl.NumberFormat("en-GB")

function runsLabel(count: number): string {
  return `${countFormatter.format(count)} ${count === 1 ? "run" : "runs"}`
}

function percentOf(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}% of runs` : "No runs yet"
}

function timeNow(): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())
}

function recommendationClass(recommendation: SessionRun["recommendation"]): string {
  if (recommendation === "PASS") return "risk-low"
  if (recommendation === "HOLD") return "risk-high"
  return "risk-flagged"
}

export function RadarReference() {
  const [tab, setTab] = useState<DashboardTab>("scenario")
  const [scenarioId, setScenarioId] = useState<ShowcaseScenarioId>("S01")
  const [range, setRange] = useState<ScenarioRange>(30)
  const [runs, setRuns] = useState<SessionRun[]>([])
  const [benchmark, setBenchmark] = useState<DemoModelSummary | null>(null)
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null)
  const seenRunIds = useRef(new Set<string>())
  const investigation = useShowcaseInvestigation()

  useEffect(() => {
    let active = true
    fetchDemoModelSummary().then(
      (summary) => {
        if (active) setBenchmark(summary)
      },
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchSandboxScenarioAnalytics(scenarioId).then(
      (analytics) => {
        if (active) setSandboxResult({ scenarioId, analytics })
      },
      () => {
        if (active) setSandboxResult({ scenarioId, analytics: null })
      },
    )
    return () => {
      active = false
    }
  }, [scenarioId])

  useEffect(() => {
    const { runStarted, route, runResult, status, toolResults } = investigation
    if (status !== "done" || !runStarted || !route || !runResult || seenRunIds.current.has(runStarted.run_id)) return

    seenRunIds.current.add(runStarted.run_id)
    const evidenceCount = toolResults.reduce((total, event) => total + event.evidence.length, 0)
    setRuns((current) => [
      {
        runId: runStarted.run_id,
        scenarioId: runStarted.scenario_id,
        timestamp: timeNow(),
        route: route.deterministic_route,
        recommendation: runResult.recommendation,
        investigationStatus: runResult.investigation_status,
        executionMode: runResult.execution_mode,
        evidenceCount,
        isFailSafe: runResult.recommendation_basis === "fail_safe",
      },
      ...current,
    ])
  }, [investigation])

  const scenarioLabel = scenarios.find((scenario) => scenario.id === scenarioId)?.label ?? ""

  // ---- Scenario tab --------------------------------------------------------
  const sandboxLoading = sandboxResult?.scenarioId !== scenarioId
  const sandboxAnalytics = sandboxLoading ? null : sandboxResult?.analytics ?? null
  const dateWindow = useMemo(
    () => scenarioDateWindow(range, sandboxAnalytics?.time_boundary ?? null),
    [range, sandboxAnalytics],
  )
  const sandboxActivity = useMemo(
    () => (sandboxAnalytics ? sandboxDailyActivitySeries(sandboxAnalytics, dateWindow) : null),
    [sandboxAnalytics, dateWindow],
  )
  const sandboxSummary = useMemo(() => (sandboxActivity ? summariseSandboxActivity(sandboxActivity) : null), [sandboxActivity])
  // The mock decides each day's real Sandbox transactions when they are known.
  const history = useMemo(() => {
    const volumes = sandboxActivity ? new Map(sandboxActivity.map((day) => [day.date, day.transactionCount])) : undefined
    return mockScenarioRecommendationHistory(scenarioId, dateWindow, volumes)
  }, [scenarioId, dateWindow, sandboxActivity])
  const historyTotal = history.data.reduce((sum, datum) => sum + datum.PASS + datum.CHALLENGE + datum.HOLD, 0)
  const rangeLabel = range === "all" ? "All Sandbox days" : `Last ${range} days`

  // ---- Session tab ---------------------------------------------------------
  const summary = useMemo(() => {
    const count = (predicate: (run: SessionRun) => boolean) => runs.filter(predicate).length
    return {
      processed: runs.length,
      completedInvestigations: count((run) => run.investigationStatus === "complete"),
      PASS: count((run) => run.recommendation === "PASS"),
      CHALLENGE: count((run) => run.recommendation === "CHALLENGE"),
      HOLD: count((run) => run.recommendation === "HOLD"),
      deterministicPasses: count((run) => run.route === "PASS"),
      failSafeHolds: count((run) => run.isFailSafe),
    }
  }, [runs])
  const recommendationsByScenario = useMemo<readonly RadarRecommendationDatum[]>(() => scenarios.map(({ id }) => {
    const scenarioRuns = runs.filter((run) => run.scenarioId === id)
    return {
      label: id,
      PASS: scenarioRuns.filter((run) => run.recommendation === "PASS").length,
      CHALLENGE: scenarioRuns.filter((run) => run.recommendation === "CHALLENGE").length,
      HOLD: scenarioRuns.filter((run) => run.recommendation === "HOLD").length,
    }
  }), [runs])

  // ---- Model tab -----------------------------------------------------------
  const xgboost = benchmark?.model_results.find((model) => model.model_id === "xgboost_candidate")

  function runShowcase() {
    // The result only appears on the Session tab, so take the viewer there.
    setTab("session")
    void investigation.start(scenarioId, "recorded")
  }

  const running = investigation.status === "running"

  return (
    <main className="main">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="page-title">
            <NetworkMark className="size-4 shrink-0" />
            <span className="title-module">Fraud Compliance Agent</span>
          </div>
          <div className="topbar-actions">
            <Select value={scenarioId} onValueChange={(value) => setScenarioId(value as ShowcaseScenarioId)}>
              <SelectTrigger size="sm" className="w-60 text-xs" aria-label="Synthetic showcase scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {scenarios.map((scenario) => <SelectItem key={scenario.id} value={scenario.id}>{scenario.id} · {scenario.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={runShowcase} disabled={running}>
              {running ? "Running…" : "Run showcase"}
            </Button>
          </div>
        </div>
      </div>

      <TabsPrimitive.Root value={tab} onValueChange={(value) => setTab(value as DashboardTab)}>
        <div className="tabs">
          <TabsPrimitive.List aria-label="Dashboard sections" className="tabs-list">
            <TabsPrimitive.Trigger className="tab" value="scenario">Scenario</TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger className="tab" value="session">
              Session{runs.length ? <span className="tab-count">{runs.length}</span> : null}
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger className="tab" value="model">Model</TabsPrimitive.Trigger>
          </TabsPrimitive.List>
        </div>

        <div className="body-grid">
          {/* ---------------- Scenario ---------------- */}
          <TabsPrimitive.Content className="tab-panel" value="scenario">
            <div className="panel-toolbar">
              <div>
                <div className="section-heading">{scenarioId} · {scenarioLabel}</div>
                <div className="section-sub">
                  {rangeLabel}, {formatDateWindow(dateWindow)}
                  {sandboxAnalytics ? <> · Dataset <span className="td-mono">{sandboxAnalytics.fixture_version}</span></> : null}
                </div>
              </div>
              <RadarRangeToggle label="Scenario date range" onChange={setRange} value={range} />
            </div>

            <div className="radar-summary-grid" aria-label={`${scenarioId} Sandbox activity summary`}>
              <MetricCard
                label="Transactions"
                value={sandboxSummary ? countFormatter.format(sandboxSummary.transactionCount) : "–"}
                detail={sandboxSummary ? `Across ${countFormatter.format(sandboxSummary.totalDays)} days` : "Sandbox data unavailable"}
              />
              <MetricCard
                label="Outbound spend"
                value={sandboxSummary ? pounds.format(sandboxSummary.outboundAmountMinor / 100) : "–"}
                detail="Sanitised Sandbox totals"
              />
              <MetricCard
                label="Active days"
                value={sandboxSummary ? countFormatter.format(sandboxSummary.activeDays) : "–"}
                detail={sandboxSummary ? `Of ${countFormatter.format(sandboxSummary.totalDays)} days with any transaction` : "Days with any transaction"}
              />
              <MetricCard
                label="Largest day"
                value={sandboxSummary?.largestDay ? pounds.format(sandboxSummary.largestDay.outboundAmountMinor / 100) : "–"}
                detail={sandboxSummary?.largestDay ? sandboxSummary.largestDay.longLabel : "No outbound spend"}
              />
            </div>

            <RadarRecommendationChart
              badge={history.sourceClass === "mock" ? "Mock data" : undefined}
              categoryLabel="Date"
              data={history.data}
              description={`${runsLabel(historyTotal)} over ${countFormatter.format(windowDayCount(dateWindow))} days, daily by final recommendation. Sandbox scenario history; not production or model-training data.`}
              yAxisWidth={CHART_Y_AXIS_WIDTH}
              emptyMessage="No history for this scenario and range."
              title="Recommendations over time"
            />

            <RadarScenarioActivityChart
              badge="Sandbox"
              data={sandboxActivity}
              description="Daily outbound spend from the sanitised Plaid Sandbox dataset, read from the prepared store. No live provider request is made from this page."
              title="Outbound activity"
              yAxisWidth={CHART_Y_AXIS_WIDTH}
              unavailableMessage={sandboxLoading ? "Loading Sandbox activity…" : "Sandbox activity is unavailable. Start the local API with the Sandbox dataset configured."}
            />
          </TabsPrimitive.Content>

          {/* ---------------- Session ---------------- */}
          <TabsPrimitive.Content className="tab-panel" value="session">
            <div>
              <div className="section-heading">Synthetic showcase decision stream</div>
              <div className="section-sub">Only completed, synthetic showcase runs from this browser session appear here. No payments are executed and no runtime model score is shown.</div>
            </div>

            {investigation.error ? <p className="status-error">{investigation.error}</p> : null}

            {runs.length === 0 ? (
              <section className="empty-card">
                <div className="card-title">{running ? "Running your first showcase…" : "No showcase runs yet"}</div>
                <p className="card-copy">
                  Run {scenarioId} · {scenarioLabel} to see its deterministic route, final recommendation and evidence here. Runs stay in this browser session only.
                </p>
                <Button size="sm" onClick={runShowcase} disabled={running}>
                  {running ? "Running…" : `Run ${scenarioId}`}
                </Button>
              </section>
            ) : (
              <>
                <div className="radar-summary-grid" aria-label="Current session summary">
                  <MetricCard label="Runs completed" value={countFormatter.format(summary.processed)} detail={`${countFormatter.format(summary.completedInvestigations)} ${summary.completedInvestigations === 1 ? "investigation" : "investigations"} completed`} />
                  <MetricCard label="PASS" swatch={recommendationColors.PASS} value={countFormatter.format(summary.PASS)} detail={`${countFormatter.format(summary.deterministicPasses)} via deterministic route`} />
                  <MetricCard label="CHALLENGE" swatch={recommendationColors.CHALLENGE} value={countFormatter.format(summary.CHALLENGE)} detail={percentOf(summary.CHALLENGE, summary.processed)} />
                  <MetricCard label="HOLD" swatch={recommendationColors.HOLD} value={countFormatter.format(summary.HOLD)} detail={`${countFormatter.format(summary.failSafeHolds)} fail-safe (incomplete investigation)`} />
                </div>

                <div
                  aria-label={`PASS ${summary.PASS}, CHALLENGE ${summary.CHALLENGE}, HOLD ${summary.HOLD}`}
                  className="radar-outcome-distribution session-share"
                  role="img"
                >
                  {(["PASS", "CHALLENGE", "HOLD"] as const).map((key) =>
                    summary[key] ? (
                      <span
                        className="radar-outcome-distribution-segment"
                        key={key}
                        style={{ backgroundColor: recommendationColors[key], width: `${(summary[key] / summary.processed) * 100}%` }}
                      />
                    ) : null,
                  )}
                </div>

                <section className="table-card">
                  <div className="table-card-header"><span className="table-card-title">Current session decisions</span><span className="active-pill">Synthetic</span></div>
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th>Time</th><th>Run</th><th>Scenario</th><th>Route</th><th>Recommendation</th><th>Investigation</th><th>Evidence</th><th>Mode</th></tr></thead>
                      <tbody>
                        {runs.map((run) => <tr key={run.runId}>
                          <td className="td-mono">{run.timestamp}</td><td className="td-mono">{run.runId}</td><td className="td-scenario">{run.scenarioId}</td><td className="td-secondary">{run.route}</td>
                          <td><span className={`risk-pill ${recommendationClass(run.recommendation)}`}>{run.recommendation}</span></td><td className="td-secondary">{run.investigationStatus}</td><td className="td-secondary">{run.evidenceCount}</td><td className="td-secondary">{run.executionMode}</td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>
                </section>

                <details className="radar-collapsible">
                  <summary>Breakdown by scenario</summary>
                  <RadarRecommendationChart
                    categoryLabel="Scenario"
                    data={recommendationsByScenario}
                    description={`${runsLabel(summary.processed)} completed. Showcase runs by scenario and final recommendation. This is not a historical trend or a runtime score distribution.`}
                    emptyMessage="No completed showcase runs in this session."
                    title="Current session recommendations"
                  />
                </details>
              </>
            )}
          </TabsPrimitive.Content>

          {/* ---------------- Model ---------------- */}
          <TabsPrimitive.Content className="tab-panel" value="model">
            <div>
              <div className="section-heading">Model benchmark</div>
              <div className="section-sub">Held-out results for the XGBoost candidate on the simulated benchmark. Not live or production model performance; no model score is used when a showcase run is decided.</div>
            </div>
            {xgboost ? (
              <div className="radar-summary-grid benchmark-grid" aria-label="Model benchmark summary">
                <MetricCard label="XGBoost PR-AUC" value={xgboost.pr_auc.toFixed(4)} detail="Held-out simulated benchmark" />
                <MetricCard label="Brier score" value={xgboost.brier_score.toFixed(4)} detail="Not a production metric" />
              </div>
            ) : (
              <section className="empty-card">
                <div className="card-title">Benchmark unavailable</div>
                <p className="card-copy">Start the demo API to read the accepted model summary.</p>
              </section>
            )}
          </TabsPrimitive.Content>
        </div>
      </TabsPrimitive.Root>
    </main>
  )
}

type MetricCardProps = { label: string; value: string; detail: string; swatch?: string }

function MetricCard({ label, value, detail, swatch }: MetricCardProps) {
  return (
    <div className="stat-tile">
      <div className="stat-label">
        {swatch ? <span aria-hidden="true" className="radar-outcome-swatch" style={{ backgroundColor: swatch }} /> : null}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  )
}
