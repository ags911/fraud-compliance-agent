import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, ChevronDown, Play, RotateCcw } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type DemoScenarioId = "portfolio" | "trusted" | "new-device" | "velocity"

export const demoScenarios: ReadonlyArray<{
  id: DemoScenarioId
  label: string
  description: string
  focus: string
}> = [
  {
    id: "portfolio",
    label: "Mixed 30-day portfolio",
    description: "Populate the dashboard with a representative decision mix.",
    focus: "Portfolio walkthrough",
  },
  {
    id: "trusted",
    label: "Trusted returning customer",
    description: "An established customer with low-risk payment signals.",
    focus: "Trusted customer path",
  },
  {
    id: "new-device",
    label: "New-device purchase",
    description: "A new device requires additional verification.",
    focus: "Additional verification",
  },
  {
    id: "velocity",
    label: "High-velocity transfer",
    description: "Fast, high-value activity tests velocity controls.",
    focus: "Velocity controls",
  },
]

type DemoSessionState = {
  selectedScenario: DemoScenarioId | null
  activeScenario: DemoScenarioId | null
}

type DemoSessionContextValue = DemoSessionState & {
  selectScenario: (scenario: DemoScenarioId) => void
  runScenario: () => void
  resetScenario: () => void
}

const storageKey = "kepler-demo-session"
const DemoSessionContext = createContext<DemoSessionContextValue | null>(null)

function readStoredSession(): DemoSessionState {
  if (typeof window === "undefined") {
    return { selectedScenario: null, activeScenario: null }
  }

  try {
    const stored = window.sessionStorage.getItem(storageKey)
    if (!stored) return { selectedScenario: null, activeScenario: null }
    const parsed = JSON.parse(stored) as Partial<DemoSessionState>
    const validScenario = (value: unknown): value is DemoScenarioId =>
      demoScenarios.some((scenario) => scenario.id === value)
    return {
      selectedScenario: validScenario(parsed.selectedScenario) ? parsed.selectedScenario : null,
      activeScenario: validScenario(parsed.activeScenario) ? parsed.activeScenario : null,
    }
  } catch {
    return { selectedScenario: null, activeScenario: null }
  }
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSessionState>(readStoredSession)

  useEffect(() => {
    window.sessionStorage.setItem(storageKey, JSON.stringify(session))
  }, [session])

  const value = useMemo<DemoSessionContextValue>(() => ({
    ...session,
    selectScenario: (scenario) => setSession({ selectedScenario: scenario, activeScenario: null }),
    runScenario: () => setSession((current) => current.selectedScenario
      ? { ...current, activeScenario: current.selectedScenario }
      : current),
    resetScenario: () => setSession({ selectedScenario: null, activeScenario: null }),
  }), [session])

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>
}

export function useDemoSession() {
  const context = useContext(DemoSessionContext)
  if (!context) throw new Error("useDemoSession must be used within DemoSessionProvider")
  return context
}

export function DemoSessionControl({
  onRun,
  onSelectionChange,
  onReset,
}: {
  onRun?: (scenario: DemoScenarioId) => void
  onSelectionChange?: () => void
  onReset?: () => void
}) {
  const {
    selectedScenario,
    activeScenario,
    selectScenario,
    runScenario,
    resetScenario,
  } = useDemoSession()
  const [open, setOpen] = useState(false)
  const selected = demoScenarios.find((scenario) => scenario.id === selectedScenario)

  function handleSelection(scenario: DemoScenarioId) {
    selectScenario(scenario)
    onSelectionChange?.()
    setOpen(false)
  }

  function handleRun() {
    if (!selectedScenario) return
    runScenario()
    onRun?.(selectedScenario)
  }

  function handleReset() {
    resetScenario()
    onReset?.()
  }

  return (
    <div
      className="payments-demo-session"
      data-active={Boolean(activeScenario)}
      data-stage={activeScenario ? "complete" : selectedScenario ? "ready" : "start"}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="payments-demo-session__trigger" id="payments-demo-scenario-trigger" type="button">
            <span>{selected ? `Demo: ${selected.label}` : "Select demo scenario"}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="payments-demo-session__picker">
          <div className="payments-demo-session__heading">
            <strong>Demo scenarios</strong>
            <p>Select a realistic payment path. Running it keeps the same context across the demo.</p>
          </div>
          <div className="payments-demo-session__list" role="radiogroup" aria-label="Demo scenarios">
            {demoScenarios.map((scenario) => (
              <button
                aria-checked={selectedScenario === scenario.id}
                className="payments-demo-session__card"
                key={scenario.id}
                onClick={() => handleSelection(scenario.id)}
                role="radio"
                type="button"
              >
                <span className="payments-demo-session__indicator" aria-hidden="true">
                  {selectedScenario === scenario.id ? <Check size={12} /> : null}
                </span>
                <span className="payments-demo-session__copy">
                  <strong>{scenario.label}</strong>
                  <span>{scenario.description}</span>
                  <small>{scenario.focus}</small>
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <button
        className="payments-demo-session__run"
        disabled={!selectedScenario}
        id="payments-demo-run"
        onClick={handleRun}
        type="button"
      >
        <Play aria-hidden="true" size={12} fill="currentColor" />
        Run
      </button>
      {activeScenario ? (
        <button
          className="payments-demo-session__reset"
          onClick={handleReset}
          type="button"
          title="Reset the demo and return all values to zero"
          aria-label="Reset demo and return all values to zero"
        >
          <RotateCcw aria-hidden="true" size={13} />
          <span>Reset</span>
        </button>
      ) : null}
    </div>
  )
}
