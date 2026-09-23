import type { CSSProperties } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type RiskBucket = { level: string; count: number; color: string }

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

// "Flagged 150" matches the mockup's own legend count; Low/Moderate/Blocked
// are new buckets that split "Cleared 830" out into a fuller risk ladder.
// Colours match the reference's own palette (green for the best outcome,
// amber for the moderate bucket, muted grey for its smallest one) rather
// than this app's own severity tokens -- --sev-high (red) is the one
// addition, since the reference had no bucket as bad as "High risk".
const data: RiskBucket[] = [
  { level: "Low risk", count: 620, color: "var(--sev-low)" },
  { level: "Moderate risk", count: 210, color: "var(--sev-moderate)" },
  { level: "High risk", count: 150, color: "var(--sev-high)" },
  { level: "Blocked", count: 45, color: "var(--lch-text-tertiary)" },
]

/**
 * One thin bar per risk bucket, colour-coded, with dashed horizontal
 * gridlines and no y-axis numbers -- the same minimal single-row chart
 * style as the Linear-style Insights Dashboard reference's "SLA Success
 * Rate" panel, applied to this app's own risk ladder instead.
 */
export function RadarRiskLevelChart() {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--lch-border-soft)" strokeDasharray="3 4" />
        <Tooltip
          cursor={{ fill: "var(--lch-bg-hover)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const entry = payload[0]
            const bucket = entry.payload as RiskBucket
            return (
              <div style={tooltipStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 8, height: 8, borderRadius: 2, background: bucket.color }}
                  />
                  <span style={{ color: "var(--lch-text-secondary)" }}>{bucket.level}</span>
                  <span style={{ fontWeight: 600, marginLeft: "auto" }}>{String(entry.value)}</span>
                </div>
              </div>
            )
          }}
        />
        <YAxis hide domain={[0, "dataMax"]} />
        <XAxis
          dataKey="level"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          tick={{ fill: "var(--lch-text-tertiary)", fontSize: 11.5, fontFamily: "Inter, sans-serif" }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={10}>
          {data.map((bucket) => (
            <Cell key={bucket.level} fill={bucket.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
