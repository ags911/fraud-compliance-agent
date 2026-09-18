import { useMemo, useState } from "react"
import { differenceInCalendarDays, format } from "date-fns"
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react"
import type { DateRange } from "react-day-picker"

import { AppSidebar } from "@/components/app-sidebar"
import { CountUpValue } from "@/components/count-up-value"
import type { PaymentStatus } from "@/components/payments"
import {
  RulesPerformanceChart,
  type RulesPerformanceDatum,
} from "@/components/rules-performance-chart"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"


const allData: RulesPerformanceDatum[] = [
  {
    date: "1 Sep",
    successful: 37,
    blocked: 8,
    refunded: 3,
    disputed: 2,
    fraudWarning: 1,
  },
  {
    date: "3 Sep",
    successful: 43,
    blocked: 9,
    refunded: 4,
    disputed: 1,
    fraudWarning: 2,
  },
  {
    date: "5 Sep",
    successful: 35,
    blocked: 7,
    refunded: 2,
    disputed: 3,
    fraudWarning: 1,
  },
  {
    date: "7 Sep",
    successful: 51,
    blocked: 10,
    refunded: 5,
    disputed: 2,
    fraudWarning: 2,
  },
  {
    date: "9 Sep",
    successful: 46,
    blocked: 11,
    refunded: 3,
    disputed: 1,
    fraudWarning: 2,
  },
  {
    date: "11 Sep",
    successful: 55,
    blocked: 9,
    refunded: 4,
    disputed: 3,
    fraudWarning: 1,
  },
  {
    date: "13 Sep",
    successful: 48,
    blocked: 12,
    refunded: 3,
    disputed: 2,
    fraudWarning: 2,
  },
  {
    date: "15 Sep",
    successful: 58,
    blocked: 10,
    refunded: 5,
    disputed: 1,
    fraudWarning: 1,
  },
  {
    date: "17 Sep",
    successful: 52,
    blocked: 11,
    refunded: 4,
    disputed: 2,
    fraudWarning: 3,
  },
  {
    date: "19 Sep",
    successful: 61,
    blocked: 9,
    refunded: 3,
    disputed: 2,
    fraudWarning: 1,
  },
  {
    date: "21 Sep",
    successful: 54,
    blocked: 12,
    refunded: 5,
    disputed: 3,
    fraudWarning: 2,
  },
  {
    date: "23 Sep",
    successful: 59,
    blocked: 10,
    refunded: 4,
    disputed: 2,
    fraudWarning: 2,
  },
]

const kpis = [
  { label: "Matching payments", value: "3,424" },
  { label: "Success rate", value: "93.5%" },
  { label: "Failed & blocked", value: "6.8%" },
  { label: "Early warnings", value: "18" },
] as const

const subnavTabs = ["Overview", "Performance", "Lists", "Activity"] as const

const payments: Array<{
  amount: string
  status: PaymentStatus
  customer: string
  date: string
}> = [
  {
    amount: "£141.00 GBP",
    status: "disputed",
    customer: "cus_JF019FNas284NF",
    date: "Today, 09:54",
  },
  {
    amount: "£84.20 GBP",
    status: "succeeded",
    customer: "cus_NAQk8Q825nadfh",
    date: "Today, 09:41",
  },
  {
    amount: "£62.00 GBP",
    status: "fraudWarning",
    customer: "cus_mxbOQJE25T7nzkN",
    date: "Today, 09:18",
  },
  {
    amount: "£11.00 GBP",
    status: "pending",
    customer: "cus_fgbs8152ABSbf46",
    date: "Today, 08:57",
  },
]

const statusLabels: Record<PaymentStatus, string> = {
  succeeded: "Succeeded",
  disputed: "Disputed",
  failed: "Failed",
  pending: "Refund pending",
  blocked: "Blocked",
  refunded: "Refunded",
  fraudWarning: "Early fraud warning",
}

const statusTones: Record<PaymentStatus, string> = {
  succeeded: "bg-[#e5f7ec] text-[#087f45]",
  disputed: "bg-[#fff2cc] text-[#946000]",
  failed: "bg-[#ffedf1] text-[#c93451]",
  pending: "bg-[#f0ebff] text-[#5543cd]",
  blocked: "bg-[#ffedf1] text-[#c93451]",
  refunded: "bg-[#f0ebff] text-[#5543cd]",
  fraudWarning: "bg-[#ffedf1] text-[#c93451]",
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 payments-type-status",
        statusTones[status],
      )}
    >
      {statusLabels[status]}
    </span>
  )
}

