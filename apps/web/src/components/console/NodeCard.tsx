import { useState } from 'react'
import {
  BarChart3,
  ChevronRight,
  Database,
  Loader2,
  Package,
  ShieldAlert,
  MessageSquareQuote,
} from 'lucide-react'
import { OutcomeBadge } from '@/components/console/OutcomeBadge'
import { cn } from '@/lib/utils'
import type {
  CounterfactualResult,
  NodeName,
  NodeStatus,
  SimAResult,
  SimBResult,
  StreamEvent,
  TransactionFeatures,
} from '@/lib/types'

const NODE_META: Record<NodeName, { label: string; icon: typeof Database }> = {
  data_ingest: { label: 'Data Ingest', icon: Database },
  sim_a: { label: 'Sim A · Fraud Score', icon: BarChart3 },
  sim_b: { label: 'Sim B · APP Scam Risk', icon: ShieldAlert },
  counterfactual: { label: 'Counterfactual', icon: MessageSquareQuote },
  evidence_pack: { label: 'Evidence Pack', icon: Package },
}

const SIGNAL_LABELS: Record<string, string> = {
  amount: 'amount',
  cnp: 'cnp',
  foreign: 'foreign',
  category: 'category',
  velocity: 'velocity',
}
const SIGNAL_MAX: Record<string, number> = { amount: 40, cnp: 15, foreign: 15, category: 15, velocity: 15 }

export function NodeCard({ name, status, event }: { name: NodeName; status: NodeStatus; event?: StreamEvent }) {
  const meta = NODE_META[name]
  const Icon = meta.icon
  const isHoldish =
    (name === 'sim_a' && (event?.result?.sim_a as SimAResult | undefined)?.outcome === 'HOLD') ||
    (name === 'sim_b' && (event?.result?.sim_b as SimBResult | undefined)?.outcome !== 'PASS')

  return (
    <div
      className={cn(
        'flex min-h-[268px] w-52 flex-none flex-col gap-2.5 rounded-xl border bg-card p-3.5 transition-colors',
        (status === 'pending' || status === 'skipped') && 'border-dashed border-border/60 bg-muted/40',
        status === 'running' && 'border-primary/50 shadow-[0_0_0_3px_var(--color-primary)/12]',
        status === 'done' && isHoldish && 'border-hold/35',
        status === 'done' && !isHoldish && 'border-border',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-6.5 w-6.5 flex-none items-center justify-center rounded-md bg-secondary text-muted-foreground',
            status === 'running' && 'bg-primary/15 text-primary',
            status === 'done' && isHoldish && 'bg-hold-soft text-hold',
          )}
        >
          {status === 'running' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="text-xs leading-tight font-semibold">{meta.label}</div>
        <span
          className={cn(
            'ml-auto h-1.5 w-1.5 flex-none rounded-full',
            status === 'pending' && 'bg-muted-foreground/40',
            status === 'running' && 'animate-pulse bg-primary',
            status === 'done' && 'bg-pass',
          )}
        />
      </div>

      {status === 'pending' && (
        <div className="mt-auto text-[11px] text-muted-foreground">Waiting…</div>
      )}
      {status === 'skipped' && (
        <div className="mt-auto text-[11px] text-muted-foreground">
          Skipped — no HOLD/CHALLENGE to explain.
        </div>
      )}
      {status === 'running' && (
        <div className="animate-pulse text-[11px] text-primary">Running…</div>
      )}
      {status === 'done' && event && <NodeBody name={name} event={event} />}
    </div>
  )
}

function NodeBody({ name, event }: { name: NodeName; event: StreamEvent }) {
  switch (name) {
    case 'data_ingest':
      return <DataIngestBody transaction={event.result?.transaction as TransactionFeatures} />
    case 'sim_a':
      return <SimABody simA={event.result?.sim_a as SimAResult} />
    case 'sim_b':
      return <SimBBody simB={event.result?.sim_b as SimBResult} />
    case 'counterfactual':
      return <CounterfactualBody cf={event.result?.counterfactual as CounterfactualResult} />
    case 'evidence_pack':
      return <EvidencePackBody path={event.result?.evidence_pack_path as string | null} />
  }
}

function DataIngestBody({ transaction }: { transaction: TransactionFeatures }) {
  if (!transaction) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-muted-foreground">Features computed</div>
      <div className="h-px bg-border" />
      <dl className="flex flex-col gap-1.5 text-[10.5px] text-muted-foreground">
        <Row k="cold_start" v={String(transaction.cold_start)} />
        <Row k="avg_30d" v={transaction.avg_30d != null ? `£${transaction.avg_30d.toFixed(0)}` : 'n/a'} />
        <Row k="channel" v={transaction.payment_channel} />
      </dl>
    </div>
  )
}

function SimABody({ simA }: { simA: SimAResult }) {
  if (!simA) return null
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-bold">{simA.score}</span>
        <span className="text-[11px] text-muted-foreground">/100</span>
      </div>
      <OutcomeBadge outcome={simA.outcome} />
      <div className="flex flex-col gap-1.5">
        {Object.entries(simA.signal_breakdown).map(([key, value]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-12 flex-none text-[10px] text-muted-foreground">
              {SIGNAL_LABELS[key] ?? key}
            </span>
            <div className="h-1.25 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-hold"
                style={{ width: `${Math.min(100, (value / (SIGNAL_MAX[key] ?? (value || 1))) * 100)}%` }}
              />
            </div>
            <span className="w-5 flex-none text-right font-mono text-[10px] text-muted-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SimBBody({ simB }: { simB: SimBResult }) {
  if (!simB) return null
  return (
    <div className="flex flex-col gap-2.5">
      <OutcomeBadge outcome={simB.outcome} />
      <div className="text-[10.5px] text-muted-foreground">
        {simB.stage1_triggered
          ? `Stage 1 rule: ${simB.stage1_rule?.split('§').pop() ?? 'triggered'}`
          : simB.llm_error
            ? 'Stage 2 unavailable — fail-safe'
            : `Stage 2 · likelihood ${simB.llm_likelihood?.toFixed(2) ?? 'n/a'}`}
      </div>
      <div className="h-px bg-border" />
      <div className="mt-auto font-mono text-[10px] text-muted-foreground">
        model: {simB.model_provider ?? 'n/a'} · {simB.model_version ?? 'n/a'}
      </div>
    </div>
  )
}

function CounterfactualBody({ cf }: { cf: CounterfactualResult }) {
  const [expanded, setExpanded] = useState(false)
  if (!cf) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-muted-foreground">GDPR Art. 22</div>
      <div className="h-px bg-border" />
      <p className={cn('text-[11px] leading-relaxed text-muted-foreground', !expanded && 'line-clamp-4')}>
        “{cf.explanation}”
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-auto flex items-center gap-0.5 text-[11px] font-semibold text-primary"
      >
        {expanded ? 'Collapse' : 'Expand'}
        <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
      </button>
    </div>
  )
}

function EvidencePackBody({ path }: { path: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-muted-foreground">
        {path ? 'Pack assembled' : 'No records to pack'}
      </div>
      <div className="h-px bg-border" />
      {path && (
        <div className="truncate font-mono text-[10.5px] text-muted-foreground" title={path}>
          {path.split('/').pop()}
        </div>
      )}
      <div className="mt-auto flex gap-1.5">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">JSON</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">PDF</span>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt>
      <dd className="font-mono text-foreground/80">{v}</dd>
    </div>
  )
}
