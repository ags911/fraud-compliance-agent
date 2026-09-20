import { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8010'

/**
 * How long a probe may run before it is reported as a cold start rather than a
 * normal check. The demo API is deployed to scale-to-zero compute, so the first
 * request after an idle period pays container start-up before it answers.
 */
const COLD_START_AFTER_MS = 1200

export type ApiHealthStatus = 'checking' | 'waking' | 'ready' | 'unavailable'

export interface ApiHealthState {
  status: ApiHealthStatus
  /** True once a probe has taken long enough to be a cold start, until it settles. */
  coldStart: boolean
}

export const API_HEALTH_LABELS: Record<ApiHealthStatus, string> = {
  checking: 'Checking demo API',
  waking: 'Waking the demo API',
  ready: 'Demo API ready',
  unavailable: 'Demo API unavailable',
}

/**
 * Probe the demo API's liveness endpoint and report a truthful status.
 *
 * The console shows what the probe actually found. It never claims health it
 * has not observed, and it distinguishes a slow cold start from an outage so a
 * scale-to-zero wake-up is not reported as a failure.
 */
export function useApiHealth(): ApiHealthState & { recheck: () => void } {
  const [state, setState] = useState<ApiHealthState>({ status: 'checking', coldStart: false })
  const probeIdRef = useRef(0)

  const probe = useCallback(() => {
    const probeId = ++probeIdRef.current
    setState({ status: 'checking', coldStart: false })

    // A probe that has not answered yet is reported as a wake-up rather than
    // left looking stalled, because scale-to-zero start-up is expected here.
    const coldStartTimer = window.setTimeout(() => {
      if (probeIdRef.current === probeId) {
        setState({ status: 'waking', coldStart: true })
      }
    }, COLD_START_AFTER_MS)

    void (async () => {
      let nextStatus: ApiHealthStatus = 'unavailable'
      try {
        const response = await fetch(`${API_BASE_URL}/health`, { headers: { Accept: 'application/json' } })
        if (response.ok) {
          const body = (await response.json()) as { status?: string }
          nextStatus = body.status === 'ok' ? 'ready' : 'unavailable'
        }
      } catch {
        nextStatus = 'unavailable'
      } finally {
        window.clearTimeout(coldStartTimer)
      }
      if (probeIdRef.current !== probeId) return
      setState((prev) => ({ status: nextStatus, coldStart: prev.coldStart }))
    })()
  }, [])

  useEffect(() => {
    probe()
    // A probe in flight when the component unmounts must not set state after it.
    return () => {
      probeIdRef.current += 1
    }
  }, [probe])

  return { ...state, recheck: probe }
}
