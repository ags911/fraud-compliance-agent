import { cn } from "@/lib/utils"
import { scenarioRangeOptions, type ScenarioRange } from "@/lib/scenario-date-window"

type ConsoleRangeToggleProps = {
  value: ScenarioRange
  onChange: (range: ScenarioRange) => void
  label?: string
}

/** Segmented 7D / 30D / All control, styled by index.html's .console-range-* rules. */
export function ConsoleRangeToggle({ value, onChange, label = "Date range" }: ConsoleRangeToggleProps) {
  return (
    <div aria-label={label} className="console-range-toggle" role="group">
      {scenarioRangeOptions.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={cn("console-range-option", value === option.value && "is-active")}
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
