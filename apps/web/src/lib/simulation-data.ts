import { useCallback, useEffect, useState } from "react"

/**
 * Client-side data model and generator for the /simulation demo page.
 *
 * Everything here is randomly generated in the browser on a timer — there is
 * no backend, no SSE connection, and no trained model behind it. It exists to
 * demonstrate what a live fraud-decision stream UI could look like, not to
 * report a real metric. Every number resets to zero/empty on reset() and
 * nothing here is wired to the app's real decision engine or demo API.
 */

export type AttackVectorId = "carding" | "ato" | "app_fraud"

export type AttackVector = {
  id: AttackVectorId
  label: string
  description: string
}

export const attackVectors: AttackVector[] = [
  {
    id: "carding",
    label: "Scenario: High-Velocity Carding Spree",
    description: "Rapid low-value authorisations across many stolen card numbers.",
  },
  {
    id: "ato",
    label: "Scenario: Account Takeover (ATO)",
    description: "A credential-stuffed login followed by unfamiliar-device transfers.",
  },
  {
    id: "app_fraud",
    label: "Scenario: Authorized Push Payment (APP) Fraud",
    description: "A genuine customer, socially engineered into authorising a payment.",
  },
]

export type ScoreBand = "auto_pass" | "llm_low" | "llm_high" | "auto_block"

export const scoreBands: Array<{ id: ScoreBand; label: string; range: string }> = [
  { id: "auto_pass", label: "0.00–0.20 (Auto-Pass)", range: "0.00-0.20" },
  { id: "llm_low", label: "0.21–0.50 (LLM Low)", range: "0.21-0.50" },
  { id: "llm_high", label: "0.51–0.84 (LLM High)", range: "0.51-0.84" },
  { id: "auto_block", label: "0.85–1.00 (Auto-Block)", range: "0.85-1.00" },
]

function bandForScore(score: number): ScoreBand {
  if (score <= 0.2) return "auto_pass"
  if (score <= 0.5) return "llm_low"
  if (score <= 0.84) return "llm_high"
  return "auto_block"
}

export type Engine = "XGBoost" | "LLM Agent"
export type FinalDecision = "PASS" | "BLOCKED" | "FLAGGED"

export type SimulatedTransaction = {
  id: string
  timestamp: string
  accountId: string
  merchant: string
  amount: string
  score: number
  band: ScoreBand
  engine: Engine
  decision: FinalDecision
  policyViolations: string[]
  llmReasoning: string
  payload: {
    sparkovBaseline: Record<string, string | number>
    plaidEnriched: Record<string, string | number | boolean>
  }
  auditHash: string
  auditTimestamp: string
}

const merchantsByVector: Record<AttackVectorId, string[]> = {
  carding: ["QuickMart Express", "GlobalTopUp", "PixelGiftCards", "NightOwl Fuel", "FastLane Electronics"],
  ato: ["Zenith Wire Transfer", "InstantPay Remit", "CloudLedger Transfer", "SwiftRoute Payments"],
  app_fraud: ["Harbor Property Deposit", "Everline Invoice Settlement", "Coastal Renovations Ltd", "Aster Legal Escrow"],
}

const policyViolationsByVector: Record<AttackVectorId, string[]> = {
  carding: ["VELOCITY_CEILING_EXCEEDED", "CARD_BIN_CLUSTER_ANOMALY", "UNRECOGNIZED_DEVICE_IP"],
  ato: ["UNRECOGNIZED_DEVICE_IP", "SESSION_GEO_MISMATCH", "CREDENTIAL_REPLAY_SIGNATURE"],
  app_fraud: ["NEW_PAYEE_HIGH_VALUE", "URGENCY_LANGUAGE_DETECTED", "BENEFICIARY_RISK_LIST_MATCH"],
}

const reasoningByVector: Record<AttackVectorId, string> = {
  carding:
    "Multiple low-value authorisations from this account exceeded the simulated velocity ceiling within a short window, against a cluster of card BINs seen together in prior synthetic carding runs.",
  ato:
    "The session's device and IP were not seen on this account before, and the geolocation is inconsistent with the account's simulated recent history, consistent with a takeover pattern.",
  app_fraud:
    "The payment goes to a payee never paid before, at a value well above this account's simulated norm, with memo language matching known urgency/social-engineering patterns.",
}

let sequence = 0
function nextId(): string {
  sequence += 1
  return `SIM-${Date.now().toString(36)}-${sequence.toString(36).padStart(4, "0")}`
}

function randomAccountId(): string {
  return `ACC-${Math.floor(100000 + Math.random() * 899999)}`
}

