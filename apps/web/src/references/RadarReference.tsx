import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
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
import type { ShowcaseCaseFilters, ShowcaseCaseSummary } from "@/lib/showcase-cases"
import { useRadarCaseParam } from "@/lib/useRadarCaseParam"
import { useShowcaseCase } from "@/lib/useShowcaseCase"
import { useShowcaseCases } from "@/lib/useShowcaseCases"
import { useSandboxFeed } from "@/lib/useSandboxFeed"
import { useShowcaseInvestigation } from "@/lib/useShowcaseInvestigation"
import type { ShowcaseScenarioId } from "@/lib/showcase-types"

import { RadarCaseDrawer } from "./RadarCaseDrawer"
import { RadarCasesPanel, type RadarCaseRow, type RadarCasesSummary } from "./RadarCasesPanel"
import { RadarLiveSwitch } from "./RadarLiveSwitch"
import { RadarMetricCard as MetricCard } from "./RadarMetricCard"
import { RadarRangeToggle } from "./RadarRangeToggle"
import { RadarRecommendationChart } from "./RadarRecommendationChart"
import { RadarScenarioActivityChart } from "./RadarScenarioActivityChart"

const scenarios: ReadonlyArray<{ id: ShowcaseScenarioId; label: string }> = [
  { id: "S01", label: "Trusted recurring payment" },
  { id: "S02", label: "High-value / high-velocity risk" },
  { id: "S03", label: "Account drain / new payee" },
  { id: "S04", label: "Ambiguous contextual case" },
  { id: "S05", label: "Investigation failure path" },
]

type DashboardTab = "scenario" | "cases" | "model"

type SessionRun = {
  runId: string
  scenarioId: ShowcaseScenarioId
  timestamp: string
  route: "PASS" | "HOLD" | "INVESTIGATE"
  recommendation: "PASS" | "CHALLENGE" | "HOLD"
  investigationStatus: "skipped" | "complete" | "incomplete"
  executionMode: "recorded" | "live"
  fallbackReason: ShowcaseCaseSummary["fallback_reason"]
  evidenceCount: number
  isFailSafe: boolean
}

// Short Mode column wording, so a live request that ran as recorded says why.
const FALLBACK_SHORT = {
  live_disabled: "live off",
  admission_limited: "live limit reached",
  provider_unavailable: "live provider unavailable",
} as const

function modeLabel(mode: "recorded" | "live", fallbackReason: ShowcaseCaseSummary["fallback_reason"]): string {
  return fallbackReason ? `${mode} (${FALLBACK_SHORT[fallbackReason]})` : mode
}

// The Sandbox result is stored with the scenario it belongs to, so a
// scenario switch reads as "loading" until its own response arrives.
type SandboxResult = { scenarioId: ShowcaseScenarioId; analytics: SandboxScenarioAnalytics | null }

// Both Scenario charts reserve the same y-axis width, so a given day sits
// at the same x position in each and the two can be read together.
const CHART_Y_AXIS_WIDTH = 56

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })
const countFormatter = new Intl.NumberFormat("en-GB")

function runsLabel(count: number): string {
  return `${countFormatter.format(count)} ${count === 1 ? "run" : "runs"}`
}

function timeNow(): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())
}

