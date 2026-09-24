import { useCallback, useEffect, useState } from "react"

import {
  checkShowcaseCaseSaved,
  fetchShowcaseCases,
  type ShowcaseCaseFilters,
  type ShowcaseCaseSummary,
  type ShowcaseCaseTotals,
} from "@/lib/showcase-cases"

export type SavedState = "saved" | "not_saved" | "unavailable"

export type ShowcaseCasesState =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "ready"
      items: ShowcaseCaseSummary[]
      totals: ShowcaseCaseTotals
      nextCursor: string | null
      loadingMore: boolean
    }

// A loaded result is stored with the request it answers, so a filter change
// or refresh reads as "loading" until its own first page arrives.
type Settled = { key: string; state: ShowcaseCasesState }

/**
 * This browser's durable cases for the Radar Cases tab: the first page for
 * the current filters, "Show more" paging, and a saved check per finished run.
 */
export function useShowcaseCases(filters: ShowcaseCaseFilters) {
  const [reload, setReload] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const [savedStates, setSavedStates] = useState<Record<string, SavedState>>({})
  const key = `${filters.scenarioId ?? ""}|${filters.recommendation ?? ""}|${reload}`

  useEffect(() => {
    const controller = new AbortController()
    fetchShowcaseCases(filters, null, controller.signal).then(
      (result) =>
        setSettled({
          key,
          state:
            result.status === "ok"
              ? {
                  status: "ready",
                  items: result.page.items,
                  totals: result.page.totals,
                  nextCursor: result.page.next_cursor,
                  loadingMore: false,
                }
              : { status: "unavailable" },
        }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setSettled({ key, state: { status: "unavailable" } })
      },
    )
    return () => controller.abort()
    // `key` already encodes the filters and the reload counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const state: ShowcaseCasesState = settled?.key === key ? settled.state : { status: "loading" }

  const loadMore = useCallback(() => {
    const current = settled?.key === key ? settled.state : null
    if (!current || current.status !== "ready" || !current.nextCursor || current.loadingMore) return
    const requestKey = key
    const cursor = current.nextCursor
    // Only the pure state change happens in the updaters; the request starts
    // once, here, so development double invocation never fetches twice.
    setSettled((latest) =>
      latest && latest.key === requestKey && latest.state.status === "ready"
        ? { key: requestKey, state: { ...latest.state, loadingMore: true } }
        : latest,
    )
    void fetchShowcaseCases(filters, cursor).then((result) =>
      setSettled((latest) => {
        // Ignore a page that arrives after the filters changed or a refresh.
        if (!latest || latest.key !== requestKey || latest.state.status !== "ready") return latest
        if (result.status !== "ok") return { key: requestKey, state: { ...latest.state, loadingMore: false } }
        return {
          key: requestKey,
          state: {
            ...latest.state,
            items: [...latest.state.items, ...result.page.items],
            nextCursor: result.page.next_cursor,
            loadingMore: false,
          },
        }
      }),
    )
  }, [settled, key, filters])

  /** After a run finishes: record whether it was saved, then refresh the list. */
  const trackRun = useCallback((runId: string) => {
    void checkShowcaseCaseSaved(runId).then((saved) => {
      setSavedStates((current) => ({ ...current, [runId]: saved }))
      setReload((value) => value + 1)
    })
  }, [])

  /** Reload the first page, e.g. when the Cases tab opens (cases may come from other pages). */
  const refresh = useCallback(() => setReload((value) => value + 1), [])

  return { state, savedStates, loadMore, trackRun, refresh }
}
