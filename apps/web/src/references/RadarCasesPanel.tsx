import type { MouseEvent, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ShowcaseCaseFilters } from "@/lib/showcase-cases"

import { RadarMetricCard as MetricCard } from "./RadarMetricCard"
import { recommendationPillClass } from "./radar-pills"
import { RadarRecommendationChart, type RadarRecommendationDatum } from "./RadarRecommendationChart"
import { RadarDecisionRouting } from "./RadarDecisionRouting"
import type { SandboxSimulationRun } from "@/lib/sandbox-simulation"

/** One table row, from a saved case or (fallback / not saved) a session run. */
export type RadarCaseRow = {
  id: string
  time: string
  scenarioId: string
  route: "PASS" | "HOLD" | "INVESTIGATE"
  recommendation: "PASS" | "CHALLENGE" | "HOLD"
  investigationStatus: "skipped" | "complete" | "incomplete"
  evidenceCount: number
  mode: string
  /** Case page link; null for rows that were never saved. */
  href: string | null
  notSaved: boolean
}

export type RadarCasesSummary = {
  total: number
  PASS: number
  CHALLENGE: number
  HOLD: number
  deterministicPasses: number
  failSafeHolds: number
  completedInvestigations: number
  byScenario: readonly RadarRecommendationDatum[]
}

type RadarCasesPanelProps = {
  /** "saved" reads durable cases; "fallback" shows this visit's runs (AC-10). */
  mode: "saved" | "fallback" | "loading"
  rows: readonly RadarCaseRow[]
  summary: RadarCasesSummary
  filters: ShowcaseCaseFilters
  onFiltersChange: (filters: ShowcaseCaseFilters) => void
  hasMore: boolean
  loadingMore: boolean
  onShowMore: () => void
  scenarioOptions: ReadonlyArray<{ id: string; label: string }>
  runLabel: string
  /** Why Run is unavailable (the Mixed feed spans five scenarios), or null. */
  runUnavailable: string | null
  running: boolean
  onRun: () => void
  /** Stops the showcase run in progress; the run button becomes Stop meanwhile. */
  onStop: () => void
  error: string | null
  /** Open a saved case in the drawer instead of navigating away. */
  onOpenCase: (caseId: string) => void
  feedRun: SandboxSimulationRun | null
  feedStatus: "idle" | "starting" | "live" | "finished" | "busy" | "unavailable" | "unsupported"
}

const recommendationColors = {
  PASS: "var(--sev-low)",
  CHALLENGE: "var(--sev-moderate)",
  HOLD: "var(--sev-high)",
} as const

const ALL = "all"
const countFormatter = new Intl.NumberFormat("en-GB")

// Wording for storage on and for the fallback, per spec 0002's Copy table.
const COPY = {
  saved: {
    heading: "Saved cases",
    description:
      "Completed synthetic showcase runs from this browser, kept for 30 days (up to 50). No payments are executed and no runtime model score is shown.",
    emptyTitle: "No saved cases yet",
    emptyEnding: "Saved cases stay in this browser for 30 days.",
    tableTitle: "Cases",
    breakdownEmpty: "No saved cases yet.",
  },
  fallback: {
    heading: "This visit's runs",
    description:
      "Saved cases are unavailable. Check the local API logs for storage status. Only this visit's runs appear here. No payments are executed and no runtime model score is shown.",
    emptyTitle: "No showcase runs yet",
    emptyEnding: "Runs stay in this browser session only.",
    tableTitle: "This visit's decisions",
    breakdownEmpty: "No completed showcase runs in this session.",
  },
} as const

function plural(count: number, one: string, many: string): string {
  return `${countFormatter.format(count)} ${count === 1 ? one : many}`
}

