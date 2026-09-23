import { useEffect, useMemo, useRef, useState } from "react"

import { NetworkMark } from "@/components/averlynx-logo"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fetchDemoModelSummary, type DemoModelSummary } from "@/lib/demo-model-summary"
import {
  mockScenarioRecommendationHistory,
  type RecommendationHistoryRange,
} from "@/lib/mock-scenario-recommendation-history"
import {
  fetchSandboxScenarioAnalytics,
  sandboxDailyActivitySeries,
  type SandboxScenarioAnalytics,
} from "@/lib/sandbox-scenario-analytics"
import { useShowcaseInvestigation } from "@/lib/useShowcaseInvestigation"
import type { ShowcaseScenarioId } from "@/lib/showcase-types"

import { RadarRecommendationChart, type RadarRecommendationDatum } from "./RadarRecommendationChart"
import { RadarScenarioActivityChart } from "./RadarScenarioActivityChart"

const scenarios: ReadonlyArray<{ id: ShowcaseScenarioId; label: string }> = [
  { id: "S01", label: "Trusted recurring payment" },
  { id: "S02", label: "High-value / high-velocity risk" },
  { id: "S03", label: "Account drain / new payee" },
  { id: "S04", label: "Ambiguous contextual case" },
  { id: "S05", label: "Investigation failure path" },
]

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

