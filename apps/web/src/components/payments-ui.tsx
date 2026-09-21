import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react"
import { useState } from "react"
import { format } from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Card } from "@/components/ui/card"
import { CountUpValue } from "@/components/count-up-value"
import {
  DemoSessionControl,
  DemoSessionProvider,
  type DemoScenarioId,
} from "@/components/demo-session"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function PaymentsAppShell({
  sidebar,
  children,
  className,
}: {
  sidebar: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <DemoSessionProvider>
        <SidebarProvider
          className={cn("payments-ui h-svh overflow-hidden", className)}
          data-payments-component="app-shell"
          style={{ "--sidebar-width": "240px" } as CSSProperties}
        >
          {sidebar}
          <SidebarInset className="overflow-y-auto">{children}</SidebarInset>
        </SidebarProvider>
      </DemoSessionProvider>
    </TooltipProvider>
  )
}

export function PaymentsPageMain({
  children,
  density = "comfortable",
}: {
  children: ReactNode
  density?: "comfortable" | "compact"
}) {
  return (
    <div className="payments-page-main" data-density={density}>
      {children}
    </div>
  )
}

export function PaymentsTopBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search transaction, customer, or review ID",
  searchLabel = searchPlaceholder,
  rightContent,
  demoSession = true,
  onDemoRun,
  onDemoSelectionChange,
  onDemoReset,
}: {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchLabel?: string
  rightContent?: ReactNode
  demoSession?: boolean
  onDemoRun?: (scenario: DemoScenarioId) => void
  onDemoSelectionChange?: () => void
  onDemoReset?: () => void
}) {
  const actions = demoSession || rightContent ? (
    <>
      {rightContent}
      {demoSession ? (
        <DemoSessionControl
          onRun={onDemoRun}
          onSelectionChange={onDemoSelectionChange}
          onReset={onDemoReset}
        />
      ) : null}
    </>
  ) : null

  return (
    <header
      className="payments-topbar"
      data-has-actions={Boolean(actions)}
      data-payments-component="topbar"
    >
      <div className="payments-topbar__inner">
        <div className="payments-topbar__leading">
          <div className="payments-topbar__navigation">
            <SidebarTrigger className="-ml-1.5 shrink-0 cursor-pointer text-muted-foreground transition-colors aria-expanded:bg-transparent! aria-expanded:hover:bg-muted! hover:bg-muted! hover:text-foreground" />
            <span
              className="payments-topbar__divider"
              data-payments-slot="topbar-divider"
              aria-hidden="true"
            />
          </div>
          <label
            className="payments-topbar__search"
            data-payments-slot="topbar-search"
          >
            <Search aria-hidden="true" strokeWidth={1.4} />
            <Input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchLabel}
            />
          </label>
        </div>
        {actions ? <div className="payments-topbar__actions">{actions}</div> : null}
      </div>
    </header>
  )
}

export function PaymentsPageHeading({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="payments-page-heading" data-payments-component="page-heading">
      <div className="payments-page-heading__copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? (
        <div className="payments-page-heading__actions">{actions}</div>
      ) : null}
    </header>
  )
}

export function PaymentsButton({
  emphasis,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  emphasis?: "primary"
}) {
  return (
    <button
      className={cn("payments-button", className)}
      data-emphasis={emphasis}
      data-payments-component="button"
      type="button"
      {...props}
    />
  )
}

export function PaymentsSubnav<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <nav
      aria-label={label}
      className="payments-subnav"
      data-payments-component="subnav"
    >
      {items.map((item) => (
        <button
          className="payments-subnav__item"
          key={item}
          type="button"
          aria-current={value === item ? "page" : undefined}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  )
}

export function PaymentsDateRange({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn("payments-date-range", className)}
      data-payments-component="date-range"
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}

function formatPaymentsDateRange(range: DateRange | undefined): string {
  if (!range?.from) return "Select dates"
  if (!range.to) return format(range.from, "d MMM yyyy")
  const sameYear = range.from.getFullYear() === range.to.getFullYear()
  const sameMonth = sameYear && range.from.getMonth() === range.to.getMonth()
  if (sameMonth) return `${format(range.from, "d")}–${format(range.to, "d MMM yyyy")}`
  if (sameYear) return `${format(range.from, "d MMM")}–${format(range.to, "d MMM yyyy")}`
  return `${format(range.from, "d MMM yyyy")}–${format(range.to, "d MMM yyyy")}`
}

export function PaymentsDateRangePicker({
  value,
  onChange,
  ariaLabel = "Reporting period",
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PaymentsDateRange aria-label={ariaLabel}>
          <CalendarDays aria-hidden="true" strokeWidth={1.3} />
          {formatPaymentsDateRange(value)}
        </PaymentsDateRange>
      </PopoverTrigger>
      <PopoverContent align="start" className="payments-type-body w-auto p-0">
        <Calendar
          className="payments-calendar"
          defaultMonth={value?.from}
          mode="range"
          numberOfMonths={2}
          onSelect={onChange}
          selected={value}
        />
      </PopoverContent>
    </Popover>
  )
}

export function PaymentsProgress({
  value,
  max = 100,
  ariaLabel,
  tone = "primary",
  className,
}: {
  value: number
  max?: number
  ariaLabel: string
  tone?: "primary" | "success" | "warning" | "danger"
  className?: string
}) {
  const safeMax = max > 0 ? max : 100
  const safeValue = Math.min(Math.max(value, 0), safeMax)
  const percentage = (safeValue / safeMax) * 100

  return (
    <div
      aria-label={ariaLabel}
      aria-valuemax={safeMax}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className={cn("payments-progress", className)}
      data-payments-component="progress"
      data-tone={tone}
      role="progressbar"
    >
      <span className="payments-progress__indicator" style={{ width: `${percentage}%` }} />
    </div>
  )
}

export type PaymentsKpi = {
  label: string
  value: string
}

export function PaymentsKpiStrip({
  items,
  compact = false,
  ariaLabel = "Performance summary",
}: {
  items: readonly PaymentsKpi[]
  compact?: boolean
  ariaLabel?: string
}) {
  return (
    <section
      className="payments-kpi-strip"
      data-density={compact ? "compact" : "comfortable"}
      data-payments-component="kpi-strip"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <div className="payments-kpi-strip__item" key={item.label}>
          <span className="payments-kpi-strip__label">{item.label}</span>
          <CountUpValue value={item.value} className="payments-kpi-strip__value" />
        </div>
      ))}
    </section>
  )
}

