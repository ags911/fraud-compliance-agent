import { useEffect, useState } from "react"
import { CircleHelp, CirclePlay, ShieldCheck } from "lucide-react"

import { PipelineTimeline } from "@/components/console/PipelineTimeline"
import { RecordPanel } from "@/components/console/RecordPanel"
import { TransactionForm } from "@/components/console/TransactionForm"
import {
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsPanel,
  PaymentsStatePanel,
  PaymentsTopBar,
} from "@/components/payments-ui"
import { SectionTabs } from "@/components/section-tabs"
import { fetchScenarios, useAgentRun } from "@/lib/useAgentRun"
import { useDecisionWorkspaceTour } from "@/lib/useDecisionWorkspaceTour"
import type { RunFormState, Scenario } from "@/lib/types"

/**
 * A read-only, deterministic demonstration of the agent pipeline.
 * It deliberately exposes the trace and signed record without suggesting that
 * the result can approve, release, or otherwise execute a payment.
 */
export function NewTransactionPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scenarioLoadFailed, setScenarioLoadFailed] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>("A")
  const run = useAgentRun()
  const tour = useDecisionWorkspaceTour()

  useEffect(() => {
    let active = true
    fetchScenarios()
      .then((response) => {
        if (active) setScenarios(response)
      })
      .catch(() => {
        if (active) setScenarioLoadFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  function handleRunPreset(id: string, simulateLlmOutage: boolean) {
    void run.runPreset(id, simulateLlmOutage)
  }

  function handleRunCustom(form: RunFormState) {
    void run.run(form)
  }

  return (
    <>
      <PaymentsTopBar demoSession={false} searchPlaceholder="Search is unavailable while running a demo scenario" showSidebarTrigger={false} />
      <PaymentsPageMain>
        <PaymentsPageHeading
          title="Analyse a transaction"
          description="Select a simulated payment path, run the deterministic decision trace, then inspect its signed audit record."
          actions={<button className="payments-button" type="button" onClick={tour.start}><CircleHelp aria-hidden="true" size={16} strokeWidth={1.6} />Tour this workspace</button>}
        />
        <SectionTabs />
        {scenarioLoadFailed ? (
          <PaymentsStatePanel
            title="Demo scenarios unavailable"
            description="Start the local demo API to load presets and run a decision trace."
            tone="danger"
            className="mt-6"
          />
        ) : (
          <>
            <section className="mt-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4" aria-label="Demo decision boundary">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 shrink-0 text-primary" aria-hidden="true" size={18} strokeWidth={1.6} />
                <div>
                  <strong className="payments-type-section-title">Simulated decision trace</strong>
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">This portfolio flow demonstrates controls, explanations, and an audit record. It cannot approve, release, or execute a payment.</p>
                </div>
              </div>
              <span className="payments-type-support whitespace-nowrap text-muted-foreground">Demo data only</span>
            </section>
            <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
              <aside id="decision-scenario-controls" aria-label="Scenario and transaction controls">
                <TransactionForm
                  scenarios={scenarios}
                  activePreset={activePreset}
                  onSelectPreset={setActivePreset}
                  onRunPreset={handleRunPreset}
                  onRunCustom={handleRunCustom}
                  onCancel={run.cancel}
                  isRunning={run.status === "running"}
                />
              </aside>
              <PaymentsPanel
                id="decision-trace"
                title="Decision trace"
                description="Controls run in order. Each stage remains inspectable after the simulated outcome is returned."
              >
                <PipelineTimeline run={run} runId={activePreset ?? "custom"} />
              </PaymentsPanel>
              <aside id="decision-record" aria-label="Signed audit record">
                <RecordPanel run={run} />
              </aside>
            </div>
            {run.status === "idle" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <CirclePlay aria-hidden="true" size={16} strokeWidth={1.6} />
                Choose a preset on the left, then select Run agent to begin.
              </div>
            ) : null}
            {run.status === "cancelled" ? (
              <div className="text-sm text-muted-foreground" role="status">
                Demo run cancelled. No completed outcome is being reported.
              </div>
            ) : null}
          </>
        )}
      </PaymentsPageMain>
    </>
  )
}