function randomAmount(vector: AttackVectorId): number {
  if (vector === "carding") return 5 + Math.random() * 60
  if (vector === "ato") return 800 + Math.random() * 6000
  return 1500 + Math.random() * 15000
}

function randInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// Per-vector band weights so each scenario "feels" different in the mix of
// simulated outcomes, while most traffic still auto-passes — an arbitrary
// flavour choice for the demo, not a measured rate.
const bandWeightsByVector: Record<AttackVectorId, [number, number, number, number]> = {
  carding: [0.68, 0.18, 0.09, 0.05],
  ato: [0.6, 0.12, 0.16, 0.12],
  app_fraud: [0.72, 0.14, 0.12, 0.02],
}

function randomScoreFor(vector: AttackVectorId): number {
  const [pPass, pLow, pHigh] = bandWeightsByVector[vector]
  const r = Math.random()
  if (r < pPass) return randInRange(0, 0.2)
  if (r < pPass + pLow) return randInRange(0.21, 0.5)
  if (r < pPass + pLow + pHigh) return randInRange(0.51, 0.84)
  return randInRange(0.85, 1)
}

function engineAndDecisionForBand(band: ScoreBand): { engine: Engine; decision: FinalDecision } {
  if (band === "auto_pass") return { engine: "XGBoost", decision: "PASS" }
  if (band === "auto_block") return { engine: "XGBoost", decision: "BLOCKED" }
  return { engine: "LLM Agent", decision: "FLAGGED" }
}

function fakeHash(): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("")
}

function generateTransaction(vector: AttackVectorId): SimulatedTransaction {
  const score = randomScoreFor(vector)
  const band = bandForScore(score)
  const { engine, decision } = engineAndDecisionForBand(band)
  const merchants = merchantsByVector[vector]
  const merchant = merchants[Math.floor(Math.random() * merchants.length)]
  const amount = randomAmount(vector)
  const now = new Date()
  const escalated = engine === "LLM Agent"

  return {
    id: nextId(),
    timestamp: now.toISOString(),
    accountId: randomAccountId(),
    merchant,
    amount: amount.toLocaleString("en-GB", { style: "currency", currency: "GBP" }),
    score,
    band,
    engine,
    decision,
    policyViolations: escalated ? policyViolationsByVector[vector] : [],
    llmReasoning: escalated ? reasoningByVector[vector] : "",
    payload: {
      sparkovBaseline: {
        category: vector === "carding" ? "misc_net" : vector === "ato" ? "grocery_pos" : "home",
        merchant_lat: (Math.random() * 180 - 90).toFixed(4),
        merchant_long: (Math.random() * 360 - 180).toFixed(4),
        job: "Simulated / synthetic profile",
        age_years: 20 + Math.floor(Math.random() * 50),
      },
      plaidEnriched: {
        account_age_days: Math.floor(Math.random() * 2000),
        device_recognized: !escalated,
        recent_transfer_count_24h: escalated ? Math.floor(Math.random() * 8) + 3 : Math.floor(Math.random() * 2),
        sandbox_source: "plaid_sandbox_derived (demo fixture, not live data)",
      },
    },
    auditHash: `0x${fakeHash()}`,
    auditTimestamp: now.toISOString(),
  }
}

