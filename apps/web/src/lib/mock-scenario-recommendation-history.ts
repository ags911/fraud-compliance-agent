import { addDays, format, subDays } from "date-fns"

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

export type RecommendationHistoryRange = 7 | 30 | 90

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
  range: RecommendationHistoryRange
  /** "day" for 7D/30D, "week" for 90D (weekly buckets keep 90D readable). */
  bucket: "day" | "week"
  data: RecommendationHistoryDatum[]
}

const HISTORY_DAYS = 180
// Fixed so the mock history (and screenshots of it) are reproducible.
const HISTORY_END = new Date(2026, 8, 23)

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

type DailyCounts = { date: Date } & Omit<RecommendationHistoryDatum, "label">

const historyCache = new Map<ShowcaseScenarioId, DailyCounts[]>()

function dailyHistory(scenarioId: ShowcaseScenarioId): DailyCounts[] {
  const cached = historyCache.get(scenarioId)
  if (cached) return cached

  const profile = profiles[scenarioId]
  if (!profile) return []
  const { seed, volume, mix } = profile
  const random = seededRandom(seed)
  const start = subDays(HISTORY_END, HISTORY_DAYS - 1)
  const history = Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const date = addDays(start, index)
    const weekend = date.getDay() === 0 || date.getDay() === 6
    const runs = Math.round(volume * (weekend ? 0.7 : 1) * (0.7 + random() * 0.6))
    const day: DailyCounts = { date, PASS: 0, CHALLENGE: 0, HOLD: 0 }
    for (let run = 0; run < runs; run += 1) {
      const roll = random()
      if (roll < mix[0]) day.PASS += 1
      else if (roll < mix[0] + mix[1]) day.CHALLENGE += 1
      else day.HOLD += 1
    }
    return day
  })
  historyCache.set(scenarioId, history)
  return history
}

/** Return the selected window of mock history, bucketed for charting. */
export function mockScenarioRecommendationHistory(
  scenarioId: ShowcaseScenarioId,
  range: RecommendationHistoryRange,
): RecommendationHistory {
  const days = dailyHistory(scenarioId).slice(-range)
  if (range !== 90) {
    return {
      scenarioId,
      sourceClass: "mock",
      range,
      bucket: "day",
      data: days.map(({ date, PASS, CHALLENGE, HOLD }) => ({ label: format(date, "d MMM"), PASS, CHALLENGE, HOLD })),
    }
  }

  // Weekly buckets anchored on the latest day, so the newest week is always
  // complete; the oldest bucket absorbs the remainder (90 = 12 x 7 + 6).
  const weeks: RecommendationHistoryDatum[] = []
  for (let end = days.length; end > 0; end -= 7) {
    const week = days.slice(Math.max(0, end - 7), end)
    weeks.unshift({
      label: format(week[0].date, "d MMM"),
      PASS: week.reduce((sum, day) => sum + day.PASS, 0),
      CHALLENGE: week.reduce((sum, day) => sum + day.CHALLENGE, 0),
      HOLD: week.reduce((sum, day) => sum + day.HOLD, 0),
    })
  }
  return { scenarioId, sourceClass: "mock", range, bucket: "week", data: weeks }
}