export function RadarReference() {
  // The case drawer's state lives in ?case=<id>, so refresh, Back and shared
  // links work; the full case is fetched only while the drawer is open.
  const caseParam = useRadarCaseParam()
  const openCase = useShowcaseCase(caseParam.caseId ?? undefined, { enabled: caseParam.caseId !== null })
  // A shared ?case= link opens on the Cases tab, where the drawer belongs.
  const [tab, setTab] = useState<DashboardTab>(() => (caseParam.caseId ? "cases" : "scenario"))
  const [scenarioId, setScenarioId] = useState<ShowcaseScenarioId>("S01")
  const [range, setRange] = useState<ScenarioRange>(30)
  const [runs, setRuns] = useState<SessionRun[]>([])
  const [benchmark, setBenchmark] = useState<DemoModelSummary | null>(null)
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null)
  const [caseFilters, setCaseFilters] = useState<ShowcaseCaseFilters>({})
  const seenRunIds = useRef(new Set<string>())
  const investigation = useShowcaseInvestigation()
  const cases = useShowcaseCases(caseFilters)
  // The live feed's payments are added to the imported base for this view.
  const feed = useSandboxFeed(scenarioId)
  const { trackRun } = cases

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
    // Refetched as each feed payment lands (feed.revision), keeping the last
    // figures on screen until the new ones arrive.
    fetchSandboxScenarioAnalytics(scenarioId, feed.runId).then(
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
  }, [scenarioId, feed.runId, feed.revision])

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
        fallbackReason: runStarted.fallback_reason,
        evidenceCount,
        isFailSafe: runResult.recommendation_basis === "fail_safe",
      },
      ...current,
    ])
    // Ask the API whether this run was saved, then refresh the Cases list.
    trackRun(runStarted.run_id)
  }, [investigation, trackRun])

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

  // ---- Cases tab -----------------------------------------------------------
  // Saved cases when storage is on; this visit's runs as the fallback (AC-10).
  const casesMode = cases.state.status === "ready" ? "saved" : cases.state.status === "unavailable" ? "fallback" : "loading"
  const sessionRow = (run: SessionRun, notSaved: boolean): RadarCaseRow => ({
    id: run.runId,
    time: run.timestamp,
    scenarioId: run.scenarioId,
    route: run.route,
    recommendation: run.recommendation,
    investigationStatus: run.investigationStatus,
    evidenceCount: run.evidenceCount,
    mode: modeLabel(run.executionMode, run.fallbackReason),
    href: null,
    notSaved,
  })
  const caseRows = useMemo<RadarCaseRow[]>(() => {
    if (cases.state.status !== "ready") return runs.map((run) => sessionRow(run, false))
    // A finished run missing from the saved list is shown, unlinked, as "Not
    // saved" (left out of the totals), when it matches the current filters.
    const unsaved = runs
      .filter((run) => cases.savedStates[run.runId] === "not_saved")
      .filter((run) => !caseFilters.scenarioId || run.scenarioId === caseFilters.scenarioId)
      .filter((run) => !caseFilters.recommendation || run.recommendation === caseFilters.recommendation)
      .map((run) => sessionRow(run, true))
    const saved = cases.state.items.map<RadarCaseRow>((item) => ({
      id: item.case_id,
      time: format(new Date(item.completed_at), "d MMM, HH:mm:ss"),
      scenarioId: item.scenario_id,
      route: item.deterministic_route,
      recommendation: item.recommendation,
      investigationStatus: item.investigation_status,
      evidenceCount: item.evidence_count,
      mode: modeLabel(item.execution_mode, item.fallback_reason),
      href: `/transactions/${item.case_id}`,
      notSaved: false,
    }))
    return [...unsaved, ...saved]
    // sessionRow is a pure mapping defined above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases.state, cases.savedStates, runs, caseFilters])
  const casesSummary = useMemo<RadarCasesSummary>(() => {
    if (cases.state.status === "ready") {
      const { totals } = cases.state
      return {
        total: totals.total,
        ...totals.by_recommendation,
        deterministicPasses: totals.deterministic_passes,
        failSafeHolds: totals.fail_safe_holds,
        completedInvestigations: totals.completed_investigations,
        byScenario: scenarios.map(({ id }) => ({ label: id, ...(totals.by_scenario[id] ?? { PASS: 0, CHALLENGE: 0, HOLD: 0 }) })),
      }
    }
    const count = (predicate: (run: SessionRun) => boolean) => runs.filter(predicate).length
    return {
      total: runs.length,
      PASS: count((run) => run.recommendation === "PASS"),
      CHALLENGE: count((run) => run.recommendation === "CHALLENGE"),
      HOLD: count((run) => run.recommendation === "HOLD"),
      deterministicPasses: count((run) => run.route === "PASS"),
      failSafeHolds: count((run) => run.isFailSafe),
      completedInvestigations: count((run) => run.investigationStatus === "complete"),
      byScenario: scenarios.map(({ id }) => {
        const scenarioRuns = runs.filter((run) => run.scenarioId === id)
        return {
          label: id,
          PASS: scenarioRuns.filter((run) => run.recommendation === "PASS").length,
          CHALLENGE: scenarioRuns.filter((run) => run.recommendation === "CHALLENGE").length,
          HOLD: scenarioRuns.filter((run) => run.recommendation === "HOLD").length,
        }
      }),
    }
  }, [cases.state, runs])
  const casesTabCount = cases.state.status === "ready" ? cases.state.totals.total : runs.length

  // ---- Model tab -----------------------------------------------------------
  const xgboost = benchmark?.model_results.find((model) => model.model_id === "xgboost_candidate")

  function runShowcase() {
    // The result only appears on the Cases tab, so take the viewer there.
    setTab("cases")
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
            <RadarLiveSwitch onStart={feed.start} onStop={feed.stop} state={feed.state} />
            <Button size="sm" onClick={runShowcase} disabled={running}>
              {running ? "Running…" : "Run showcase"}
            </Button>
          </div>
        </div>
      </div>

      <TabsPrimitive.Root
        value={tab}
        onValueChange={(value) => {
          setTab(value as DashboardTab)
          // Cases can be saved from other pages (the investigation page), so
          // opening the tab always reads the latest first page.
          if (value === "cases") cases.refresh()
        }}
      >
        <div className="tabs">
          <TabsPrimitive.List aria-label="Dashboard sections" className="tabs-list">
            <TabsPrimitive.Trigger className="tab" value="scenario">Scenario</TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger className="tab" value="cases">
              Cases{casesTabCount ? <span className="tab-count">{casesTabCount}</span> : null}
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
                  {formatDateWindow(dateWindow)} · {countFormatter.format(windowDayCount(dateWindow))} days
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
              description={`${runsLabel(historyTotal)} over ${countFormatter.format(windowDayCount(dateWindow))} days, daily by final recommendation.`}
              yAxisWidth={CHART_Y_AXIS_WIDTH}
              emptyMessage="No history for this scenario and range."
              title="Recommendations over time"
            />

            <RadarScenarioActivityChart
              badge="Sandbox"
              data={sandboxActivity}
              description="Daily outbound spend across the selected days, in pounds."
              title="Outbound activity"
              yAxisWidth={CHART_Y_AXIS_WIDTH}
              unavailableMessage={sandboxLoading ? "Loading Sandbox activity…" : "Sandbox activity is unavailable. Start the local API with the Sandbox dataset configured."}
            />

            {/* The full explanation lives here once; each chart keeps only its
                one-word source badge, so a chart on its own still says what it is. */}
            {/* One line only; the per source detail moves to a help control later. */}
            <footer className="panel-footnote">
              <p>
                <span className="panel-footnote-label">About this data</span>
                Sanitised Plaid Sandbox data, with mock recommendations and simulated live feed payments. Not production or model training data.
              </p>
            </footer>
          </TabsPrimitive.Content>

          {/* ---------------- Cases ---------------- */}
          <TabsPrimitive.Content className="tab-panel" value="cases">
            <RadarCasesPanel
              error={investigation.error}
              filters={caseFilters}
              hasMore={cases.state.status === "ready" && Boolean(cases.state.nextCursor)}
              loadingMore={cases.state.status === "ready" && cases.state.loadingMore}
              mode={casesMode}
              onFiltersChange={setCaseFilters}
              onOpenCase={caseParam.openCase}
              onRun={runShowcase}
              onShowMore={cases.loadMore}
              rows={caseRows}
              runLabel={`${scenarioId} · ${scenarioLabel}`}
              running={running}
              scenarioOptions={scenarios}
              summary={casesSummary}
            />
            <RadarCaseDrawer
              caseId={caseParam.caseId}
              onClose={caseParam.closeCase}
              onRetry={openCase.retry}
              state={openCase.state}
            />
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