export function PaymentsPanel({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  labelledBy,
  id,
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  labelledBy?: string
  id?: string
}) {
  return (
    <Card
      className={cn("payments-panel", className)}
      id={id}
      aria-labelledby={labelledBy}
      data-payments-component="panel"
    >
      <header className="payments-panel__heading">
        <div>
          <h2 className="payments-panel__title" id={labelledBy}>
            {title}
          </h2>
          <p className="payments-panel__description">{description}</p>
        </div>
        {action}
      </header>
      <div className={cn("payments-panel__content", contentClassName)}>
        {children}
      </div>
    </Card>
  )
}

export function PaymentsRangeToggle<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      className="payments-range-toggle"
      role="group"
      aria-label={label}
      data-payments-component="range-toggle"
    >
      {options.map((option) => (
        <button
          className="payments-range-toggle__item"
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}D
        </button>
      ))}
    </div>
  )
}

export type PaymentsStatus =
  | "succeeded"
  | "disputed"
  | "failed"
  | "pending"
  | "blocked"
  | "refunded"
  | "fraudWarning"

const statusLabels: Record<PaymentsStatus, string> = {
  succeeded: "Succeeded",
  disputed: "Disputed",
  failed: "Failed",
  pending: "Refund pending",
  blocked: "Blocked",
  refunded: "Refunded",
  fraudWarning: "Early fraud warning",
}

const statusTones: Record<
  PaymentsStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  succeeded: "success",
  disputed: "warning",
  failed: "danger",
  pending: "neutral",
  blocked: "danger",
  refunded: "neutral",
  fraudWarning: "danger",
}

export function PaymentsStatusPill({ status }: { status: PaymentsStatus }) {
  return (
    <PaymentsTonePill tone={statusTones[status]}>
      {statusLabels[status]}
    </PaymentsTonePill>
  )
}

export function PaymentsTonePill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral"
  children: ReactNode
}) {
  return (
    <span
      className="payments-status-pill"
      data-payments-component="status-pill"
      data-tone={tone}
    >
      {children}
    </span>
  )
}

export function PaymentsStatePanel({
  title,
  description,
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string
  description: string
  tone?: "neutral" | "danger"
}) {
  return (
    <div
      className={cn("payments-state-panel", className)}
      data-tone={tone}
      data-payments-component="state-panel"
      {...props}
    >
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}

export function PaymentsTablePanel({
  children,
  footer,
  density = "comfortable",
  className,
}: {
  children: ReactNode
  footer?: ReactNode
  density?: "comfortable" | "compact"
  className?: string
}) {
  return (
    <div
      className={cn("payments-table-panel", className)}
      data-density={density}
      data-payments-component="table-panel"
    >
      {children}
      {footer ? <div className="payments-table-panel__footer">{footer}</div> : null}
    </div>
  )
}

export function PaymentsPagination({
  previousDisabled = false,
  nextDisabled = false,
  onPrevious,
  onNext,
}: {
  previousDisabled?: boolean
  nextDisabled?: boolean
  onPrevious?: () => void
  onNext?: () => void
}) {
  return (
    <div className="payments-pagination" data-payments-component="pagination">
      <button
        type="button"
        disabled={previousDisabled}
        onClick={onPrevious}
        aria-label="Previous page"
      >
        <ChevronLeft aria-hidden="true" size={16} />
      </button>
      <button
        type="button"
        disabled={nextDisabled}
        onClick={onNext}
        aria-label="Next page"
      >
        <ChevronRight aria-hidden="true" size={16} />
      </button>
    </div>
  )
}
