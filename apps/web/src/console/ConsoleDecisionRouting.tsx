import { useId } from "react"
import { EvilSankeyChart } from "@/components/evilcharts/charts/recharts-sankey-chart"
import type { ChartConfig } from "@/components/evilcharts/ui/recharts-chart"
import { EMPTY_ROUTING_SUMMARY, ROUTING_OUTCOMES, routingRuleNote, routingSankeyData, routingSummary } from "@/lib/routing-summary"
import type { SandboxSimulationRun } from "@/lib/sandbox-simulation"
import { useRoutingBoardHidden } from "@/lib/useRoutingBoardHidden"

type ConsoleDecisionRoutingProps = {
  run: SandboxSimulationRun | null
  status: "idle" | "starting" | "live" | "finished" | "busy" | "unavailable" | "unsupported"
}

// The page's own outcome colours. This page is dark without a `.dark` class,
// so the chart sits in a `.dark` scope and both theme keys match.
const color = (value: string) => ({ light: [value], dark: [value] })
const chartConfig = {
  FEED: { label: "Feed", colors: color("var(--lch-text-tertiary)") },
  PASS: { label: "PASS", colors: color("var(--sev-low)") },
  CHALLENGE: { label: "CHALLENGE", colors: color("var(--sev-moderate)") },
  HOLD: { label: "HOLD", colors: color("var(--sev-high)") },
} satisfies ChartConfig

/** Fixed, read only Sankey of revealed deterministic feed decisions (spec 0006). */
export function ConsoleDecisionRouting({ run, status }: ConsoleDecisionRoutingProps) {
  // Every outcome is drawn from the start, at zero before any payment.
  // Workflow scenarios have no payment schedule, so they get no chart.
  const summary = status === "unsupported" ? null : routingSummary(run) ?? EMPTY_ROUTING_SUMMARY
  const data = summary ? routingSankeyData(summary) : null
  // Hiding stops the board's motion and frees its space without stopping the
  // feed (spec 0006 AC 9). It changes display only.
  const [hidden, setHidden] = useRoutingBoardHidden()
  const chartAreaId = useId()

  const quiet =
    status === "unsupported"
      ? "Workflow scenarios have no scheduled payments."
      : status === "starting"
        ? "Starting the live feed…"
        : status === "live"
          ? "Waiting for the first payment"
          : status === "finished"
            ? "No payments routed"
            : "Start Live to route simulated payments."
  // Why the lanes look as they do (spec 0008 AC 8), from the run's own data.
  const ruleNote = summary ? routingRuleNote(run?.scenario_id ?? null, summary) : null
  const announcement =
    status === "live"
      ? "Routing live payments."
      : status === "finished" && summary
        ? `Routing finished: ${summary.counts.PASS} pass, ${summary.counts.CHALLENGE} challenge, ${summary.counts.HOLD} hold.`
        : ""

  return (
    <section className="console-routing" aria-label="Live decision routing">
      <header className="console-routing-header">
        <div>
          <div className="card-title">Live decision routing</div>
          <p className="card-copy">Each synthetic payment follows its fixed, precomputed outcome. Nothing here can be changed.</p>
        </div>
        <div className="console-routing-pills">
          <span className="console-source-pill">Synthetic</span>
          <span className="console-source-pill">Read only</span>
          {summary && data ? (
            <button
              aria-controls={chartAreaId}
              aria-expanded={!hidden}
              className="console-routing-toggle"
              onClick={() => setHidden(!hidden)}
              type="button"
            >
              {hidden ? "Show board" : "Hide board"}
            </button>
          ) : null}
        </div>
      </header>
      <p className="console-routing-sr" aria-live="polite">{announcement}</p>
      {!summary || !data ? <p className="console-routing-empty">{quiet}</p> : (
        <div className={hidden ? "console-routing-body is-collapsed" : "console-routing-body"}>
          <div id={chartAreaId}>
            {hidden ? null : (
              <>
                <div aria-hidden="true" className="dark console-routing-chart">
                  <EvilSankeyChart
                    className="aspect-auto h-full w-full p-4"
                    config={chartConfig}
                    data={data}
                    nodePadding={42}
                    nodeWidth={80}
                    // The chart is hidden from assistive tech (the list below carries
                    // the counts), so its SVG must not take keyboard focus either.
                    sankeyProps={{ accessibilityLayer: false, margin: { top: 28, right: 5, bottom: 20, left: 5 } }}
                    sort={false}
                  >
                    <EvilSankeyChart.Node minNodeHeight={44} radius={4}>
                      <EvilSankeyChart.NodeLabel position="inside" showValues valueFormatter={(value) => value.toLocaleString()} />
                    </EvilSankeyChart.Node>
                    <EvilSankeyChart.Link
                      variant="source"
                      verticalPadding={8}
                      emptyTargetOpacity={0.15}
                      pulseKey={summary.last?.sequence ?? null}
                      pulseTarget={summary.last?.recommendation ?? null}
                    />
                  </EvilSankeyChart>
                </div>
                <ul className="console-routing-sr" aria-label="Routed payments by outcome">
                  {ROUTING_OUTCOMES.map((outcome) => <li key={outcome}>{outcome} {summary.counts[outcome]}</li>)}
                </ul>
              </>
            )}
          </div>
          <p className="console-routing-footer">
            {summary.last ? <span>Last routed <strong>#{summary.last.sequence}</strong> → {summary.last.recommendation}{summary.last.routed_by === "model" && summary.last.model_score !== null && summary.last.model_score !== undefined ? ` · model ${summary.last.model_score.toFixed(3)}` : ""}</span> : <span>{quiet}</span>}
            {ruleNote ? <span className="console-routing-rule">{ruleNote}</span> : null}
          </p>
        </div>
      )}
    </section>
  )
}
