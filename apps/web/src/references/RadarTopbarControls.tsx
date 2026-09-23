import { useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// The same five scenario names the "Review blocked scenarios" table below
// already lists, deduplicated -- so picking one here reads as filtering that
// table, even though (like the table's own "Filter scenarios…" input) this
// reference page doesn't wire it up to anything live.
const scenarios = [
  {
    value: "botnet-velocity-drain",
    title: "Botnet Velocity Drain",
    description: "Coordinated non-human traffic bursts scored by the ML tier.",
  },
  {
    value: "legitimate-power-user",
    title: "Legitimate Power User",
    description: "High-volume genuine customers who still trip velocity heuristics.",
  },
  {
    value: "authorized-push-payment-scam",
    title: "Authorized Push Payment Scam",
    description: "Victim-authorized transfers coerced by a scammer, caught by the LLM tier.",
  },
  {
    value: "agentic-ai-buyer-token",
    title: "Agentic AI Buyer Token",
    description: "Autonomous purchasing agents authenticating with a delegated buyer token.",
  },
  {
    value: "model-outage-circuit-breaker",
    title: "Model Outage Circuit Breaker",
    description: "Fallback path triggered when a scoring engine is unavailable.",
  },
]

/**
 * Scenario select, mounted into radar-reference.html's topbar-actions. A
 * real shadcn Select, not the page's own hand-drawn markup -- themed to this
 * page's dark LCH palette via radar-controls-theme.css, the same
 * unlayered-reset padding fix pattern used elsewhere on this page.
 *
 * SelectValue is given explicit children (the selected scenario's title)
 * instead of relying on Radix's default behaviour of mirroring the matching
 * SelectItem's full rendered subtree into the trigger -- which here would
 * dump each option's description into the collapsed trigger too.
 */
export function RadarTopbarControls() {
  const [scenario, setScenario] = useState(scenarios[0].value)
  const selected = scenarios.find((item) => item.value === scenario)

  return (
    <Select value={scenario} onValueChange={setScenario}>
      <SelectTrigger size="sm" className="w-52 text-xs">
        <SelectValue>{selected?.title}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {scenarios.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <div className="flex flex-col gap-0.5 py-0.5">
              <span className="font-medium">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