type RangeOption = 7 | 30 | 90
const rangeOptions: RangeOption[] = [7, 30, 90]
// Concrete date bounds for the chart's 7D/30D/90D quick-select — the
// calendar dropdown and the chart toggle share one `dateRange` value, so
// picking a preset needs a real DateRange, not just a label string.
const presetRanges: Record<RangeOption, DateRange> = {
  7: { from: new Date(2026, 8, 17), to: new Date(2026, 8, 23) },
  30: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 23) },
  90: { from: new Date(2026, 5, 26), to: new Date(2026, 8, 23) },
}

function formatDateRange(range: DateRange | undefined): string {
  if (!range?.from) return "Select dates"
  if (!range.to) return format(range.from, "d MMM yyyy")
  const sameYear = range.from.getFullYear() === range.to.getFullYear()
  const sameMonth = sameYear && range.from.getMonth() === range.to.getMonth()
  if (sameMonth)
    return `${format(range.from, "d")}–${format(range.to, "d MMM yyyy")}`
  if (sameYear)
    return `${format(range.from, "d MMM")}–${format(range.to, "d MMM yyyy")}`
  return `${format(range.from, "d MMM yyyy")}–${format(range.to, "d MMM yyyy")}`
}

// When a custom range is picked in the calendar (rather than one of the
// three quick-select presets), the chart still needs *some* preset to
// render — snap to whichever preset's day-span is closest.
function nearestPreset(range: DateRange): RangeOption {
  if (!range.from || !range.to) return 30
  const days = differenceInCalendarDays(range.to, range.from) + 1
  return rangeOptions.reduce((best, option) =>
    Math.abs(option - days) < Math.abs(best - days) ? option : best,
  )
}

function visibleData(range: RangeOption): RulesPerformanceDatum[] {
  if (range === 7) return allData.slice(-4)
  if (range === 90) {
    return allData.map((item, index) => ({
      ...item,
      date: index % 2 === 0 ? item.date.replace("Sep", "Aug") : item.date,
    }))
  }
  return allData
}

const focusRing =
  "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(99,91,255,0.32)]"

export type TableState = "data" | "loading" | "empty" | "error"

