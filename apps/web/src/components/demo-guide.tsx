import { CircleHelp, X } from "lucide-react"
import { Dialog } from "radix-ui"

import { Button } from "@/components/ui/button"

// The three steps of the demo, shown as reference in the help dialog and covered by the tour.
const demoSteps = [
  {
    title: "Choose a scenario",
    description: "Pick one of the synthetic S01–S05 payment paths from the scenario control in the header.",
  },
  {
    title: "Run the scenario",
    description: "Run opens Showcase investigation and plays back that scenario's recorded trace from the demo API.",
  },
  {
    title: "Inspect the results",
    description: "Read the route, evidence, and recommendation there. The Overview's figures come from a separate representative portfolio.",
  },
]

const overlayClass = "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0"
const contentClass =
  "fixed top-1/2 left-1/2 z-50 flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
const eyebrowClass = "text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase"

/**
 * The "How this demo works" dialog, and the button that opens it.
 *
 * Args:
 *   onStartTour: Called when the reader asks for the guided tour instead.
 */
export function DemoHelpDialog({ onStartTour }: { onStartTour: () => void }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <CircleHelp aria-hidden="true" className="size-3.5" />
          <span className="hidden sm:inline">How this demo works</span>
          <span className="sr-only sm:hidden">How this demo works</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content className={contentClass} aria-describedby="demo-help-description">
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className={eyebrowClass}>Guided demo</span>
              <Dialog.Title className="text-lg font-semibold">Explore the fraud decision workflow</Dialog.Title>
              <Dialog.Description id="demo-help-description" className="text-sm text-muted-foreground">
                This workspace uses representative data so you can inspect how a payment moves through a decision.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close demo guide">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </header>
          <ol className="flex flex-col gap-3">
            {demoSteps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                  {index + 1}
                </span>
                <div className="text-sm">
                  <strong className="font-medium">{step.title}</strong>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <footer className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted-foreground">Try another path any time with Reset in the header.</span>
            <Dialog.Close asChild>
              {/* Start after the dialog has finished closing so the page is clickable again. */}
              <Button variant="outline" onClick={() => window.setTimeout(onStartTour, 150)}>
                Take the tour
              </Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button>Got it</Button>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * The first-visit welcome dialog.
 *
 * Shown once per browser session. Answering it, in either direction, is remembered
 * so it does not come back on reload or navigation.
 *
 * Args:
 *   open: Whether the dialog is showing.
 *   onAnswer: Called for Skip, Escape, and Take the tour.
 *   onStartTour: Called after the dialog closes when the tour was accepted.
 */
export function DemoWelcomeDialog({
  open,
  onAnswer,
  onStartTour,
}: {
  open: boolean
  onAnswer: () => void
  onStartTour: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onAnswer() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content className={contentClass} aria-describedby="welcome-description">
          <header className="flex flex-col gap-1">
            <span className={eyebrowClass}>Synthetic data</span>
            <Dialog.Title className="text-lg font-semibold">Welcome to the payment risk demo</Dialog.Title>
            <Dialog.Description id="welcome-description" className="text-sm text-muted-foreground">
              See how a payment moves from signals to a simulated decision. Nothing here can approve, release, or
              execute a real payment.
            </Dialog.Description>
          </header>
          <footer className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted-foreground">The tour is also under “How this demo works”.</span>
            <Button variant="outline" onClick={onAnswer}>Skip</Button>
            <Button
              onClick={() => {
                onAnswer()
                // Start after the dialog has finished closing so the page is clickable again.
                window.setTimeout(onStartTour, 150)
              }}
            >
              Take the tour
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
