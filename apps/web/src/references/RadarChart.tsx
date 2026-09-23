import type { CSSProperties } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type WeeklyBucket = { week: string; cleared: number; flagged: number }

const seriesLabel: Record<string, string> = { cleared: "Cleared", flagged: "Flagged" }
const seriesColor: Record<string, string> = { cleared: "var(--chart-base)", flagged: "var(--chart-overflow)" }

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

// Same relative proportions as the original mockup's hand-drawn bar heights
// (110/33, 160/27, 82/18, 129/6 px against its 0-300 scale), expressed as
// real chart values instead of literal pixel heights.
const data: WeeklyBucket[] = [
  { week: "Aug 14", cleared: 165, flagged: 50 },
  { week: "Aug 21", cleared: 240, flagged: 40 },
  { week: "Aug 28", cleared: 123, flagged: 27 },
  { week: "Sep 4", cleared: 194, flagged: 9 },
]

/**
 * Recharts replacement for the mockup's hand-drawn stacked bar chart.
 *
 * The original drew gridlines as two `::before`/`::after` pseudo-elements on
 * `.chart-bars`, hard-coded at 0% and 33.3% — only 2 of the 4 positions
 * implied by the y-axis's 300/200/100/0 labels — and, being absolutely
 * positioned, painted after (so visually on top of) the bars. CartesianGrid
 * derives its lines from the same tick scale as YAxis and renders behind the
 * bars by construction, so both bugs go away without hand-tuning offsets.
 *
 * Colours and type come from the mockup's own CSS custom properties
 * (`--chart-base`, `--chart-overflow`, `--lch-text-tertiary`, etc.), defined
 * on :root in references/radar-reference.html — not this app's design
 * system — since this chart is mounted inside that same document.
 */
export function RadarChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--lch-border-soft)" />
        <Tooltip
          cursor={{ fill: "var(--lch-bg-hover)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div style={tooltipStyle}>
                <div style={{ color: "var(--lch-text-tertiary)", marginBottom: 4 }}>{String(label)}</div>
                {payload.map((entry) => (
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
          tickMargin={8}
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
        <Bar dataKey="cleared" stackId="scenario" fill="var(--chart-base)" radius={[0, 0, 2, 2]} barSize={44} />
        <Bar dataKey="flagged" stackId="scenario" fill="var(--chart-overflow)" radius={[4, 4, 0, 0]} barSize={44} />
      </BarChart>
    </ResponsiveContainer>
  )
}
