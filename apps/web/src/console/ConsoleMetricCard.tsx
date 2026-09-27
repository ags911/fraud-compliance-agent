type ConsoleMetricCardProps = { label: string; value: string; detail: string; swatch?: string }

/** One Risk Console stat tile: label, value, and a secondary grey detail line. */
export function ConsoleMetricCard({ label, value, detail, swatch }: ConsoleMetricCardProps) {
  return (
    <div className="stat-tile">
      <div className="stat-label">
        {swatch ? <span aria-hidden="true" className="console-outcome-swatch" style={{ backgroundColor: swatch }} /> : null}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  )
}
