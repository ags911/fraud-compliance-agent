import { useEffect, useRef, useState, type FormEvent } from "react"
import { SendHorizontal, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { scenarioResults } from "@/lib/overview-data"

type ScenarioResult = (typeof scenarioResults)[keyof typeof scenarioResults]

type Message = { id: number; role: "user" | "assistant"; text: string; source?: string }

type Question = {
  id: string
  label: string
  keywords: readonly string[]
  answer: (result: ScenarioResult) => { text: string; source: string }
}

// Every answer is built from the figures already on the page. No language model is called,
// and nothing here is invented: if the page does not show it, the answer says so.
const questions: readonly Question[] = [
  {
    id: "held",
    label: "Why is the held rate what it is?",
    keywords: ["held", "hold", "rate", "block"],
    answer: (result) => {
      const held = result.outcomes.find((outcome) => outcome.label === "Held")
      const total = result.kpis.find((kpi) => kpi.label === "Transactions")?.value
      return {
        text: `${held?.count} of ${total} transactions were held (${held?.share}), worth ${held?.value}. Held is the route the demo assigned to them. The demo does not publish score thresholds, so I can't say where the boundary sits.`,
        source: "Decision outcomes",
      }
    },
  },
  {
    id: "queue",
    label: "What is in the review queue?",
    keywords: ["review", "queue", "oldest", "case"],
    answer: (result) => ({
      text: `The review queue holds ${result.kpis.find((kpi) => kpi.label === "Review queue")?.value} case(s), and the oldest has waited ${result.oldestReview}.`,
      source: "Review queue",
    }),
  },
  {
    id: "risk",
    label: "Which decision has the highest risk?",
    keywords: ["risk", "highest", "riskiest", "top", "worst"],
    answer: (result) => {
      const top = [...result.decisions].sort((a, b) => Number.parseFloat(b.risk) - Number.parseFloat(a.risk))[0]
      return {
        text: `${top.id} (${top.customer}, ${top.amount}) scored ${top.risk} and was routed ${top.route}. Primary reason: ${top.reason}.`,
        source: "Recent decisions",
      }
    },
  },
  {
    id: "health",
    label: "Is the model performing well?",
    keywords: ["model", "perform", "accurate", "accuracy", "false", "positive", "drift", "health"],
    answer: (result) => ({
      text: `I can't say. The estimated false-positive rate is Unavailable, because labelled outcomes are required to calculate it. What the page does show: model fraud-risk-v4.2, drift Stable, and p95 scoring latency ${result.latency}.`,
      source: "Operational health",
    }),
  },
]

const greeting = "Hi. I explain the figures on this page. Pick a question, or type one."

/**
 * A chat-style panel that explains the dashboard's own figures.
 *
 * Args:
 *   result: The scenario result currently shown, or null before a scenario has run.
 *
 * Returns:
 *   The panel. Answers are deterministic and cite the card they came from; there is no model.
 */
export function DashboardChat({ result }: { result: ScenarioResult | null }) {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "assistant", text: greeting }])
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages])

  function ask(text: string, question?: Question) {
    const asked = text.trim()
    if (!asked) return
    const words = asked.toLowerCase()
    const match = question ?? questions.find((candidate) => candidate.keywords.some((keyword) => words.includes(keyword)))

    let reply: Omit<Message, "id" | "role">
    if (!result) {
      reply = { text: "Load the portfolio first. I only answer from the figures the page is showing." }
    } else if (match) {
      reply = match.answer(result)
    } else {
      reply = { text: "I can only answer questions about the figures on this page. Try one of the suggested questions." }
    }
    setMessages((current) => [
      ...current,
      { id: current.length, role: "user", text: asked },
      { id: current.length + 1, role: "assistant", ...reply },
    ])
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    ask(draft)
    setDraft("")
  }

  return (
    <section aria-label="Explain" className="flex h-full min-h-0 flex-col">
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg border bg-card">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-medium">Explain</h2>
            <p className="text-xs text-muted-foreground">Answers from this page's figures</p>
          </div>
        </div>
        <Badge variant="outline">Preview</Badge>
      </header>

      <div role="log" aria-label="Conversation" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-1"}>
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[92%] rounded-2xl rounded-bl-md border bg-card px-3 py-2 text-sm"
              }
            >
              <span className="sr-only">{message.role === "user" ? "You: " : "Explain: "}</span>
              {message.text}
            </div>
            {message.source ? <span className="px-1 text-xs text-muted-foreground">Source: {message.source}</span> : null}
          </div>
        ))}
        <div ref={end} />
      </div>

      <div className="flex flex-col gap-3 border-t p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
          {questions.map((question) => (
            <Button
              key={question.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal py-1.5 text-left"
              disabled={!result}
              onClick={() => ask(question.label, question)}
            >
              {question.label}
            </Button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="explain-input" className="sr-only">Ask about this page</label>
          <textarea
            id="explain-input"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                ask(draft)
                setDraft("")
              }
            }}
            placeholder={result ? "Ask about this page" : "Load the portfolio to ask"}
            disabled={!result}
            className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <Button type="submit" size="icon" aria-label="Send" disabled={!result || !draft.trim()}>
            <SendHorizontal aria-hidden="true" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">Preview. Answers are built from the figures on this page. No language model is connected.</p>
      </div>
    </section>
  )
}
