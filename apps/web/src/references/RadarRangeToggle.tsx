import { cn } from "@/lib/utils"
import { scenarioRangeOptions, type ScenarioRange } from "@/lib/scenario-date-window"

type RadarRangeToggleProps = {
  value: ScenarioRange
  onChange: (range: ScenarioRange) => void
  label?: string
}

/** Segmented 7D / 30D / All control, styled by radar-reference.html's .radar-range-* rules. */
export function RadarRangeToggle({ value, onChange, label = "Date range" }: RadarRangeToggleProps) {
  return (
    <div aria-label={label} className="radar-range-toggle" role="group">
      {scenarioRangeOptions.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={cn("radar-range-option", value === option.value && "is-active")}
          key={option.label}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
