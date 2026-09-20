import { useState, type FormEvent } from 'react'
import { SendHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ShowcaseInvestigationState } from '@/lib/useShowcaseInvestigation'

interface Answer {
  text: string
  source: string
}

interface Question {
  id: string
  label: string
  keywords: readonly string[]
  answer: (run: ShowcaseInvestigationState) => Answer
}

const MODE_DESCRIPTIONS = {
  recorded: 'recorded playback of an accepted synthetic trace',
  live: 'a live model run',
} as const

const FALLBACK_DESCRIPTIONS = {
  live_disabled: 'live mode is switched off',
  admission_limited: 'the live demonstration limit was reached',
  provider_unavailable: 'the live provider was unavailable',
} as const

/**
 * Every answer is assembled from the events this run actually emitted, and
 * cites the surface the reader can check it against. No language model is
 * called, nothing is inferred, and anything outside the run is refused.
 */
const questions: readonly Question[] = [
  {
    id: 'recommendation',
    label: 'What was recommended, and why?',
    keywords: ['recommend', 'why', 'outcome', 'decision', 'result'],
    answer: (run) => {
      const investigation = run.investigation
      if (!investigation) {
        const deterministic = run.runResult
        return {
          text: deterministic
            ? `${deterministic.recommendation} was the deterministic route for this scenario, so no agent ran. Authority was not evaluated and no action was simulated.`
            : 'This run produced no recommendation.',
          source: 'Investigation trace',
        }
      }
      const basis =
        investigation.recommendation_basis === 'fail_safe'
          ? 'a fail-safe response to an incomplete investigation, not an evidence-based conclusion'
          : 'grounded in the evidence listed above'
      return {
        text: `${investigation.recommendation}, ${basis}. ${investigation.summary}`,
        source: 'Investigation trace',
      }
    },
  },
  {
    id: 'evidence',
    label: 'What evidence was used?',
    keywords: ['evidence', 'tool', 'source', 'data', 'fact'],
    answer: (run) => {
      const items = run.toolResults.flatMap((result) => result.evidence)
      if (items.length === 0) {
        return {
          text: 'No evidence was returned in this run, so nothing here rests on evidence.',
          source: 'Investigation trace',
        }
      }
      const listed = items.map((item) => `${item.evidence_id} (${item.display_value})`).join('; ')
      return {
        text: `${items.length} synthetic fixture item(s) across ${run.toolCalls.length} tool call(s): ${listed}.`,
        source: 'Investigation trace evidence',
      }
    },
  },
  {
    id: 'citations',
    label: 'Is every claim backed by evidence?',
    keywords: ['claim', 'cite', 'citation', 'back', 'support', 'ground'],
    answer: (run) => {
      const claims = run.investigation?.claims ?? []
      if (claims.length === 0) {
        return {
          text: 'This run made no claims, so there is nothing to back. An incomplete investigation states no findings.',
          source: 'Investigation trace',
        }
      }
      const returnedIds = new Set(run.toolResults.flatMap((result) => result.evidence.map((item) => item.evidence_id)))
      // A claim is only shown as supported when its citation was returned by a
      // tool during this same run; anything else is reported as unsupported.
      const unsupported = claims.filter((claim) => !claim.evidence_ids.every((id) => returnedIds.has(id)))
      return {
        text:
          unsupported.length === 0
            ? `Yes. All ${claims.length} claim(s) cite evidence returned during this run: ${claims
                .map((claim) => `${claim.claim_id} → ${claim.evidence_ids.join(', ')}`)
                .join('; ')}.`
            : `No. ${unsupported.length} of ${claims.length} claim(s) cite evidence this run did not return.`,
        source: 'Investigation trace findings',
      }
    },
  },
  {
    id: 'mode',
    label: 'Was this recorded or live?',
    keywords: ['recorded', 'live', 'mode', 'model', 'provider', 'real'],
    answer: (run) => {
      const started = run.runStarted
      if (!started) return { text: 'This run did not report an execution mode.', source: 'Investigation trace' }
      const provider =
        started.execution_mode === 'live' && started.provider
          ? ` The provider was ${started.provider}${started.model_id ? ` running ${started.model_id}` : ''}.`
          : ''
      const fallback = started.fallback_reason
        ? ` It was requested as ${started.requested_mode}, but ${FALLBACK_DESCRIPTIONS[started.fallback_reason]}.`
        : ''
      return {
        text: `This was ${MODE_DESCRIPTIONS[started.execution_mode]}.${fallback}${provider} All data is synthetic.`,
        source: 'Execution mode label',
      }
    },
  },
  {
    id: 'authority',
    label: 'Could this approve or release a payment?',
    keywords: ['approve', 'release', 'execute', 'authority', 'action', 'payment', 'pay'],
    answer: () => ({
      text: 'No. Authority is not evaluated on this surface and the simulated action is always none. The agent can recommend; it cannot decide authority or move money.',
      source: 'Authority and simulated action',
    }),
  },
]

