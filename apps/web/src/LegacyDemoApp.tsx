import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { PipelineTimeline } from '@/components/console/PipelineTimeline'
import { RecordPanel } from '@/components/console/RecordPanel'
import { TransactionForm } from '@/components/console/TransactionForm'
import { fetchScenarios, useAgentRun } from '@/lib/useAgentRun'
import type { RunFormState, Scenario } from '@/lib/types'

function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [activePreset, setActivePreset] = useState<string | null>('A')
  const run = useAgentRun()

  useEffect(() => {
    fetchScenarios()
      .then(setScenarios)
      .catch(() => setScenarios([]))
  }, [])

  const handleRunPreset = (id: string, simulateLlmOutage: boolean) => {
    void run.runPreset(id, simulateLlmOutage)
  }
  const handleRunCustom = (form: RunFormState) => {
    void run.run(form)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-5 px-8 py-7">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12">
            <Bot className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight">Averlynx</div>
            <div className="font-mono text-[11.5px] text-muted-foreground">
              fraud_compliance_agent_v2 · AARF-0.2
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-pass" />
          {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8010'}
        </div>
      </header>

      <div className="grid grid-cols-[300px_1fr_330px] items-start gap-6">
        <TransactionForm
          scenarios={scenarios}
          activePreset={activePreset}
          onSelectPreset={setActivePreset}
          onRunPreset={handleRunPreset}
          onRunCustom={handleRunCustom}
          onCancel={run.cancel}
          isRunning={run.status === 'running'}
        />
        <PipelineTimeline run={run} runId={activePreset ?? 'custom'} />
        <RecordPanel run={run} />
      </div>
    </div>
  )
}

export default App