/** Radar's Cases tab: saved cases when storage is on, else this visit's runs. */
export function RadarCasesPanel(props: RadarCasesPanelProps) {
  const { mode, rows, summary, error } = props
  const copy = mode === "saved" ? COPY.saved : COPY.fallback

  if (mode === "loading") {
    return (
      <section className="empty-card" aria-live="polite">
        <div className="card-title">Loading saved cases…</div>
      </section>
    )
  }

  return (
    <>
      <div>
        <div className="section-heading">{copy.heading}</div>
        <div className="section-sub">{copy.description}</div>
      </div>

      {error ? <p className="status-error">{error}</p> : null}

      <RadarDecisionRouting run={props.feedRun} status={props.feedStatus} />

      {summary.total === 0 && rows.length === 0 && !hasActiveFilters(props.filters) ? (
        <section className="empty-card">
          <div className="card-title">{props.running ? "Running your first showcase…" : copy.emptyTitle}</div>
          <p className="card-copy">
            {props.runUnavailable
              ? `${props.runUnavailable} and see its deterministic route, final recommendation and evidence here.`
              : `Run ${props.runLabel} to see its deterministic route, final recommendation and evidence here.`} {copy.emptyEnding}
          </p>
          <Button
            disabled={Boolean(props.runUnavailable) && !props.running}
            onClick={props.running ? props.onStop : props.onRun}
            size="sm"
            title={props.running ? undefined : props.runUnavailable ?? undefined}
            variant={props.running ? "outline" : "default"}
          >
            {props.running ? "Stop showcase" : props.runUnavailable ? "Run showcase" : `Run ${props.runLabel.split(" · ")[0]}`}
          </Button>
        </section>
      ) : (
        <>
          <div className="radar-summary-grid" aria-label="Cases summary">
            <MetricCard
              label="Runs completed"
              value={countFormatter.format(summary.total)}
              detail={`${plural(summary.completedInvestigations, "investigation", "investigations")} completed`}
            />
            <MetricCard
              label="PASS"
              swatch={recommendationColors.PASS}
              value={countFormatter.format(summary.PASS)}
              detail={`${countFormatter.format(summary.deterministicPasses)} via deterministic route`}
            />
            <MetricCard
              label="CHALLENGE"
              swatch={recommendationColors.CHALLENGE}
              value={countFormatter.format(summary.CHALLENGE)}
              detail={summary.total ? `${Math.round((summary.CHALLENGE / summary.total) * 100)}% of runs` : "No runs yet"}
            />
            <MetricCard
              label="HOLD"
              swatch={recommendationColors.HOLD}
              value={countFormatter.format(summary.HOLD)}
              detail={`${countFormatter.format(summary.failSafeHolds)} fail-safe (incomplete investigation)`}
            />
          </div>


          <section className="table-card">
            <div className="table-card-header">
              <span className="table-card-title">{copy.tableTitle}</span>
              <span className="active-pill">Synthetic</span>
              {mode === "saved" ? (
                <CaseFilters filters={props.filters} onChange={props.onFiltersChange} scenarioOptions={props.scenarioOptions} />
              ) : null}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th><th>Run</th><th>Scenario</th><th>Route</th><th>Recommendation</th><th>Investigation</th><th>Evidence</th><th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td className="td-mono">{row.time}</td>
                        <td className="td-mono">
                          {row.href ? (
                            // A plain click opens the drawer; the link still works as a
                            // whole window deep link (new tab, copy link, no JavaScript).
                            <a
                              className="case-link"
                              data-case-link={row.id}
                              href={row.href}
                              onClick={openInDrawer(row.id, props.onOpenCase)}
                              target="_top"
                            >
                              {row.id}
                            </a>
                          ) : (
                            row.id
                          )}
                          {row.notSaved ? <span className="not-saved-pill">Not saved</span> : null}
                        </td>
                        <td className="td-scenario">{row.scenarioId}</td>
                        <td className="td-secondary">{row.route}</td>
                        <td><span className={`risk-pill ${recommendationPillClass(row.recommendation)}`}>{row.recommendation}</span></td>
                        <td className="td-secondary">{row.investigationStatus}</td>
                        <td className="td-secondary">{row.evidenceCount}</td>
                        <td className="td-secondary">{row.mode}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td className="empty-table" colSpan={8}>No cases match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {props.hasMore ? (
              <div className="table-card-footer">
                <Button className="show-more" size="sm" variant="outline" onClick={props.onShowMore} disabled={props.loadingMore}>
                  {props.loadingMore ? "Loading…" : "Show more"}
                </Button>
              </div>
            ) : null}
          </section>

          <details className="radar-collapsible">
            <summary>Breakdown by scenario</summary>
            <RadarRecommendationChart
              categoryLabel="Scenario"
              data={summary.byScenario}
              description={`${plural(summary.total, "run", "runs")} completed. Showcase runs by scenario and final recommendation. This is not a historical trend or a runtime score distribution.`}
              emptyMessage={copy.breakdownEmpty}
              title="Recommendations by scenario"
            />
          </details>
        </>
      )}
    </>
  )
}

function openInDrawer(caseId: string, onOpenCase: (caseId: string) => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    // Leave modified clicks (new tab or window) to the browser.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenCase(caseId)
  }
}

function hasActiveFilters(filters: ShowcaseCaseFilters): boolean {
  return Boolean(filters.scenarioId || filters.recommendation)
}

type CaseFiltersProps = {
  filters: ShowcaseCaseFilters
  onChange: (filters: ShowcaseCaseFilters) => void
  scenarioOptions: ReadonlyArray<{ id: string; label: string }>
}

function CaseFilters({ filters, onChange, scenarioOptions }: CaseFiltersProps) {
  return (
    <div className="case-filters">
      <FilterSelect
        label="Filter by scenario"
        value={filters.scenarioId ?? ALL}
        onChange={(value) =>
          onChange({ ...filters, scenarioId: value === ALL ? undefined : (value as ShowcaseCaseFilters["scenarioId"]) })
        }
      >
        <SelectItem value={ALL}>All scenarios</SelectItem>
        {scenarioOptions.map((option) => (
          <SelectItem key={option.id} value={option.id}>{option.id} · {option.label}</SelectItem>
        ))}
      </FilterSelect>
      <FilterSelect
        label="Filter by recommendation"
        value={filters.recommendation ?? ALL}
        onChange={(value) =>
          onChange({ ...filters, recommendation: value === ALL ? undefined : (value as ShowcaseCaseFilters["recommendation"]) })
        }
      >
        <SelectItem value={ALL}>All outcomes</SelectItem>
        <SelectItem value="PASS">PASS</SelectItem>
        <SelectItem value="CHALLENGE">CHALLENGE</SelectItem>
        <SelectItem value="HOLD">HOLD</SelectItem>
      </FilterSelect>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">{children}</SelectContent>
    </Select>
  )
}