const GREETING = 'I explain this run using only the events it produced. Pick a question, or type one.'

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  source?: string
}

/**
 * A preview panel that explains one showcase investigation from its own events.
 *
 * It answers only from what the run emitted and names the surface each answer
 * came from. Anything it cannot ground in this run is refused rather than
 * guessed, and no model is connected.
 */
export function ExplainDecision({ run }: { run: ShowcaseInvestigationState }) {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: 'assistant', text: GREETING }])
  const [draft, setDraft] = useState('')
  // Only a finished run can be explained; a partial stream has no settled facts.
  const answerable = run.status === 'done'

  function ask(text: string, question?: Question) {
    const asked = text.trim()
    if (!asked) return
    const words = asked.toLowerCase()
    const match = question ?? questions.find((candidate) => candidate.keywords.some((keyword) => words.includes(keyword)))

    let reply: Omit<Message, 'id' | 'role'>
    if (!answerable) {
      reply = { text: 'Run an investigation first. I only answer from the events a completed run produced.' }
    } else if (match) {
      reply = match.answer(run)
    } else {
      reply = { text: 'I can only answer about this run. Try one of the suggested questions.' }
    }
    setMessages((current) => [
      ...current,
      { id: current.length, role: 'user', text: asked },
      { id: current.length + 1, role: 'assistant', ...reply },
    ])
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    ask(draft)
    setDraft('')
  }

  return (
    <section aria-label="Explain this decision" className="flex flex-col" data-testid="explain-decision">
      <div role="log" aria-label="Explanation" aria-live="polite" className="flex flex-col gap-3 pb-3">
        {messages.map((message) => (
          <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start gap-1'}>
            <div
              className={
                message.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground'
                  : 'max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2 text-sm'
              }
            >
              <span className="sr-only">{message.role === 'user' ? 'You: ' : 'Explain: '}</span>
              {message.text}
            </div>
            {message.source ? (
              <span className="payments-type-support px-1 text-muted-foreground">Source: {message.source}</span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
          {questions.map((question) => (
            <Button
              key={question.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal py-1.5 text-left"
              disabled={!answerable}
              onClick={() => ask(question.label, question)}
            >
              {question.label}
            </Button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="explain-decision-input" className="sr-only">
            Ask about this run
          </label>
          <textarea
            id="explain-decision-input"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                ask(draft)
                setDraft('')
              }
            }}
            placeholder={answerable ? 'Ask about this run' : 'Run an investigation to ask'}
            disabled={!answerable}
            className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <Button type="submit" size="icon" aria-label="Send" disabled={!answerable || !draft.trim()}>
            <SendHorizontal aria-hidden="true" />
          </Button>
        </form>
        <p className="payments-type-support text-muted-foreground">
          Preview. Answers are built from this run's events and the accepted contract. No language model is connected.
        </p>
      </div>
    </section>
  )
}
