import type { ReactNode } from "react"
import { cva } from "class-variance-authority"

import { Badge } from "@/components/ui/badge"
import { Card, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const statusVariants = cva("border-transparent", {
  variants: {
    status: {
      succeeded: "bg-success-soft text-success",
      disputed: "bg-warning-soft text-warning",
      failed: "bg-danger-soft text-destructive",
      pending: "bg-secondary text-secondary-foreground",
      blocked: "bg-chart-blocked/15 text-foreground",
      refunded: "bg-chart-refunded/10 text-chart-refunded",
      fraudWarning: "bg-chart-fraud-warning/15 text-foreground",
    },
  },
})

export type PaymentStatus =
  | "succeeded"
  | "disputed"
  | "failed"
  | "pending"
  | "blocked"
  | "refunded"
  | "fraudWarning"

const statusLabels: Record<PaymentStatus, string> = {
  succeeded: "Succeeded",
  disputed: "Disputed",
  failed: "Failed",
  pending: "Refund pending",
  blocked: "Blocked",
  refunded: "Refunded",
  fraudWarning: "Early fraud warning",
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge className={statusVariants({ status })}>{statusLabels[status]}</Badge>
  )
}

export function PaymentMethodChip({ children }: { children: ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>
}

export function RuleToken({ children }: { children: ReactNode }) {
  return (
    <Badge className="border-transparent bg-accent text-accent-foreground">
      {children}
    </Badge>
  )
}

export function MetricCard({
  label,
  value,
  delta,
  favorable,
  selected,
  onSelect,
}: {
  label: string
  value: string
  delta: string
  favorable: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="w-full rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className={cn(selected && "ring-2 ring-primary")}>
        <CardHeader>
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-medium tabular-nums">{value}</span>
            <span
              className={cn(
                "text-xs",
                favorable ? "text-success" : "text-destructive"
              )}
            >
              {delta}
            </span>
          </span>
        </CardHeader>
      </Card>
    </button>
  )
}

export function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-5 border-b py-8 last:border-b-0">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
