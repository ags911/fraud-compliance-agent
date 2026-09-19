import { ChevronRight } from 'lucide-react'
import { NodeCard } from '@/components/console/NodeCard'
import { NODE_ORDER } from '@/lib/types'
import type { AgentRunState } from '@/lib/useAgentRun'
import type { NodeName, NodeStatus } from '@/lib/types'

/**
 * Node status is derived purely from stream order — LangGraph's "updates"
 * stream mode only fires on node completion, so "running" means "the next
 * node in the fixed sequence, while a run is in flight", not a real
 * mid-execution signal from the backend.
 */
function statusFor(name: NodeName, index: number, run: AgentRunState): NodeStatus {
  if (run.events[name]) return 'done'
  if (run.status === 'idle') return 'pending'

  const firstUnseenIndex = NODE_ORDER.findIndex((n) => !run.events[n])
  if (run.status === 'running' && index === firstUnseenIndex) return 'running'

  // The run has finished (done/error) and this node never fired — that's
  // only possible for `counterfactual`, skipped on a full PASS outcome.
  if (run.status === 'done' && name === 'counterfactual') return 'skipped'
  return 'pending'
}

export function PipelineTimeline({ run, runId }: { run: AgentRunState; runId: string }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Pipeline
        </div>
        <div className="font-mono text-[11.5px] text-muted-foreground">run_id: {runId}</div>
      </div>
      {/* A horizontally scrollable region must be reachable by keyboard. */}
      <div role="region" aria-label="Pipeline stages" tabIndex={0} className="flex items-start gap-2.5 overflow-x-auto pb-1.5">
        {NODE_ORDER.map((name, index) => (
          <div key={name} className="flex items-start gap-2.5">
            <NodeCard name={name} status={statusFor(name, index, run)} event={run.events[name]} />
            {index < NODE_ORDER.length - 1 && (
              <ChevronRight className="mt-[100px] h-4.5 w-4.5 flex-none text-muted-foreground/50" />
            )}
          </div>
        ))}
      </div>
      {run.status === 'error' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {run.error}
        </div>
      )}
    </div>
  )
}