export default function RulesPerformanceReference({
  density = "comfortable",
  showSidebar = true,
  tableState = "data",
}: {
  density?: "comfortable" | "compact"
  showSidebar?: boolean
  tableState?: TableState
}) {
  const compact = density === "compact"
  // Single source of truth for the reporting period — the calendar
  // dropdown and the chart's own 7D/30D/90D toggle both read and write
  // this, so they can never drift out of sync with each other.
  const [activeRange, setActiveRange] = useState<RangeOption>(30)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    presetRanges[30],
  )
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [activeTab, setActiveTab] =
    useState<(typeof subnavTabs)[number]>("Performance")
  const data = useMemo(() => visibleData(activeRange), [activeRange])

  function applyPreset(range: RangeOption) {
    setActiveRange(range)
    setDateRange(presetRanges[range])
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    setDateRange(range)
    if (range?.from && range?.to) setActiveRange(nearestPreset(range))
    // Not auto-closing the popover here: react-day-picker's range mode
    // re-anchors an *existing* complete range to whichever day you click
    // next (shrinking/extending it), so the very first click after
    // opening with a pre-filled range always yields another complete
    // range — there's no reliable way to tell "first click of a new
    // pick" from "nudging one edge of the current range." Radix
    // Popover's own outside-click/Escape dismissal handles closing.
  }

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider
        // h-svh + overflow-hidden pins the whole shell to exactly one
        // viewport tall — without overflow-hidden, content taller than the
        // viewport (this page's chart+table easily are) would grow the
        // *page* instead, and since the sidebar's own height is capped at
        // h-svh, that extra content would render below it with no sidebar
        // next to it at all. SidebarInset scrolls internally instead (see
        // its className below), matching Stripe's own fixed-sidebar shell.
        // The desktop icon-collapsible sidebar's actual width now comes
        // from AppSidebar's own widthPx/iconWidthPx (see app-sidebar.tsx) —
        // this --sidebar-width var only still matters for the mobile Sheet
        // fallback and isn't read by the icon-collapsible motion.div path.
        className="payments-ui h-svh overflow-hidden"
      >
        {showSidebar ? <AppSidebar /> : null}
        <SidebarInset className="overflow-y-auto">
          <div className="border-b border-[#e3e8ee] bg-background">
            <div className="mx-auto flex h-14 max-w-[1280px] items-center px-[34px] max-[760px]:px-[14px]">
              {showSidebar ? (
                <div className="mr-3 flex shrink-0 items-center gap-1.5">
                  <SidebarTrigger className="-ml-1.5 shrink-0 cursor-pointer text-muted-foreground transition-colors aria-expanded:bg-transparent! aria-expanded:hover:bg-muted! hover:bg-muted! hover:text-foreground" />
                  <span
                    data-payments-slot="topbar-divider"
                    className="h-5 w-px shrink-0 bg-[#e3e8ee]"
                    aria-hidden="true"
                  />
                </div>
              ) : null}
              <div
                data-payments-slot="topbar-search"
                className="flex h-9 min-w-0 w-[380px] max-w-full items-center gap-2 rounded-[10px] border border-[#e3e8ee] bg-background px-3 focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[rgba(99,91,255,0.32)] max-[760px]:w-full"
              >
                <Search
                  className="size-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={1.4}
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder="Search transaction, customer, or review ID"
                  aria-label="Search transaction, customer, or review ID"
                  className="h-auto border-0 bg-transparent p-0 payments-type-input shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          <main
            className={cn(
              "mx-auto w-full max-w-[1280px] px-[34px] pb-11 max-[760px]:px-[14px] max-[760px]:pb-[34px]",
              compact ? "pt-5" : "pt-7",
            )}
          >
            <div className="mb-[22px] flex items-start justify-between gap-[18px] max-[760px]:block">
              <div className="min-w-0">
                <h1 className="payments-type-page-title">
                  Rules performance
                </h1>
                <p className="mt-[7px] overflow-hidden payments-type-body whitespace-nowrap text-ellipsis text-muted-foreground">
                  Monitor payment outcomes, identify changes in rule behavior,
                  and inspect the transactions behind them.
                </p>
              </div>
              <div className="flex shrink-0 gap-2 max-[760px]:mt-[15px]">
                <button
                  type="button"
                  className={cn(
                    "h-[34px] cursor-pointer rounded-[8px] border border-[#e3e8ee] bg-background px-3 payments-type-control",
                    focusRing,
                  )}
                >
                  Select rules
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-[34px] cursor-pointer rounded-[8px] border border-primary bg-primary px-3 payments-type-control text-primary-foreground",
                    focusRing,
                  )}
                >
                  Create rule
                </button>
              </div>
            </div>

            <nav
              aria-label="Rules navigation"
              className="mb-[22px] flex h-11 items-center gap-0.5 overflow-x-auto overflow-y-hidden border-b border-[#e3e8ee] bg-background"
            >
              {subnavTabs.map((tab, index) => {
                const isActive = activeTab === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "relative h-11 shrink-0 cursor-pointer rounded-none px-3 payments-type-navigation",
                      focusRing,
                      index === 0 && "-ml-3",
                      isActive
                        ? "text-[#5543cd] font-semibold after:absolute after:right-2 after:bottom-0 after:left-2 after:h-0.5 after:bg-primary after:content-['']"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {tab}
                  </button>
                )
              })}
            </nav>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Reporting period"
                  className={cn(
                    "mb-[18px] inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#e3e8ee] bg-background px-3 payments-type-date-filter tabular-nums hover:bg-muted",
                    focusRing,
                  )}
                >
                  <CalendarIcon
                    className="size-3.5 text-muted-foreground"
                    strokeWidth={1.3}
                    aria-hidden="true"
                  />
                  {formatDateRange(dateRange)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="payments-type-body w-auto p-0" align="start">
                <Calendar
                  className="payments-calendar"
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <section
              aria-label="Rule performance summary"
              className="mb-[18px] grid grid-cols-4 overflow-hidden rounded-[12px] border border-[#e3e8ee] bg-background max-[760px]:grid-cols-2"
            >
              {kpis.map((kpi, index) => (
                <div
                  key={kpi.label}
                  className={cn(
                    "border-r border-[#e3e8ee] px-[17px] max-[760px]:nth-2:border-r-0 max-[760px]:nth-[-n+2]:border-b",
                    compact ? "py-[11px]" : "py-[15px]",
                    index === kpis.length - 1 && "border-r-0",
                  )}
                >
                  <span className="block payments-type-metric-label text-muted-foreground">
                    {kpi.label}
                  </span>
                  <CountUpValue
                    value={kpi.value}
                    className="mt-[5px] block payments-type-metric-value"
                  />
                </div>
              ))}
            </section>

            <RulesPerformanceChart
              className="mb-[18px] rounded-[12px] border border-[#e3e8ee] shadow-none"
              data={data}
              matchingPayments={3424}
              title="Payment outcomes"
              description="Payment volume by outcome, GBP"
              activeRange={activeRange}
              onRangeChange={applyPreset}
              compact={compact}
            />

            <div className="overflow-hidden rounded-[12px] border border-[#e3e8ee]">
              <div className="border-b border-[#e3e8ee] px-[18px] py-[17px] max-[760px]:block">
                <h2 className="payments-type-section-title">Matching payments</h2>
                <p className="mt-[5px] payments-type-support text-muted-foreground">
                  Transactions influenced by the selected rules and date range
                </p>
              </div>

              {tableState === "loading" ? (
                <div aria-label="Loading matching payments">
                  {[0, 1, 2, 3].map((row) => (
                    <div
                      key={row}
                      className={cn(
                        "border-b border-[#eef1f4] bg-[linear-gradient(90deg,#f6f8fa_25%,#eef1f4_45%,#f6f8fa_65%)] bg-[length:220%_100%] motion-safe:animate-[fc-shimmer_1.4s_ease-in-out_infinite]",
                        compact ? "h-[41px]" : "h-[49px]",
                      )}
                    />
                  ))}
                </div>
              ) : tableState === "empty" ? (
                <div className="grid min-h-[210px] place-items-center p-8 text-center payments-type-state-body text-muted-foreground">
                  <div>
                    <strong className="text-foreground">
                      No matching payments
                    </strong>
                    <br />
                    <span>
                      Try widening the date range or selecting another rule.
                    </span>
                  </div>
                </div>
              ) : tableState === "error" ? (
                <div className="grid min-h-[210px] place-items-center p-8 text-center payments-type-state-body text-muted-foreground">
                  <div>
                    <strong className="inline-flex items-center gap-1.5 text-destructive">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      Payments could not be loaded
                    </strong>
                    <br />
                    <span>Retry the request or return later.</span>
                  </div>
                </div>
              ) : (
                <div >
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#e3e8ee] hover:bg-transparent">
                        <TableHead className="h-[38px] px-[15px] payments-type-table-header text-muted-foreground">
                          AMOUNT
                        </TableHead>
                        <TableHead className="h-[38px] px-[15px] payments-type-table-header text-muted-foreground">
                          STATUS
                        </TableHead>
                        <TableHead className="h-[38px] px-[15px] payments-type-table-header text-muted-foreground">
                          CUSTOMER
                        </TableHead>
                        <TableHead className="h-[38px] px-[15px] payments-type-table-header text-muted-foreground">
                          DATE
                        </TableHead>
                        <TableHead className="h-[38px] px-[15px] text-right payments-type-table-header text-muted-foreground">
                          <span aria-hidden="true">ACTIONS</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow
                          key={payment.customer}
                          className="border-[#eef1f4] hover:bg-[#fbfcfd]"
                        >
                          <TableCell
                            className={cn(
                              "px-[15px] payments-type-data payments-type-strong",
                              compact ? "h-[41px]" : "h-[49px]",
                            )}
                          >
                            {payment.amount}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "px-[15px]",
                              compact ? "h-[41px]" : "h-[49px]",
                            )}
                          >
                            <PaymentStatusBadge status={payment.status} />
                          </TableCell>
                          <TableCell
                            className={cn(
                              "px-[15px] payments-type-identifier text-[#425466]",
                              compact ? "h-[41px]" : "h-[49px]",
                            )}
                          >
                            {payment.customer}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "px-[15px] payments-type-data text-muted-foreground",
                              compact ? "h-[41px]" : "h-[49px]",
                            )}
                          >
                            {payment.date}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "px-[15px] text-right",
                              compact ? "h-[41px]" : "h-[49px]",
                            )}
                          >
                            <button
                              type="button"
                              aria-label={`Open payment ${payment.customer}`}
                              className="cursor-pointer rounded-[6px] px-[7px] py-[5px] payments-type-data text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              •••
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex h-[46px] items-center justify-between border-t border-[#e3e8ee] px-[15px] payments-type-data-support text-muted-foreground">
                    <span>1–4 of 3,424 payments</span>
                    <div className="flex items-center gap-[5px]">
                      <button
                        type="button"
                        disabled
                        aria-label="Previous page"
                        className="flex size-7 items-center justify-center rounded-[8px] border border-[#e3e8ee] bg-background disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next page"
                        className="flex size-7 cursor-pointer items-center justify-center rounded-[8px] border border-[#e3e8ee] bg-background"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
