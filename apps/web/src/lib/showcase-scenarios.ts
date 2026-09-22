import type { ShowcaseScenarioId } from '@/lib/showcase-types'

/** A scenario the database-free showcase can run today. */
export type RunnableShowcaseScenarioId = Extract<ShowcaseScenarioId, 'S01' | 'S02' | 'S03' | 'S04' | 'S05'>

/**
 * The scenarios the database-free showcase can run. S06-S08 are deliberately
 * absent: their review, idempotency and replay behaviour is deferred, and the
 * API answers them with a redacted 503 rather than inventing semantics.
 *
 * The Overview header and the Showcase investigation page both read this list,
 * so the scenario a user picks in one is the scenario the other runs.
 */
export const showcaseScenarios: ReadonlyArray<{
  id: RunnableShowcaseScenarioId
  label: string
  description: string
}> = [
  { id: 'S01', label: 'S01 · Trusted pass', description: 'Deterministic clear route, no agent.' },
  { id: 'S02', label: 'S02 · High-risk hold', description: 'Hard deterministic control, no agent.' },
  { id: 'S03', label: 'S03 · APP-drain hold', description: 'Hard authorised-push-payment control, no agent.' },
  { id: 'S04', label: 'S04 · Ambiguous challenge', description: 'The one bounded investigation path.' },
  { id: 'S05', label: 'S05 · Outage hold', description: 'Deterministic failure, fail-safe hold.' },
]

/**
 * Narrow an untrusted value, such as a URL parameter, to a runnable scenario.
 *
 * Args:
 *   value: The candidate scenario identifier, or null when absent.
 *
 * Returns:
 *   The scenario identifier when it names a runnable scenario, otherwise null.
 */
export function toRunnableShowcaseScenario(value: string | null): RunnableShowcaseScenarioId | null {
  return showcaseScenarios.find((scenario) => scenario.id === value)?.id ?? null
}

/** The Showcase investigation route, with the scenario it should select. */
export function showcaseInvestigationHref(scenarioId: RunnableShowcaseScenarioId) {
  return `/transactions/investigation?scenario=${scenarioId}`
}
