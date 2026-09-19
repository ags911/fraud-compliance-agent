import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeName, RunFormState, StreamEvent } from '@/lib/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8010'

const DEMO_ERROR_MESSAGES: Record<string, string> = {
  processing_failed: 'The simulated decision trace could not finish. Try the preset again or choose another demo path.',
  processing_timeout: 'The simulated decision trace took too long and was stopped safely. No completed outcome is being reported.',
  demo_pipeline_unavailable: 'The simulated decision pipeline is unavailable in this environment. The benchmark view remains read-only.',
}

function userFacingRunError(error: string | undefined): string {
  return DEMO_ERROR_MESSAGES[error ?? ''] ?? 'The simulated decision trace could not finish. No completed outcome is being reported.'
}

/**
 * The run request needs a JSON body (the transaction form), so this uses
 * fetch() + a ReadableStream reader rather than the native EventSource
 * (which is GET-only) to consume the backend's text/event-stream response.
 */
type ParsedSSEMessage =
  | { kind: 'event'; value: StreamEvent }
  | { kind: 'done' }

async function* parseSSE(response: Response): AsyncGenerator<ParsedSSEMessage> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Decision stream has no response body')
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const eventLine = chunk.split('\n').find((line) => line.startsWith('event:'))
      if (eventLine?.slice('event:'.length).trim() === 'done') {
        yield { kind: 'done' }
        continue
      }
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '))
      if (!dataLine) continue
      const json = dataLine.slice('data: '.length)
      if (!json.trim() || json.trim() === '{}') continue
      try {
        const value = JSON.parse(json) as StreamEvent
        if (!value || typeof value !== 'object' || typeof value.node !== 'string') {
          throw new Error('Decision stream contained an invalid event')
        }
        yield { kind: 'event', value }
      } catch {
        throw new Error('Decision stream contained malformed JSON')
      }
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) throw new Error('Decision stream ended with an incomplete event')
}

export type AgentRunState = {
  status: 'idle' | 'running' | 'done' | 'cancelled' | 'error'
  events: Partial<Record<NodeName, StreamEvent>>
  error: string | null
}

export function useAgentRun() {
  const [state, setState] = useState<AgentRunState>({
    status: 'idle',
    events: {},
    error: null,
  })
  const runIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const consume = useCallback(async (response: Response, runId: number) => {
    if (!response.ok) throw new Error(`Decision run failed (HTTP ${response.status})`)
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/event-stream')) {
      throw new Error('Decision run returned an unexpected response')
    }

    let terminalEventReceived = false
    for await (const message of parseSSE(response)) {
      if (runIdRef.current !== runId) return
      if (message.kind === 'done') {
        terminalEventReceived = true
        break
      }
      const event = message.value
      if (event.node === 'error') {
        throw new Error(userFacingRunError(event.error))
      }
      setState((prev) => ({
        ...prev,
        events: { ...prev.events, [event.node]: event },
      }))
    }

    if (!terminalEventReceived) {
      throw new Error('Decision stream ended before completion')
    }
    if (runIdRef.current === runId) setState((prev) => ({ ...prev, status: 'done' }))
  }, [])

  const startRun = useCallback(async (url: string, body: unknown) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const runId = ++runIdRef.current
    setState({ status: 'running', events: {}, error: null })

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      await consume(response, runId)
    } catch (err) {
      if (runIdRef.current !== runId) return
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState((prev) => ({ ...prev, status: 'cancelled', error: null }))
        return
      }
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Connection failed',
      }))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [consume])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  const runPreset = useCallback(
    async (scenarioId: string, simulateLlmOutage: boolean) => {
      await startRun(`${API_BASE_URL}/run/preset/${encodeURIComponent(scenarioId)}`, {
        simulate_llm_outage: simulateLlmOutage,
      })
    },
    [startRun],
  )

  const run = useCallback(
    async (form: RunFormState) => {
      await startRun(`${API_BASE_URL}/run`, form)
    },
    [startRun],
  )

  return { ...state, run, runPreset, cancel }
}

export async function fetchScenarios() {
  const response = await fetch(`${API_BASE_URL}/scenarios`)
  if (!response.ok) throw new Error('Failed to load scenarios')
  return (await response.json()) as { id: string; label: string }[]
}