// Three fixed, non-random rows so the table has something to show before a
// stream has ever run — one of each decision, per the page spec.
export const seedTransactions: SimulatedTransaction[] = [
  {
    id: "SIM-SEED-0001",
    timestamp: new Date(Date.now() - 120_000).toISOString(),
    accountId: "ACC-482910",
    merchant: "QuickMart Express",
    amount: "£18.40",
    score: 0.06,
    band: "auto_pass",
    engine: "XGBoost",
    decision: "PASS",
    policyViolations: [],
    llmReasoning: "",
    payload: {
      sparkovBaseline: { category: "misc_net", merchant_lat: "51.5072", merchant_long: "-0.1276", job: "Simulated / synthetic profile", age_years: 34 },
      plaidEnriched: { account_age_days: 812, device_recognized: true, recent_transfer_count_24h: 1, sandbox_source: "plaid_sandbox_derived (demo fixture, not live data)" },
    },
    auditHash: "0x00000000000000000000000000000000",
    auditTimestamp: new Date(Date.now() - 120_000).toISOString(),
  },
  {
    id: "SIM-SEED-0002",
    timestamp: new Date(Date.now() - 90_000).toISOString(),
    accountId: "ACC-119284",
    merchant: "Everline Invoice Settlement",
    amount: "£9,240.00",
    score: 0.93,
    band: "auto_block",
    engine: "XGBoost",
    decision: "BLOCKED",
    policyViolations: [],
    llmReasoning: "",
    payload: {
      sparkovBaseline: { category: "home", merchant_lat: "48.8566", merchant_long: "2.3522", job: "Simulated / synthetic profile", age_years: 51 },
      plaidEnriched: { account_age_days: 44, device_recognized: false, recent_transfer_count_24h: 6, sandbox_source: "plaid_sandbox_derived (demo fixture, not live data)" },
    },
    auditHash: "0x11111111111111111111111111111111",
    auditTimestamp: new Date(Date.now() - 90_000).toISOString(),
  },
  {
    id: "SIM-SEED-0003",
    timestamp: new Date(Date.now() - 60_000).toISOString(),
    accountId: "ACC-773605",
    merchant: "Zenith Wire Transfer",
    amount: "£3,150.00",
    score: 0.62,
    band: "llm_high",
    engine: "LLM Agent",
    decision: "FLAGGED",
    policyViolations: policyViolationsByVector.ato,
    llmReasoning: reasoningByVector.ato,
    payload: {
      sparkovBaseline: { category: "grocery_pos", merchant_lat: "40.7128", merchant_long: "-74.0060", job: "Simulated / synthetic profile", age_years: 29 },
      plaidEnriched: { account_age_days: 501, device_recognized: false, recent_transfer_count_24h: 4, sandbox_source: "plaid_sandbox_derived (demo fixture, not live data)" },
    },
    auditHash: "0x22222222222222222222222222222222",
    auditTimestamp: new Date(Date.now() - 60_000).toISOString(),
  },
]

export type ThroughputPoint = { time: string; tps: number }

export type SimulationKpis = {
  totalProcessed: number
  autoPassPct: number
  autoBlockPct: number
  llmEscalationPct: number
  avgLatencyMs: number
}

const zeroKpis: SimulationKpis = {
  totalProcessed: 0,
  autoPassPct: 0,
  autoBlockPct: 0,
  llmEscalationPct: 0,
  avgLatencyMs: 0,
}

const MAX_FEED_ROWS = 40
const MAX_THROUGHPUT_POINTS = 24
const TICK_MS = 650

/**
 * Drives the simulated stream: a setInterval that manufactures transactions
 * client-side while `running` is true. Nothing here calls a network API.
 */
export function useSimulationStream(vector: AttackVectorId) {
  const [running, setRunning] = useState(false)
  const [transactions, setTransactions] = useState<SimulatedTransaction[]>([])
  const [bandCounts, setBandCounts] = useState<Record<ScoreBand, number>>({
    auto_pass: 0,
    llm_low: 0,
    llm_high: 0,
    auto_block: 0,
  })
  const [throughput, setThroughput] = useState<ThroughputPoint[]>([])
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [avgLatencyMs, setAvgLatencyMs] = useState(0)

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      const perTick = 1 + Math.floor(Math.random() * 3)
      const batch = Array.from({ length: perTick }, () => generateTransaction(vector))

      setTotalProcessed((prev) => prev + batch.length)
      setAvgLatencyMs(Math.round((1.0 + Math.random() * 0.6) * 10) / 10)
      setTransactions((prev) => [...batch.reverse(), ...prev].slice(0, MAX_FEED_ROWS))
      setBandCounts((prev) => {
        const next = { ...prev }
        for (const tx of batch) next[tx.band] += 1
        return next
      })
      setThroughput((prev) => {
        const point: ThroughputPoint = {
          time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          tps: Math.round((batch.length / (TICK_MS / 1000)) * 10) / 10,
        }
        return [...prev, point].slice(-MAX_THROUGHPUT_POINTS)
      })
    }, TICK_MS)
    return () => window.clearInterval(interval)
  }, [running, vector])

  const reset = useCallback(() => {
    setRunning(false)
    setTransactions([])
    setBandCounts({ auto_pass: 0, llm_low: 0, llm_high: 0, auto_block: 0 })
    setThroughput([])
    setTotalProcessed(0)
    setAvgLatencyMs(0)
  }, [])

  const kpis: SimulationKpis = totalProcessed === 0
    ? zeroKpis
    : {
        totalProcessed,
        autoPassPct: Math.round((bandCounts.auto_pass / totalProcessed) * 1000) / 10,
        autoBlockPct: Math.round((bandCounts.auto_block / totalProcessed) * 1000) / 10,
        llmEscalationPct: Math.round(((bandCounts.llm_low + bandCounts.llm_high) / totalProcessed) * 1000) / 10,
        avgLatencyMs,
      }

  return {
    running,
    setRunning,
    transactions,
    bandCounts,
    throughput,
    kpis,
    reset,
  }
}
