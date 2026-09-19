import { useState } from "react"
import { ArrowRight, CircleHelp, Play, ShieldCheck, X } from "lucide-react"
import { Dialog } from "radix-ui"
import type { DateRange } from "react-day-picker"

import { AppSidebar } from "@/components/app-sidebar"
import {
  demoScenarios,
  type DemoScenarioId,
  useDemoSession,
} from "@/components/demo-session"
import {
  PaymentsAppShell,
  PaymentsDateRangePicker,
  PaymentsKpiStrip,
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsPanel,
  PaymentsProgress,
  PaymentsTablePanel,
  PaymentsTonePill,
  PaymentsTopBar,
} from "@/components/payments-ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useOverviewTour } from "@/lib/useOverviewTour"

type Route = "PASS" | "CHALLENGE" | "HOLD"

type Decision = {
  id: string
  customer: string
  amount: string
  risk: string
  route: Route
  reason: string
  time: string
}

const decisions: readonly Decision[] = [
  {
    id: "TXN-DEMO-1048",
    customer: "Amelia Hart",
    amount: "£84.20",
    risk: "8%",
    route: "PASS",
    reason: "Trusted customer",
    time: "2 min ago",
  },
  {
    id: "TXN-DEMO-1047",
    customer: "Jordan Lee",
    amount: "£1,240.00",
    risk: "94%",
    route: "HOLD",
    reason: "Velocity anomaly",
    time: "8 min ago",
  },
  {
    id: "TXN-DEMO-1046",
    customer: "Sofia Patel",
    amount: "£320.00",
    risk: "61%",
    route: "CHALLENGE",
    reason: "New device",
    time: "16 min ago",
  },
  {
    id: "TXN-DEMO-1045",
    customer: "Noah Williams",
    amount: "£62.00",
    risk: "17%",
    route: "PASS",
    reason: "Low risk",
    time: "24 min ago",
  },
  {
    id: "TXN-DEMO-1044",
    customer: "Mia Thompson",
    amount: "£780.40",
    risk: "87%",
    route: "HOLD",
    reason: "Location mismatch",
    time: "31 min ago",
  },
]

const populatedKpis = [
  { label: "Processed volume", value: "£1.24m" },
  { label: "Transactions", value: "12,842" },
  { label: "Held volume", value: "£86,420" },
  { label: "Review queue", value: "18" },
] as const

const populatedOutcomes = [
  { label: "Passed", count: "10,789", value: "£1.02m", share: "82.3%", tone: "success" },
  { label: "Challenged", count: "1,322", value: "£133.6k", share: "10.8%", tone: "warning" },
  { label: "Held", count: "731", value: "£86.4k", share: "7.0%", tone: "danger" },
] as const

const zeroKpis = [
  { label: "Processed volume", value: "£0.00" },
  { label: "Transactions", value: "0" },
  { label: "Held volume", value: "£0.00" },
  { label: "Review queue", value: "0" },
] as const

const zeroOutcomes = [
  { label: "Passed", count: "0", value: "£0.00", share: "0%", tone: "success" },
  { label: "Challenged", count: "0", value: "£0.00", share: "0%", tone: "warning" },
  { label: "Held", count: "0", value: "£0.00", share: "0%", tone: "danger" },
] as const

