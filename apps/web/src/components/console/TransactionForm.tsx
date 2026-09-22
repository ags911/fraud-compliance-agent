import { useState } from 'react'
import { Play, Square, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { RunFormState, Scenario } from '@/lib/types'

const DEFAULT_FORM: RunFormState = {
  amount: 4200,
  payment_channel: 'online',
  country: 'US',
  personal_finance_category: 'TRANSFER_OUT',
  velocity_6h: 3,
  first_seen_payee: false,
  account_balance: 5000,
  account_balance_pct_remaining: 0.16,
  inbound_credit_within_2h: false,
  // The vendor's fixed counterfactual formats a 30-day average for a HOLD.
  // Keep that baseline explicit and synthetic instead of relying on an absent
  // customer-history value.
  history: Array.from({ length: 10 }, () => ({ amount: 210 })),
  simulate_llm_outage: false,
}

const CATEGORIES = ['TRANSFER_OUT', 'LOAN_PAYMENTS', 'TRAVEL', 'FOOD_AND_DRINK', 'GENERAL_MERCHANDISE', 'OTHER']

export function TransactionForm({
  scenarios,
  activePreset,
  onSelectPreset,
  onRunPreset,
  onRunCustom,
  onCancel,
  isRunning,
}: {
  scenarios: Scenario[]
  activePreset: string | null
  onSelectPreset: (id: string | null) => void
  onRunPreset: (id: string, simulateLlmOutage: boolean) => void
  onRunCustom: (form: RunFormState) => void
  onCancel: () => void
  isRunning: boolean
}) {
  const [form, setForm] = useState<RunFormState>(DEFAULT_FORM)

  const update = <K extends keyof RunFormState>(key: K, value: RunFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleRun = () => {
    if (activePreset) {
      onRunPreset(activePreset, form.simulate_llm_outage)
    } else {
      onRunCustom(form)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4.5">
      <div>
        <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Presets
        </div>
        <div className="flex flex-col gap-1.5">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelectPreset(scenario.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12.5px] transition-colors',
                activePreset === scenario.id
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary',
              )}
            >
              <span
                className={cn(
                  'flex h-5.5 w-5.5 flex-none items-center justify-center rounded-md font-mono text-[11px] font-semibold',
                  activePreset === scenario.id ? 'bg-primary text-primary-foreground' : 'bg-secondary',
                )}
              >
                {scenario.id}
              </span>
              <span className="truncate">{scenario.label.replace(/^Scenario \S+ — /, '')}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSelectPreset(null)}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-2 text-left text-[12.5px] transition-colors',
              activePreset === null
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary',
            )}
          >
            <span className="flex h-5.5 w-5.5 flex-none items-center justify-center rounded-md bg-secondary text-[13px]">
              +
            </span>
            <span>Custom transaction</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-border" />

      <fieldset disabled={activePreset != null} className="flex flex-col gap-3 disabled:opacity-100">
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Transaction
        </div>
        <Field label="Amount (£)">
          <Input
            aria-label="Amount (£)"
            type="number"
            value={form.amount}
            onChange={(e) => update('amount', Number(e.target.value))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Channel">
            <Select value={form.payment_channel} onValueChange={(v) => update('payment_channel', v as RunFormState['payment_channel'])}>
              <SelectTrigger aria-label="Channel" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online">online</SelectItem>
                <SelectItem value="in store">in store</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country">
            <Input aria-label="Country" value={form.country} onChange={(e) => update('country', e.target.value)} />
          </Field>
        </div>
        <Field label="Category">
          <Select value={form.personal_finance_category} onValueChange={(v) => update('personal_finance_category', v)}>
            <SelectTrigger aria-label="Category" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Velocity (6h)">
            <Input
              aria-label="Velocity (6h)"
              type="number"
              value={form.velocity_6h}
              onChange={(e) => update('velocity_6h', Number(e.target.value))}
            />
          </Field>
          <Field label="Balance remaining">
            <Input
              aria-label="Balance remaining"
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={form.account_balance_pct_remaining}
              onChange={(e) => update('account_balance_pct_remaining', Number(e.target.value))}
            />
          </Field>
        </div>
        <ToggleRow label="First-seen payee" checked={form.first_seen_payee} onChange={(v) => update('first_seen_payee', v)} />
        <ToggleRow label="Inbound credit <2h" checked={form.inbound_credit_within_2h} onChange={(v) => update('inbound_credit_within_2h', v)} />
        <p className="rounded-md bg-muted px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Synthetic 30-day baseline: 10 prior demo transactions averaging £210. This is used only to explain this simulated trace.
        </p>
      </fieldset>

      <div className="h-px bg-border" />

      <div className="flex items-start justify-between gap-2.5 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5">
        <div className="flex gap-2">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-destructive/80" />
          <div>
            <div className="text-[12.5px] font-semibold text-destructive">Simulate LLM outage</div>
            <div className="mt-0.5 max-w-44 text-[11px] text-muted-foreground">
              Forces Stage 2 to fail — watch the fail-safe HOLD trigger live.
            </div>
          </div>
        </div>
        <Switch
          aria-label="Simulate LLM outage"
          checked={form.simulate_llm_outage}
          onCheckedChange={(v) => update('simulate_llm_outage', v)}
          className="mt-0.5 data-checked:bg-destructive"
        />
      </div>

      <Button
        onClick={isRunning ? onCancel : handleRun}
        variant={isRunning ? 'outline' : 'default'}
        className="w-full gap-1.5 font-semibold"
      >
        {isRunning ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {isRunning ? 'Cancel run' : 'Run agent'}
      </Button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.25">
      <Label className="text-[11.5px] font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
