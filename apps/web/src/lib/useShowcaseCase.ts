import { useCallback, useEffect, useState } from "react"

import { fetchShowcaseCase, type ShowcaseCaseResult } from "@/lib/showcase-cases"

export type ShowcaseCaseState = ShowcaseCaseResult | { status: "loading" } | { status: "error" }

// The result is stored with the request it answers, so a new case ID or a
// retry reads as "loading" until its own response arrives.
type Settled = { key: string; state: ShowcaseCaseState }

/**
 * Load one durable case for this browser, with a retry for unexpected errors.
 * With `enabled: false` nothing is requested (Radar's closed case drawer).
 */
export function useShowcaseCase(
  caseId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
): {
  state: ShowcaseCaseState
  retry: () => void
} {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const key = `${caseId ?? ""}#${attempt}`

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    fetchShowcaseCase(caseId ?? "", controller.signal).then(
      (result) => setSettled({ key, state: result }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setSettled({ key, state: { status: "error" } })
      },
    )
    return () => controller.abort()
  }, [caseId, enabled, key])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { state: settled?.key === key ? settled.state : { status: "loading" }, retry }
}