const scenarioResults: Record<DemoScenarioId, {
  kpis: ReadonlyArray<{ label: string; value: string }>
  outcomes: ReadonlyArray<{
    label: string
    count: string
    value: string
    share: string
    tone: "success" | "warning" | "danger"
  }>
  decisions: readonly Decision[]
  latency: string
  oldestReview: string
}> = {
  portfolio: {
    kpis: populatedKpis,
    outcomes: populatedOutcomes,
    decisions,
    latency: "142 ms",
    oldestReview: "46 min",
  },
  trusted: {
    kpis: [
      { label: "Processed volume", value: "£84.20" },
      { label: "Transactions", value: "1" },
      { label: "Held volume", value: "£0.00" },
      { label: "Review queue", value: "0" },
    ],
    outcomes: [
      { label: "Passed", count: "1", value: "£84.20", share: "100%", tone: "success" },
      { label: "Challenged", count: "0", value: "£0.00", share: "0%", tone: "warning" },
      { label: "Held", count: "0", value: "£0.00", share: "0%", tone: "danger" },
    ],
    decisions: [decisions[0]],
    latency: "96 ms",
    oldestReview: "0 min",
  },
  "new-device": {
    kpis: [
      { label: "Processed volume", value: "£320.00" },
      { label: "Transactions", value: "1" },
      { label: "Held volume", value: "£0.00" },
      { label: "Review queue", value: "1" },
    ],
    outcomes: [
      { label: "Passed", count: "0", value: "£0.00", share: "0%", tone: "success" },
      { label: "Challenged", count: "1", value: "£320.00", share: "100%", tone: "warning" },
      { label: "Held", count: "0", value: "£0.00", share: "0%", tone: "danger" },
    ],
    decisions: [decisions[2]],
    latency: "118 ms",
    oldestReview: "0 min",
  },
  velocity: {
    kpis: [
      { label: "Processed volume", value: "£1,240.00" },
      { label: "Transactions", value: "1" },
      { label: "Held volume", value: "£1,240.00" },
      { label: "Review queue", value: "1" },
    ],
    outcomes: [
      { label: "Passed", count: "0", value: "£0.00", share: "0%", tone: "success" },
      { label: "Challenged", count: "0", value: "£0.00", share: "0%", tone: "warning" },
      { label: "Held", count: "1", value: "£1,240.00", share: "100%", tone: "danger" },
    ],
    decisions: [decisions[1]],
    latency: "131 ms",
    oldestReview: "0 min",
  },
}

const routeTones: Record<Route, "success" | "warning" | "danger"> = {
  PASS: "success",
  CHALLENGE: "warning",
  HOLD: "danger",
}

function RoutePill({ route }: { route: Route }) {
  return (
    <PaymentsTonePill tone={routeTones[route]}>
      {route}
    </PaymentsTonePill>
  )
}

// The three steps of the demo, shown as reference in the help dialog and covered by the tour.
const demoSteps = [
  {
    title: "Choose a scenario",
    description: "Pick a realistic payment path from the scenario control in the header.",
  },
  {
    title: "Run the scenario",
    description: "Generate representative decisions, outcome mix, and operational health signals.",
  },
  {
    title: "Inspect the results",
    description: "Use the outcomes and recent decisions below to trace the effect of the selected path.",
  },
]

