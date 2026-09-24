import { useCallback, useEffect, useRef, useState } from "react"

import { isShowcaseCaseId } from "@/lib/showcase-cases"

const PARAM = "case"

function readCaseParam(): string | null {
  const value = new URLSearchParams(window.location.search).get(PARAM)
  return isShowcaseCaseId(value ?? undefined) ? value : null
}

function urlWithCase(href: string, caseId: string | null): string {
  const url = new URL(href)
  if (caseId) url.searchParams.set(PARAM, caseId)
  else url.searchParams.delete(PARAM)
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Mirror the open case into the top level /radar URL, so refreshing or
 * sharing it reopens the same case. Radar runs in a same origin iframe; the
 * parent's React Router ignores replaceState (it fires no event), and keeping
 * `history.state` leaves its own entry bookkeeping untouched.
 */
function mirrorToTop(caseId: string | null) {
  try {
    if (window.top === window || !window.top) return
    const top = window.top
    top.history.replaceState(top.history.state, "", urlWithCase(top.location.href, caseId))
  } catch {
    // A cross origin parent (not this app): the frame's own URL still works.
  }
}

/**
 * The case open in Radar's drawer, kept in `?case=<id>`.
 *
 * Opening pushes a history entry, so browser Back closes the drawer; closing
 * a drawer this page opened goes back through that entry, while closing one
 * that arrived from a shared link replaces the URL instead of leaving Radar.
 */
export function useRadarCaseParam(): {
  caseId: string | null
  openCase: (caseId: string) => void
  closeCase: () => void
} {
  const [caseId, setCaseId] = useState<string | null>(readCaseParam)
  // Whether the current ?case entry was pushed by this page (so Back is safe).
  const pushed = useRef(false)

  useEffect(() => {
    const onPopState = () => {
      pushed.current = false
      const next = readCaseParam()
      setCaseId(next)
      mirrorToTop(next)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const openCase = useCallback((next: string) => {
    if (!isShowcaseCaseId(next)) return
    if (readCaseParam() === next) return
    window.history.pushState(window.history.state, "", urlWithCase(window.location.href, next))
    pushed.current = true
    setCaseId(next)
    mirrorToTop(next)
  }, [])

  const closeCase = useCallback(() => {
    if (!readCaseParam()) return
    if (pushed.current) {
      // popstate then clears the case and the top URL.
      window.history.back()
      return
    }
    window.history.replaceState(window.history.state, "", urlWithCase(window.location.href, null))
    setCaseId(null)
    mirrorToTop(null)
  }, [])

  return { caseId, openCase, closeCase }
}
