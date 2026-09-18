import { useEffect, useRef } from "react"
import { animate, useReducedMotion } from "motion/react"

// Splits "£1.24m", "12,842", "£0.00", "18" into the parts needed to animate
// just the numeric core and reassemble the same formatted string each frame.
const NUMERIC_CORE = /-?[\d,]+\.?\d*/

function parseFormattedNumber(value: string) {
  const match = value.match(NUMERIC_CORE)
  if (!match || match.index === undefined) return null
  const raw = match[0]
  const target = Number(raw.replace(/,/g, ""))
  if (Number.isNaN(target)) return null
  return {
    prefix: value.slice(0, match.index),
    suffix: value.slice(match.index + raw.length),
    target,
    decimals: raw.includes(".") ? raw.split(".")[1].length : 0,
    useCommas: raw.includes(","),
  }
}

function formatLike(parsed: NonNullable<ReturnType<typeof parseFormattedNumber>>, current: number) {
  const body = parsed.useCommas
    ? current.toLocaleString("en-GB", {
        minimumFractionDigits: parsed.decimals,
        maximumFractionDigits: parsed.decimals,
      })
    : current.toFixed(parsed.decimals)
  return `${parsed.prefix}${body}${parsed.suffix}`
}

/**
 * Counts up from the previous value to a new one whenever `value` changes
 * (including on mount) — parses out the numeric core of an already-
 * formatted string like "£1.24m" or "12,842" so the currency/comma/suffix
 * formatting stays intact across every animated frame.
 *
 * Deliberately NOT a spring (reactbits.dev's CountUp uses one — see git
 * history for that version): a spring decays asymptotically and never
 * truly stops, and reactbits' own damping/stiffness formula turns out to
 * have its *fastest possible* response exactly at its default duration=2
 * (damping ratio is minimised there — verified by differentiating it),
 * so tuning duration lower made it MORE sluggish, not less. A fixed-
 * duration tween hits an exact, predictable stop instead.
 */
export function CountUpValue({
  value,
  duration = 0.55,
  className,
}: {
  value: string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const currentRef = useRef(0)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const parsed = parseFormattedNumber(value)
    if (!parsed) {
      if (ref.current) ref.current.textContent = value
      return
    }

    const from = currentRef.current

    // Only ever counts up — a lower new target (e.g. a reset back to
    // zero), or a reduced-motion preference, jumps straight there instead
    // of visibly counting down or animating at all.
    if (prefersReducedMotion || parsed.target <= from) {
      currentRef.current = parsed.target
      if (ref.current) ref.current.textContent = formatLike(parsed, parsed.target)
      return
    }

    const controls = animate(from, parsed.target, {
      duration,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo — fast off the mark, gentle landing, no long tail
      onUpdate: (latest) => {
        currentRef.current = latest
        if (ref.current) ref.current.textContent = formatLike(parsed, latest)
      },
    })
    return () => controls.stop()
  }, [duration, prefersReducedMotion, value])

  return <span className={className} ref={ref} />
}
