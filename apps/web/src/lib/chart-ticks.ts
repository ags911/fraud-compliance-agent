/**
 * Evenly spaced y-axis ticks on a "nice" whole-number step (1/2/2.5/5 x
 * 10^n), with the scale's top on a tick so every gridline gap measures the
 * same amount and there's headroom above the tallest mark.
 */
export function evenTicks(maxValue: number): number[] {
  const target = Math.max(maxValue, 1) * 1.1
  const rawStep = target / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = Math.max(1, ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= rawStep) ?? 10) * magnitude)
  const wholeStep = Number.isInteger(step) ? step : Math.ceil(step)
  return Array.from({ length: Math.ceil(target / wholeStep) + 1 }, (_, index) => index * wholeStep)
}
