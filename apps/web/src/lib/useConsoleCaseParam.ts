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
 * The case open in Risk Console's drawer, kept in `?case=<id>`.
 *
 * Opening pushes a history entry, so browser Back closes the drawer; closing
 * a drawer this page opened goes back through that entry, while closing one
 * that arrived from a shared link replaces the URL instead of leaving the console.
 */
export function useConsoleCaseParam(): {
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
  }, [])

  const closeCase = useCallback(() => {
    if (!readCaseParam()) return
    if (pushed.current) {
      // popstate then clears the case.
      window.history.back()
      return
    }
    window.history.replaceState(window.history.state, "", urlWithCase(window.location.href, null))
    setCaseId(null)
  }, [])

  return { caseId, openCase, closeCase }
}
