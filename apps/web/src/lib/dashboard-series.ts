import { format } from "date-fns"

// A deterministic, synthetic 30-day series for the "Mixed 30-day portfolio" demo scenario.
//
// This is the scenario's own definition, not run history: nothing is recorded, fetched, or
// random. Every daily figure is allocated so the series sums exactly to the totals the
// Overview page already shows for that scenario (12,842 transactions, 1,322 challenged,
// 731 held, £86,420 held volume, £1.24m processed), so the chart and the KPI cards agree.

export type DayPoint = {
  date: Date
  label: string
  transactions: number
  passed: number
  challenged: number
  held: number
  volume: number
  heldVolume: number
}

export const PORTFOLIO_TOTALS = {
  transactions: 12842,
  challenged: 1322,
  held: 731,
  volume: 1_240_000,
  heldVolume: 86_420,
} as const

/**
 * Split a whole-number total across days in proportion to weights.
 *
 * Args:
 *   total: The whole number to distribute.
 *   weights: A non-negative weight per day. They need not sum to anything in particular.
 *
 * Returns:
 *   One integer per weight, summing exactly to total (largest-remainder rounding).
 */
function allocate(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0)
  const raw = weights.map((weight) => (weight / sum) * total)
  const shares = raw.map(Math.floor)
  let remaining = total - shares.reduce((acc, share) => acc + share, 0)
  const byRemainder = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const { index } of byRemainder) {
    if (remaining <= 0) break
    shares[index] += 1
    remaining -= 1
  }
  return shares
}

const DAYS = 30
const LAST_DAY = new Date(2026, 8, 23)

function buildPortfolioSeries(): DayPoint[] {
  const dates = Array.from({ length: DAYS }, (_, index) => {
    const date = new Date(LAST_DAY)
    date.setDate(LAST_DAY.getDate() - (DAYS - 1 - index))
    return date
  })

  // Weekends are quieter; a small fixed wobble keeps the shape from looking mechanical.
  const traffic = dates.map((date, index) => {
    const weekend = date.getDay() === 0 || date.getDay() === 6 ? 0.72 : 1
    return weekend * (1 + 0.09 * Math.sin(index * 1.7) + 0.05 * Math.cos(index * 0.9))
  })
  const transactions = allocate(PORTFOLIO_TOTALS.transactions, traffic)
  const held = allocate(PORTFOLIO_TOTALS.held, traffic.map((weight, index) => weight * (1 + 0.35 * Math.sin(index * 2.3 + 1))))
  const challenged = allocate(PORTFOLIO_TOTALS.challenged, traffic.map((weight, index) => weight * (1 + 0.2 * Math.cos(index * 1.3))))
  const volume = allocate(PORTFOLIO_TOTALS.volume, transactions)
  const heldVolume = allocate(PORTFOLIO_TOTALS.heldVolume, held)

  return dates.map((date, index) => ({
    date,
    label: format(date, "d MMM"),
    transactions: transactions[index],
    passed: transactions[index] - held[index] - challenged[index],
    challenged: challenged[index],
    held: held[index],
    volume: volume[index],
    heldVolume: heldVolume[index],
  }))
}

export const portfolioSeries: readonly DayPoint[] = buildPortfolioSeries()

/**
 * Change in a series' last seven days against the seven days before them.
 *
 * Args:
 *   series: The daily points, oldest first.
 *   key: The numeric field to compare.
 *
 * Returns:
 *   The relative change as a fraction (0.05 is +5%).
 */
export function weekOverWeek(series: readonly DayPoint[], key: "transactions" | "volume" | "heldVolume") {
  const sum = (points: readonly DayPoint[]) => points.reduce((acc, point) => acc + point[key], 0)
  const recent = sum(series.slice(-7))
  const prior = sum(series.slice(-14, -7))
  return prior === 0 ? 0 : (recent - prior) / prior
}
