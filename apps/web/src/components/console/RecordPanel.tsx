import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AgentRunState } from '@/lib/useAgentRun'
import type { SignedRecordSummary } from '@/lib/types'

type RecordTab = 'sim_a' | 'sim_b' | 'counterfactual'
const TAB_LABEL: Record<RecordTab, string> = { sim_a: 'Sim A', sim_b: 'Sim B', counterfactual: 'CF' }

export function RecordPanel({ run }: { run: AgentRunState }) {
  const [tab, setTab] = useState<RecordTab>('sim_a')
  const record = run.events[tab]?.record ?? null

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border bg-card p-4.5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Signed record
        </div>
        {record && <Badge variant="secondary" className="font-mono">{record.action_type}</Badge>}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as RecordTab)}>
        <TabsList className="w-full">
          {(['sim_a', 'sim_b', 'counterfactual'] as const).map((t) => (
            <TabsTrigger key={t} value={t} disabled={!run.events[t]}>
              {TAB_LABEL[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!record ? (
        <div className="py-8 text-center text-[12px] text-muted-foreground">
          No record yet — run the agent.
        </div>
      ) : (
        <RecordDetail record={record} />
      )}
    </div>
  )
}

function RecordDetail({ record }: { record: SignedRecordSummary }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5">
        <ShieldAlert className="h-4 w-4 flex-none text-warning" />
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-warning">Signature present</div>
          <div className="text-[10.5px] text-muted-foreground">
            Verification was not performed by this demo.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <KV k="schema_version" v={record.schema_version} mono />
        <KV k="agent_id" v={record.agent_id} mono wrap />
        <KV k="policy_reference" v={record.policy_reference.map((p) => p.version).join(', ')} mono />
        <KV k="oversight" v={record.human_oversight_status} mono />
        <KV k="record_hash" v={`${record.record_hash.slice(0, 12)}…`} mono />
        <KV k="verification" v={record.verification_status.replace('_', ' ')} mono />
      </div>
    </div>
  )
}

function KV({ k, v, mono, wrap }: { k: string; v: string; mono?: boolean; wrap?: boolean }) {
  return (
    <div className={`flex justify-between gap-2.5 text-[12px] ${wrap ? 'items-start' : 'items-center'}`}>
      <span className="flex-none text-muted-foreground">{k}</span>
      <span className={`text-right ${mono ? 'font-mono' : ''} ${wrap ? 'break-all' : 'truncate'}`}>{v}</span>
    </div>
  )
}