function DemoHelpDialog({ onStartTour }: { onStartTour: () => void }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="overview-demo-help" type="button">
          <CircleHelp aria-hidden="true" size={14} strokeWidth={1.6} />
          How this demo works
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overview-demo-dialog__overlay" />
        <Dialog.Content className="overview-demo-dialog" aria-describedby="demo-help-description">
          <header className="overview-demo-dialog__header">
            <div>
              <span className="overview-demo-dialog__eyebrow">Guided demo</span>
              <Dialog.Title>Explore the fraud decision workflow</Dialog.Title>
              <Dialog.Description id="demo-help-description">
                This workspace uses representative data so you can inspect how a payment moves through a decision.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="overview-demo-dialog__close" type="button" aria-label="Close demo guide">
                <X aria-hidden="true" size={16} />
              </button>
            </Dialog.Close>
          </header>
          <ol className="overview-demo-dialog__checklist">
            {demoSteps.map((step, index) => (
              <li key={step.title}>
                <span className="overview-demo-dialog__step-icon" aria-hidden="true">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <footer className="overview-demo-dialog__footer">
            <span>Try another path any time with Reset in the header.</span>
            <Dialog.Close asChild>
              {/* Start after the dialog has finished closing so the page is clickable again. */}
              <button className="overview-demo-dialog__secondary" type="button" onClick={() => window.setTimeout(onStartTour, 150)}>
                Take the tour
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button className="overview-demo-dialog__done" type="button">Got it</button>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Shown once per browser session on the first visit. Answering it, in either
// direction, is remembered so it does not come back on reload or navigation.
function WelcomeDialog({
  open,
  onAnswer,
  onStartTour,
}: {
  open: boolean
  onAnswer: () => void
  onStartTour: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onAnswer() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overview-demo-dialog__overlay" />
        <Dialog.Content className="overview-demo-dialog" aria-describedby="welcome-description">
          <header className="overview-demo-dialog__header">
            <div>
              <span className="overview-demo-dialog__eyebrow">Synthetic data</span>
              <Dialog.Title>Welcome to the payment risk demo</Dialog.Title>
              <Dialog.Description id="welcome-description">
                See how a payment moves from signals to a simulated decision. Nothing here can approve, release, or
                execute a real payment.
              </Dialog.Description>
            </div>
          </header>
          <footer className="overview-demo-dialog__footer">
            <span>The tour is also under “How this demo works”.</span>
            <button className="overview-demo-dialog__secondary" type="button" onClick={onAnswer}>Skip</button>
            <button
              className="overview-demo-dialog__done"
              type="button"
              onClick={() => {
                onAnswer()
                // Start after the dialog has finished closing so the page is clickable again.
                window.setTimeout(onStartTour, 150)
              }}
            >
              Take the tour
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function OverviewContent() {
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2026, 8, 1),
    to: new Date(2026, 8, 23),
  })
  const { activeScenario, selectedScenario, welcomeSeen, dismissWelcome } = useDemoSession()
  const { start: startTour } = useOverviewTour({ selectedScenario, activeScenario, onViewResults: scrollToResults })

  const result = activeScenario ? scenarioResults[activeScenario] : null
  const visibleDecisions = result?.decisions ?? []

  const query = search.trim().toLowerCase()
  const filteredDecisions = query
    ? visibleDecisions.filter((decision) =>
        [
          decision.id,
          decision.customer,
          decision.amount,
          decision.route,
          decision.reason,
        ].some((value) => value.toLowerCase().includes(query)),
      )
    : visibleDecisions

  function announceRun(scenarioId: DemoScenarioId) {
    const scenario = demoScenarios.find((option) => option.id === scenarioId)
    setNotice(`${scenario?.label ?? "Demo"} scenario completed. Start with Decision outcomes, then inspect the Recent decisions table below. Reset in the header to start again.`)
    setSearch("")
  }

  function scrollToResults() {
    document.getElementById("overview-results")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
      <WelcomeDialog open={!welcomeSeen} onAnswer={dismissWelcome} onStartTour={startTour} />
      <PaymentsTopBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={activeScenario ? undefined : "Search demo decisions after running a scenario"}
        onDemoRun={announceRun}
        onDemoSelectionChange={() => {
          setNotice(null)
          setSearch("")
        }}
        onDemoReset={() => {
          setNotice(null)
          setSearch("")
        }}
        rightContent={
          <>
            <span className="overview-demo-badge">Demo data</span>
            <DemoHelpDialog onStartTour={startTour} />
            <span className="payments-topbar__divider" aria-hidden="true" />
          </>
        }
      />
      <PaymentsPageMain>
        <PaymentsPageHeading
          title="Overview"
          description="Choose a scenario in the header, run it, then inspect decisions, review pressure, and model health."
        />

        {notice ? (
          <div className="overview-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <PaymentsDateRangePicker value={dateRange} onChange={setDateRange} />

        <PaymentsKpiStrip items={result?.kpis ?? zeroKpis} ariaLabel="Overview summary" />

        <div className="overview-grid" id="overview-results">
          <PaymentsPanel
            title="Decision outcomes"
            description="Route mix across processed transaction volume."
            labelledBy="decision-outcomes-title"
            contentClassName="overview-outcomes"
          >
            {(result?.outcomes ?? zeroOutcomes).map((outcome) => (
              <div className="overview-outcome" key={outcome.label}>
                <div className="overview-outcome__header">
                  <div className="overview-outcome__identity">
                    <span
                      className="overview-outcome__marker"
                      data-tone={outcome.tone}
                      aria-hidden="true"
                    />
                    <strong>{outcome.label}</strong>
                    <span className="overview-outcome__count">
                      {outcome.count} transactions
                    </span>
                  </div>
                  <div className="overview-outcome__metrics">
                    <strong>{outcome.value}</strong>
                    <span>{outcome.share}</span>
                  </div>
                </div>
                <PaymentsProgress
                  className="overview-outcome__track"
                  ariaLabel={`${outcome.label}: ${outcome.value}, ${outcome.count} transactions, ${outcome.share}`}
                  tone={outcome.tone}
                  value={Number.parseFloat(outcome.share)}
                />
              </div>
            ))}
          </PaymentsPanel>

          <PaymentsPanel
            title="Operational health"
            description="Current production model and review coverage."
            labelledBy="operational-health-title"
            contentClassName="overview-health"
          >
            <dl className="overview-health__list">
              <div>
                <dt>Production model</dt>
                <dd>{result ? "fraud-risk-v4.2" : "Not evaluated"}</dd>
              </div>
              <div>
                <dt>Drift state</dt>
                <dd>{result ? <><span className="overview-health__dot" />Stable</> : "Not evaluated"}</dd>
              </div>
              <div>
                <dt>p95 scoring latency</dt>
                <dd>{result?.latency ?? "0 ms"}</dd>
              </div>
              <div>
                <dt>Oldest review</dt>
                <dd>{result?.oldestReview ?? "0 min"}</dd>
              </div>
              <div>
                <dt>Estimated false-positive rate</dt>
                <dd className="overview-health__unavailable">{result ? "Unavailable" : "0%"}</dd>
              </div>
            </dl>
            <p className="overview-health__note">
              {result
                ? "Labelled outcomes are required before false-positive rate can be calculated."
                : "Run a demo scenario to evaluate operational health."}
            </p>
          </PaymentsPanel>
        </div>

        <section className="overview-actions" aria-labelledby="quick-actions-title">
          <header className="overview-section-heading">
            <div>
              <h2 id="quick-actions-title">Quick actions</h2>
              <p>Start a demo flow or open the review queue.</p>
            </div>
          </header>
          <div className="overview-actions__grid">
            <button
              type="button"
              disabled={!result}
              onClick={() => setNotice("Custom transaction analysis is ready for input.")}
            >
              <span className="overview-action__icon"><ShieldCheck aria-hidden="true" /></span>
              <span><strong>Analyse a transaction</strong><small>{result ? "Submit transaction facts for a risk decision." : "Run a scenario to unlock this flow."}</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!result}
              onClick={() => setNotice("The demo review queue contains 18 open cases.")}
            >
              <span className="overview-action__icon"><Play aria-hidden="true" /></span>
              <span><strong>Open review queue</strong><small>{result ? "Continue with cases waiting for a decision." : "Run a scenario to unlock this queue."}</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="overview-decisions" aria-labelledby="recent-decisions-title">
          <header className="overview-section-heading">
            <div>
              <h2 id="recent-decisions-title">Recent decisions</h2>
              <p>Latest mock transaction outcomes across the demo environment.</p>
            </div>
            <span>{filteredDecisions.length} of {visibleDecisions.length}</span>
          </header>
          <PaymentsTablePanel className="overview-table" density="compact">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Primary reason</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDecisions.map((decision) => (
                  <TableRow key={decision.id}>
                    <TableCell className="overview-transaction-id">{decision.id}</TableCell>
                    <TableCell className="payments-type-identifier">{decision.customer}</TableCell>
                    <TableCell>{decision.amount}</TableCell>
                    <TableCell>{decision.risk}</TableCell>
                    <TableCell><RoutePill route={decision.route} /></TableCell>
                    <TableCell className="payments-type-table-copy">{decision.reason}</TableCell>
                    <TableCell className="text-right overview-time">{decision.time}</TableCell>
                  </TableRow>
                ))}
                {filteredDecisions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="overview-table__empty">
                      {visibleDecisions.length === 0
                        ? "No results yet. Select a demo scenario in the header, then choose Run."
                        : `No decisions match “${search}”.`}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </PaymentsTablePanel>
        </section>
      </PaymentsPageMain>
    </>
  )
}

export default function Overview() {
  return (
    <PaymentsAppShell sidebar={<AppSidebar activeItem="Overview" />}>
      <OverviewContent />
    </PaymentsAppShell>
  )
}
