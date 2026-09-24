import { useEffect, useState } from "react"

import { checkShowcaseCaseSaved } from "@/lib/showcase-cases"

export type CaseSavedStatus = "checking" | "saved" | "not_saved" | "unavailable"

/**
 * Whether a finished run was saved as a durable case (spec 0002, AC-18).
 * Pass null until the run has finished; the check runs once per run ID.
 */
export function useCaseSavedStatus(finishedRunId: string | null): CaseSavedStatus | null {
  const [settled, setSettled] = useState<{ runId: string; status: CaseSavedStatus } | null>(null)

  useEffect(() => {
    if (!finishedRunId) return
    let active = true
    checkShowcaseCaseSaved(finishedRunId).then(
      (status) => {
        if (active) setSettled({ runId: finishedRunId, status })
      },
      () => {
        if (active) setSettled({ runId: finishedRunId, status: "unavailable" })
      },
    )
    return () => {
      active = false
    }
  }, [finishedRunId])

  if (!finishedRunId) return null
  return settled?.runId === finishedRunId ? settled.status : "checking"
}
