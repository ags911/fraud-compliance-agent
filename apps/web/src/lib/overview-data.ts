import type { DemoScenarioId } from "@/components/demo-session"

// Synthetic demo results for the Overview scenarios. They are defined in code, never
// fetched, and are shared by the Overview page and the shadcn dashboard so the two
// always show the same figures.
export type Route = "PASS" | "CHALLENGE" | "HOLD"

export type Decision = {
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

export const zeroKpis = [
  { label: "Processed volume", value: "£0.00" },
  { label: "Transactions", value: "0" },
  { label: "Held volume", value: "£0.00" },
  { label: "Review queue", value: "0" },
] as const

export const zeroOutcomes = [
  { label: "Passed", count: "0", value: "£0.00", share: "0%", tone: "success" },
  { label: "Challenged", count: "0", value: "£0.00", share: "0%", tone: "warning" },
  { label: "Held", count: "0", value: "£0.00", share: "0%", tone: "danger" },
] as const

export const scenarioResults: Record<DemoScenarioId, {
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
