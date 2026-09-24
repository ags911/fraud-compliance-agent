import { useCallback, useEffect, useState } from "react"

import {
  checkShowcaseCaseSaved,
  fetchShowcaseCases,
  type ShowcaseCaseFilters,
  type ShowcaseCasePage,
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

/** Whether case `a` sorts after case `b` in the API's newest first order. */
function isOlder(a: ShowcaseCaseSummary, b: ShowcaseCaseSummary): boolean {
  const difference = Date.parse(a.completed_at) - Date.parse(b.completed_at)
  return difference < 0 || (difference === 0 && a.case_id < b.case_id)
}

/**
 * Fold a freshly fetched first page into the list on screen. Pages the viewer
 * already pulled in with "Show more" are kept (the rows older than the new
 * first page), with their cursor, so a quiet poll never shrinks the list.
 */
function firstPageInto(
  current: { items: ShowcaseCaseSummary[]; nextCursor: string | null } | null,
  page: ShowcaseCasePage,
): { items: ShowcaseCaseSummary[]; nextCursor: string | null } {
  const fresh = page.items
  const last = fresh[fresh.length - 1]
  const pagedFurther = current !== null && page.next_cursor !== null && current.items.length > fresh.length
  if (!pagedFurther || !last) return { items: fresh, nextCursor: page.next_cursor }
  const freshIds = new Set(fresh.map((item) => item.case_id))
  const older = current.items.filter((item) => !freshIds.has(item.case_id) && isOlder(item, last))
  return { items: [...fresh, ...older], nextCursor: current.nextCursor }
}

/**
 * This browser's durable cases for the Radar Cases tab: the first page for
 * the current filters, "Show more" paging, and a saved check per finished run.
 */
export function useShowcaseCases(filters: ShowcaseCaseFilters) {
  const [reload, setReload] = useState(0)
  // A quiet refetch: the current rows stay on screen until the new page lands.
  const [poll, setPoll] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const [savedStates, setSavedStates] = useState<Record<string, SavedState>>({})
  const key = `${filters.scenarioId ?? ""}|${filters.recommendation ?? ""}|${reload}`

  useEffect(() => {
    const controller = new AbortController()
    fetchShowcaseCases(filters, null, controller.signal).then(
      (result) =>
        setSettled((previous) => {
          // A quiet poll answers the same request as the list on screen.
          const current = previous?.key === key && previous.state.status === "ready" ? previous.state : null
          if (result.status !== "ok") {
            // One failed poll keeps the list rather than flipping to the fallback.
            return current ? previous : { key, state: { status: "unavailable" } }
          }
          // A "Show more" request is in flight on this list; let it land, the next poll catches up.
          if (current?.loadingMore) return previous
          return { key, state: { status: "ready", totals: result.page.totals, loadingMore: false, ...firstPageInto(current, result.page) } }
        }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setSettled((previous) =>
          previous?.key === key && previous.state.status === "ready" ? previous : { key, state: { status: "unavailable" } },
        )
      },
    )
    return () => controller.abort()
    // `key` encodes every request input (the filters and the reload counter);
    // `poll` only triggers a refetch of the same request, so it is not read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, poll])

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
        const shownIds = new Set(latest.state.items.map((item) => item.case_id))
        return {
          key: requestKey,
          state: {
            ...latest.state,
            // A quiet poll may already have shown some of these rows.
            items: [
              ...latest.state.items,
              ...result.page.items.filter((item) => !shownIds.has(item.case_id)),
            ],
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

  /** Refetch the first page without a loading state, e.g. while a live feed saves cases. */
  const pollQuietly = useCallback(() => setPoll((value) => value + 1), [])

  return { state, savedStates, loadMore, trackRun, refresh, pollQuietly }
}
