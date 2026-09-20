import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  ShowcaseEvent,
  ShowcaseExecutionMode,
  ShowcaseInvestigationResultEvent,
  ShowcaseInvestigationSkippedEvent,
  ShowcaseRouteResolvedEvent,
  ShowcaseRunResultEvent,
  ShowcaseRunStartedEvent,
  ShowcaseScenarioId,
  ShowcaseToolCallEvent,
  ShowcaseToolResultEvent,
} from '@/lib/showcase-types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8010'

/**
 * The API answers with two stable redacted codes only. The console never shows
 * a raw provider or framework error, so anything else falls back to one plain
 * message rather than surfacing an unexpected body.
 */
const SHOWCASE_ERROR_MESSAGES: Record<string, string> = {
  invalid_request: 'That synthetic scenario and mode combination is not available.',
  showcase_investigation_unavailable:
    'This synthetic scenario is not available in the current demonstration. Its operational behaviour is deferred.',
}

function userFacingError(code: string | undefined): string {
  return (
    SHOWCASE_ERROR_MESSAGES[code ?? ''] ??
    'The synthetic investigation could not start. No outcome is being reported.'
  )
}

const SHOWCASE_EVENT_NAMES = new Set([
  'run_started',
  'route_resolved',
  'investigation_skipped',
  'tool_call',
  'tool_result',
  'investigation_result',
  'run_result',
])

type ParsedMessage = { kind: 'event'; value: ShowcaseEvent } | { kind: 'done' }

/**
 * Parse the accepted wire format: default SSE message events carrying one JSON
 * object, terminated by a named `done` event whose data is `{}`.
 *
 * The request needs a JSON body, so this reads the response stream directly
 * rather than using EventSource, which is GET-only.
 */
async function* parseShowcaseSSE(response: Response): AsyncGenerator<ParsedMessage> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The synthetic investigation stream has no response body.')
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const lines = chunk.split('\n')
      const eventLine = lines.find((line) => line.startsWith('event:'))
      if (eventLine?.slice('event:'.length).trim() === 'done') {
        yield { kind: 'done' }
        continue
      }
      const dataLine = lines.find((line) => line.startsWith('data: '))
      if (!dataLine) continue
      const json = dataLine.slice('data: '.length)
      if (!json.trim() || json.trim() === '{}') continue

      let parsed: unknown
      try {
        parsed = JSON.parse(json)
      } catch {
        throw new Error('The synthetic investigation stream contained malformed JSON.')
      }
      // Only contract event names are accepted. An unknown name is treated as a
      // broken stream rather than rendered as if it were a product outcome.
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !SHOWCASE_EVENT_NAMES.has((parsed as { event?: unknown }).event as string)
      ) {
        throw new Error('The synthetic investigation stream contained an invalid event.')
      }
      yield { kind: 'event', value: parsed as ShowcaseEvent }
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    throw new Error('The synthetic investigation stream ended with an incomplete event.')
  }
}

export interface ShowcaseInvestigationState {
  status: 'idle' | 'running' | 'done' | 'cancelled' | 'error'
  runStarted: ShowcaseRunStartedEvent | null
  route: ShowcaseRouteResolvedEvent | null
  skipped: ShowcaseInvestigationSkippedEvent | null
  toolCalls: ShowcaseToolCallEvent[]
  toolResults: ShowcaseToolResultEvent[]
  investigation: ShowcaseInvestigationResultEvent | null
  runResult: ShowcaseRunResultEvent | null
  error: string | null
}

const IDLE_STATE: ShowcaseInvestigationState = {
  status: 'idle',
  runStarted: null,
  route: null,
  skipped: null,
  toolCalls: [],
  toolResults: [],
  investigation: null,
  runResult: null,
  error: null,
}

function reduceEvent(
  state: ShowcaseInvestigationState,
  event: ShowcaseEvent,
): ShowcaseInvestigationState {
  switch (event.event) {
    case 'run_started':
      return { ...state, runStarted: event }
    case 'route_resolved':
      return { ...state, route: event }
    case 'investigation_skipped':
      return { ...state, skipped: event }
    case 'tool_call':
      return { ...state, toolCalls: [...state.toolCalls, event] }
    case 'tool_result':
      return { ...state, toolResults: [...state.toolResults, event] }
    case 'investigation_result':
      return { ...state, investigation: event }
    case 'run_result':
      return { ...state, runResult: event }
  }
}

/**
 * Run one bounded synthetic showcase investigation and expose its typed events.
 *
 * The hook owns fetching and stream parsing so every view component stays
 * presentational. It reports a completed run only after the contract's terminal
 * `done` event, so a truncated stream can never look like a finished decision.
 */
export function useShowcaseInvestigation() {
  const [state, setState] = useState<ShowcaseInvestigationState>(IDLE_STATE)
  const runIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const consume = useCallback(async (response: Response, runId: number) => {
    if (!response.ok) {
      // The body carries the accepted redacted envelope; a missing or
      // unreadable body still yields a plain message, never a raw error.
      let code: string | undefined
      try {
        const body = (await response.json()) as { detail?: { code?: string } }
        code = body.detail?.code
      } catch {
        code = undefined
      }
      throw new Error(userFacingError(code))
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/event-stream')) {
      throw new Error('The synthetic investigation returned an unexpected response.')
    }

    let terminalEventReceived = false
    for await (const message of parseShowcaseSSE(response)) {
      if (runIdRef.current !== runId) return
      if (message.kind === 'done') {
        terminalEventReceived = true
        break
      }
      setState((prev) => reduceEvent(prev, message.value))
    }

    if (!terminalEventReceived) {
      throw new Error('The synthetic investigation ended before completion.')
    }
    if (runIdRef.current === runId) setState((prev) => ({ ...prev, status: 'done' }))
  }, [])

  const start = useCallback(
    async (scenarioId: ShowcaseScenarioId, executionMode: ShowcaseExecutionMode) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const runId = ++runIdRef.current
      setState({ ...IDLE_STATE, status: 'running' })

      try {
        const response = await fetch(`${API_BASE_URL}/showcase/investigations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario_id: scenarioId, execution_mode: executionMode }),
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
          error: err instanceof Error ? err.message : 'Connection failed.',
        }))
      } finally {
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [consume],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  return { ...state, start, cancel }
}
