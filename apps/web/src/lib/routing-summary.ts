import type { SankeyData } from "recharts"

import type { SandboxSimulationRun } from "@/lib/sandbox-simulation"

export const ROUTING_OUTCOMES = ["PASS", "CHALLENGE", "HOLD"] as const
export type RoutingOutcome = (typeof ROUTING_OUTCOMES)[number]
export type RoutingToken = { event_id: string; sequence: number; recommendation: RoutingOutcome }

export type RoutingSummary = {
  /** Every revealed payment by outcome, from the run's routing snapshot. */
  counts: Record<RoutingOutcome, number>
  total: number
  /** The newest revealed decision, or null before the first one. */
  last: RoutingToken | null
}

/**
 * Radar's decision routing board (spec 0006) reads only this: counts and the
 * newest decision from the run's `routing_snapshot`. Null until the run has
 * a snapshot. Nothing here scores, thresholds, or reroutes a payment.
 */
export function routingSummary(run: SandboxSimulationRun | null): RoutingSummary | null {
  const snapshot = run?.routing_snapshot?.by_recommendation
  if (!snapshot) return null
  const counts = { PASS: snapshot.PASS.count, CHALLENGE: snapshot.CHALLENGE.count, HOLD: snapshot.HOLD.count }
  const last = ROUTING_OUTCOMES.flatMap((outcome) => snapshot[outcome].recent).reduce<RoutingToken | null>(
    (best, token) => (!best || token.sequence > best.sequence ? token : best),
    null,
  )
  return { counts, total: counts.PASS + counts.CHALLENGE + counts.HOLD, last }
}

/** The board's summary before a run has any snapshot: every outcome at zero. */
export const EMPTY_ROUTING_SUMMARY: RoutingSummary = { counts: { PASS: 0, CHALLENGE: 0, HOLD: 0 }, total: 0, last: null }

// Smallest drawn share of an outcome's band, so its node and inside label
// stay visible at zero or at a small count.
const MIN_DRAWN_SHARE = 0.18

/**
 * Sankey nodes and links for the board: one feed node flowing into every
 * outcome, in a fixed order, even at zero. A band is drawn at least
 * `MIN_DRAWN_SHARE` of the total (or 1 before any payment) so it stays
 * visible; each node's `displayValue` is its real count, which the label
 * shows. Sizes are therefore not exact shares for small outcomes.
 */
export function routingSankeyData(summary: RoutingSummary): SankeyData {
  const floor = (summary.total || 1) * MIN_DRAWN_SHARE
  return {
    nodes: [
      { name: "FEED", displayValue: summary.total },
      ...ROUTING_OUTCOMES.map((outcome) => ({ name: outcome, displayValue: summary.counts[outcome] })),
    ],
    links: ROUTING_OUTCOMES.map((outcome, index) => ({ source: 0, target: index + 1, value: Math.max(summary.counts[outcome], floor) })),
  }
}

/**
 * One line explaining the board's lanes (spec 0008 AC 8). A single scenario's
 * rule sends every payment to one outcome, named here from what was actually
 * routed, never from a copy of the rules. The Mixed feed (`MIX`) says each
 * payment keeps its own scenario's rule. Null before a single scenario has
 * routed anything, or without a run.
 */
export function routingRuleNote(scenarioId: string | null, summary: RoutingSummary): string | null {
  if (scenarioId === "MIX") return "Payments from S01 to S05, each decided by its own scenario's rule."
  const routed = ROUTING_OUTCOMES.filter((outcome) => summary.counts[outcome] > 0)
  if (!scenarioId || routed.length !== 1) return null
  return `Every ${scenarioId} payment follows its rule: ${routed[0]}`
}
