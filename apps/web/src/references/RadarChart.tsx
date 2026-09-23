import type { CSSProperties } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type WeeklyByEngine = { week: string; ml: number; llm: number; system: number }

const seriesLabel: Record<string, string> = { ml: "ML Tier", llm: "LLM Tier", system: "System" }
// Blue (bottom) -> green (middle) -> indigo (top), the same band order and
// hues as the reference's own stacked area chart, reusing this app's
// existing tokens rather than introducing new ones.
const seriesColor: Record<string, string> = {
  ml: "var(--chart-base)",
  llm: "var(--sev-low)",
  system: "var(--sev-fallback)",
}

const tooltipStyle: CSSProperties = {
  background: "var(--lch-bg-pill)",
  border: "1px solid var(--lch-border)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  fontSize: 12.5,
  fontFamily: "Inter, sans-serif",
  color: "var(--lch-text-primary)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
}

// Same weekly totals the original mockup used (215/280/150/203 cleared+
// flagged), split across the three scoring engines the review table below
// already names.
const data: WeeklyByEngine[] = [
  { week: "Aug 14", ml: 98, llm: 82, system: 35 },
  { week: "Aug 21", ml: 150, llm: 95, system: 35 },
  { week: "Aug 28", ml: 62, llm: 58, system: 32 },
  { week: "Sep 4", ml: 118, llm: 65, system: 20 },
]

const engineTotals = data.reduce(
  (totals, week) => ({
    ml: totals.ml + week.ml,
    llm: totals.llm + week.llm,
    system: totals.system + week.system,
  }),
  { ml: 0, llm: 0, system: 0 },
)

/**
 * Stacked area chart, replacing the previous stacked bar chart -- matches
 * the smooth multi-series area style from the Linear-style Insights
 * Dashboard reference (dashed vertical gridlines only, no horizontal ones,
 * soft gradient fills under each series) rather than the mockup's original
 * hand-drawn bars.
 *
 * Broken down by scoring engine (ML tier / LLM tier / System fallback) --
 * the same breakdown the "Review blocked scenarios" table's Engine column
 * already uses -- instead of the mockup's cleared/flagged split, so the
 * chart and the table below tell a consistent story. Renders its own
 * legend (reusing radar-reference.html's own .legend-row/.legend-item
 * classes) instead of a static one, so the counts can't drift from the
 * chart's actual data.
 */
export function RadarChart() {
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="radar-area-ml" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-base)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--chart-base)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="radar-area-llm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sev-low)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--sev-low)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="radar-area-system" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sev-fallback)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--sev-fallback)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} stroke="var(--lch-border-soft)" strokeDasharray="3 4" />
          <Tooltip
            cursor={{ stroke: "var(--lch-border)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div style={tooltipStyle}>
                  <div style={{ color: "var(--lch-text-tertiary)", marginBottom: 4 }}>{String(label)}</div>
                  {[...payload].reverse().map((entry) => (
                    <div key={String(entry.dataKey)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        aria-hidden="true"
                        style={{ width: 8, height: 8, borderRadius: 2, background: seriesColor[String(entry.dataKey)] }}
                      />
                      <span style={{ color: "var(--lch-text-secondary)" }}>{seriesLabel[String(entry.dataKey)]}</span>
                      <span style={{ fontWeight: 600, marginLeft: "auto" }}>{String(entry.value)}</span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          <XAxis
            dataKey="week"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tick={{ fill: "var(--lch-text-tertiary)", fontSize: 11.5, fontFamily: "Inter, sans-serif" }}
          />
          <YAxis
            domain={[0, 300]}
            ticks={[0, 100, 200, 300]}
            axisLine={false}
            tickLine={false}
            width={28}
            tick={{ fill: "var(--lch-text-tertiary)", fontSize: 11, fontFamily: "Inter, sans-serif" }}
          />
          <Area
            type="monotone"
            dataKey="system"
            stackId="engine"
            stroke="var(--sev-fallback)"
            strokeWidth={1.5}
            fill="url(#radar-area-system)"
          />
          <Area
            type="monotone"
            dataKey="llm"
            stackId="engine"
            stroke="var(--sev-low)"
            strokeWidth={1.5}
            fill="url(#radar-area-llm)"
          />
          <Area
            type="monotone"
            dataKey="ml"
            stackId="engine"
            stroke="var(--chart-base)"
            strokeWidth={1.5}
            fill="url(#radar-area-ml)"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="legend-row">
        {(["ml", "llm", "system"] as const).map((key) => (
          <div className="legend-item" key={key}>
            <span className="legend-swatch" style={{ background: seriesColor[key] }} />
            {seriesLabel[key]} <span className="legend-count">{engineTotals[key]}</span>
          </div>
        ))}
      </div>
    </>
  )
}