function runsLabel(count: number): string {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? "run" : "runs"}`
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
  const [scenarioId, setScenarioId] = useState<ShowcaseScenarioId>("S01")
  const [runs, setRuns] = useState<SessionRun[]>([])
  const [benchmark, setBenchmark] = useState<DemoModelSummary | null>(null)
  const [historyRange, setHistoryRange] = useState<RecommendationHistoryRange>(30)
  const [sandboxAnalytics, setSandboxAnalytics] = useState<SandboxScenarioAnalytics | null>(null)
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
    if (scenarioId !== "S04") {
      setSandboxAnalytics(null)
      return () => {
        active = false
      }
    }
    fetchSandboxScenarioAnalytics(scenarioId).then(
      (analytics) => {
        if (active) setSandboxAnalytics(analytics)
      },
      () => {
        if (active) setSandboxAnalytics(null)
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

  const summary = useMemo(() => ({
    processed: runs.length,
    deterministicPasses: runs.filter((run) => run.route === "PASS").length,
    completedInvestigations: runs.filter((run) => run.investigationStatus === "complete").length,
    failSafeHolds: runs.filter((run) => run.isFailSafe).length,
  }), [runs])
  const recommendationsByScenario = useMemo<readonly RadarRecommendationDatum[]>(() => scenarios.map(({ id }) => {
    const scenarioRuns = runs.filter((run) => run.scenarioId === id)
    return {
      label: id,
      PASS: scenarioRuns.filter((run) => run.recommendation === "PASS").length,
      CHALLENGE: scenarioRuns.filter((run) => run.recommendation === "CHALLENGE").length,
      HOLD: scenarioRuns.filter((run) => run.recommendation === "HOLD").length,
    }
  }), [runs])
  const history = useMemo(() => mockScenarioRecommendationHistory(scenarioId, historyRange), [scenarioId, historyRange])
  const historyTotal = history.data.reduce((sum, datum) => sum + datum.PASS + datum.CHALLENGE + datum.HOLD, 0)
  const scenarioLabel = scenarios.find((scenario) => scenario.id === scenarioId)?.label
  const sandboxActivity = useMemo(() => (sandboxAnalytics ? sandboxDailyActivitySeries(sandboxAnalytics) : null), [sandboxAnalytics])
  const xgboost = benchmark?.model_results.find((model) => model.model_id === "xgboost_candidate")

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
            <Button size="sm" onClick={() => void investigation.start(scenarioId, "recorded")} disabled={investigation.status === "running"}>
              {investigation.status === "running" ? "Running…" : "Run showcase"}
            </Button>
          </div>
        </div>
      </div>

      <div className="tabs"><div className="tabs-list"><div className="tab active">Current session</div><div className="tab">Benchmark evidence</div></div></div>

      <div className="body-grid">
        <section>
          <div className="section-heading">Synthetic showcase decision stream</div>
          <div className="section-sub">Only completed, synthetic showcase runs from this browser session appear here. No payments are executed and no runtime model score is shown.</div>

          <div className="radar-summary-grid" aria-label="Current session summary">
            <MetricCard label="Runs processed" value={String(summary.processed)} detail="Completed showcase runs" />
            <MetricCard label="Deterministic passes" value={String(summary.deterministicPasses)} detail="Routes resolved without investigation" />
            <MetricCard label="Investigations completed" value={String(summary.completedInvestigations)} detail="Evidence-grounded recommendations" />
            <MetricCard label="Fail-safe holds" value={String(summary.failSafeHolds)} detail="Incomplete investigation outcomes" />
          </div>

          <RadarRecommendationChart
            categoryLabel="Scenario"
            data={recommendationsByScenario}
            description={`${runsLabel(summary.processed)} completed. Showcase runs by scenario and final recommendation. This is not a historical trend or a runtime score distribution.`}
            emptyMessage="No completed showcase runs in this session."
            title="Current session recommendations"
          >
            {investigation.error ? <p className="status-error">{investigation.error}</p> : null}
          </RadarRecommendationChart>

          <RadarRecommendationChart
            activeRange={historyRange}
            categoryLabel={history.bucket === "week" ? "Week starting" : "Date"}
            data={history.data}
            badge={history.sourceClass === "mock" ? "Mock data" : undefined}
            description={`${runsLabel(historyTotal)} for ${scenarioId} · ${scenarioLabel}, ${history.bucket === "week" ? "weekly" : "daily"} by final recommendation. Sandbox scenario history; not production or model-training data.`}
            emptyMessage="No mock history for this scenario and range."
            onRangeChange={setHistoryRange}
            title={`${scenarioId} recommendations over time`}
          />

          <RadarScenarioActivityChart
            data={sandboxActivity}
            description="S04 only. Prepared daily totals from the versioned, sanitised Sandbox dataset. No live provider request is made from this page."
            title="Sandbox scenario activity"
            unavailableMessage="Select S04 and start the local API with an imported Sandbox dataset to view historical activity."
          />

          <details className="benchmark-details">
            <summary>Synthetic benchmark evidence</summary>
            {xgboost ? <dl className="benchmark-metrics"><MetricCard label="XGBoost PR-AUC" value={xgboost.pr_auc.toFixed(4)} detail="Held-out simulated benchmark" /><MetricCard label="Brier score" value={xgboost.brier_score.toFixed(4)} detail="Not a production metric" /></dl> : <p className="card-copy">Benchmark evidence is unavailable. Start the demo API to read the accepted model summary.</p>}
          </details>

          <section className="table-card">
            <div className="table-card-header"><span className="table-card-title">Current session decisions</span><span className="active-pill">Synthetic</span></div>
            <table>
              <thead><tr><th>Time</th><th>Run</th><th>Scenario</th><th>Route</th><th>Recommendation</th><th>Investigation</th><th>Evidence</th><th>Mode</th></tr></thead>
              <tbody>
                {runs.length ? runs.map((run) => <tr key={run.runId}>
                  <td className="td-mono">{run.timestamp}</td><td className="td-mono">{run.runId}</td><td className="td-scenario">{run.scenarioId}</td><td className="td-secondary">{run.route}</td>
                  <td><span className={`risk-pill ${recommendationClass(run.recommendation)}`}>{run.recommendation}</span></td><td className="td-secondary">{run.investigationStatus}</td><td className="td-secondary">{run.evidenceCount}</td><td className="td-secondary">{run.executionMode}</td>
                </tr>) : <tr><td className="empty-table" colSpan={8}>No completed showcase runs in this session.</td></tr>}
              </tbody>
            </table>
          </section>
        </section>
      </div>
    </main>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="stat-tile"><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>
}
