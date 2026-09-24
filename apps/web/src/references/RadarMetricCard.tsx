type RadarMetricCardProps = { label: string; value: string; detail: string; swatch?: string }

/** One Radar stat tile: label, value, and a secondary grey detail line. */
export function RadarMetricCard({ label, value, detail, swatch }: RadarMetricCardProps) {
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
