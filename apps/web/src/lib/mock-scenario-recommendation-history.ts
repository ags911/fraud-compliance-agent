import { addDays, differenceInCalendarDays, format, max, subDays } from "date-fns"

import type { DateWindow } from "@/lib/scenario-date-window"
import type { ShowcaseScenarioId } from "@/lib/showcase-types"

/**
 * MOCK DATA -- a placeholder for the planned Sandbox scenario history, not
 * recorded runs, production data or model-training data.
 *
 * The planned version seeds each scenario with 180 days of Sandbox
 * transactions at creation, derives only the permitted scenario facts from
 * that history, appends new Sandbox transactions incrementally as a
 * real-time stream, and labels all of it `plaid_sandbox_derived`. Until that
 * dataset and its contract exist, this module generates a deterministic
 * 180-day PASS / CHALLENGE / HOLD history per scenario so the Radar time
 * series chart has a shape to render. Replace it; do not extend it.
 */

export type RecommendationHistoryDatum = {
  label: string
  PASS: number
  CHALLENGE: number
  HOLD: number
}

export type RecommendationHistory = {
  scenarioId: ShowcaseScenarioId
  /** Always "mock" here; the planned Sandbox history is `plaid_sandbox_derived`. */
  sourceClass: "mock"
  /** One entry per calendar day in the requested window. */
  data: RecommendationHistoryDatum[]
}

const HISTORY_DAYS = 180
// Fixed so the mock history (and screenshots of it) are reproducible.
const HISTORY_END = new Date(2026, 8, 23)
const HISTORY_START = subDays(HISTORY_END, HISTORY_DAYS - 1)

// Per-scenario daily volume and PASS / CHALLENGE / HOLD mix, chosen to read
// like each scenario's intent (S01 mostly clears, S05 is the fail-safe path).
// Only the scenarios the Radar selector offers are mocked; others are empty.
const profiles: Partial<Record<ShowcaseScenarioId, { seed: number; volume: number; mix: [number, number, number] }>> = {
  S01: { seed: 101, volume: 14, mix: [0.9, 0.07, 0.03] },
  S02: { seed: 202, volume: 8, mix: [0.35, 0.3, 0.35] },
  S03: { seed: 303, volume: 6, mix: [0.15, 0.2, 0.65] },
  S04: { seed: 404, volume: 9, mix: [0.3, 0.55, 0.15] },
  S05: { seed: 505, volume: 4, mix: [0.05, 0.1, 0.85] },
}

// mulberry32: small seeded PRNG, so every render yields the same history.
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Mock PASS / CHALLENGE / HOLD split for one day. When the real Sandbox
 * transaction count for that day is known, it is used as the day's volume,
 * so the mock decides exactly the transactions the Sandbox chart shows and
 * only the split is invented. Seeded per scenario and day, so a day always
 * gets the same split whatever range it is viewed in.
 */
function mockDay(scenarioId: ShowcaseScenarioId, date: Date, knownVolume: number | undefined): RecommendationHistoryDatum {
  const day: RecommendationHistoryDatum = { label: format(date, "d MMM"), PASS: 0, CHALLENGE: 0, HOLD: 0 }
  const profile = profiles[scenarioId]
  if (!profile) return day
  const { seed, volume, mix } = profile
  const random = seededRandom(seed * 100_000 + differenceInCalendarDays(date, HISTORY_START))
  const weekend = date.getDay() === 0 || date.getDay() === 6
  const runs = knownVolume ?? Math.round(volume * (weekend ? 0.7 : 1) * (0.7 + random() * 0.6))
  for (let run = 0; run < runs; run += 1) {
    const roll = random()
    if (roll < mix[0]) day.PASS += 1
    else if (roll < mix[0] + mix[1]) day.CHALLENGE += 1
    else day.HOLD += 1
  }
  return day
}

/**
 * Return one day of mock history per calendar day in `window` (the Scenario
 * tab's shared range, already clipped to the Sandbox dataset's boundary).
 * `volumes` maps "yyyy-MM-dd" to that day's real Sandbox transaction count.
 */
export function mockScenarioRecommendationHistory(
  scenarioId: ShowcaseScenarioId,
  window: DateWindow,
  volumes?: ReadonlyMap<string, number>,
): RecommendationHistory {
  const data: RecommendationHistoryDatum[] = []
  const start = max([window.start, HISTORY_START])
  for (let date = start; date <= window.end && date <= HISTORY_END; date = addDays(date, 1)) {
    data.push(mockDay(scenarioId, date, volumes?.get(format(date, "yyyy-MM-dd"))))
  }
  return { scenarioId, sourceClass: "mock", data }
}
