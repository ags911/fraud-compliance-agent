import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Outcome = 'HOLD' | 'PASS' | 'CHALLENGE'

const OUTCOME_STYLES: Record<Outcome, string> = {
  HOLD: 'bg-hold-soft text-hold border-hold/30',
  CHALLENGE: 'bg-challenge-soft text-challenge border-challenge/30',
  PASS: 'bg-pass-soft text-pass border-pass/30',
}

/**
 * Colour is never the only signal — every badge pairs its colour with the
 * outcome's own text label, so the meaning survives for anyone who can't
 * distinguish the colours.
 */
export function OutcomeBadge({ outcome, className }: { outcome: Outcome; className?: string }) {
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-semibold', OUTCOME_STYLES[outcome], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', {
        'bg-hold': outcome === 'HOLD',
        'bg-challenge': outcome === 'CHALLENGE',
        'bg-pass': outcome === 'PASS',
      })} />
      {outcome}
    </Badge>
  )
}
