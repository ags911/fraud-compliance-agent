import { Button } from "@/components/ui/button"
import type { SandboxFeedState } from "@/lib/useSandboxFeed"

type RadarFeedBarProps = {
  scenarioId: string
  state: SandboxFeedState
  onStart: () => void
  onStop: () => void
}

const countFormatter = new Intl.NumberFormat("en-GB")

function payments(count: number): string {
  return `${countFormatter.format(count)} ${count === 1 ? "payment" : "payments"}`
}

/**
 * The Scenario tab's live feed control (spec 0003). A feed adds simulated
 * payments on top of the imported Sandbox data for this view only; the
 * dataset itself is never changed, so every feed starts from the same base.
 */
export function RadarFeedBar({ scenarioId, state, onStart, onStop }: RadarFeedBarProps) {
  let label: string
  let copy: string
  let action: { text: string; onClick: () => void; disabled?: boolean } | null = null

  switch (state.status) {
    case "unsupported":
      label = "No live feed"
      copy = `${scenarioId} is a workflow scenario, so it has no payment schedule to simulate.`
      break
    case "idle":
      label = "Live feed"
      copy = `Adds a simulated ${scenarioId} payment every 3 seconds for 10 minutes, on top of the imported data. The dataset itself is not changed.`
      action = { text: "Start live feed", onClick: onStart }
      break
    case "starting":
      label = "Live feed"
      copy = "Starting the feed…"
      action = { text: "Starting…", onClick: onStart, disabled: true }
      break
    case "live":
      label = "Live"
      copy = state.waitingForWorker
        ? "Waiting for the simulation worker. Start it in apps/api with: doppler run -- uv run python scripts/run_sandbox_simulation_worker.py"
        : `${payments(state.run.appended_event_count)} added of ${countFormatter.format(state.run.scheduled_event_count)}.`
      action = { text: "Stop", onClick: onStop }
      break
    case "finished":
      label = state.run.state === "completed" ? "Feed finished" : "Feed stopped"
      copy = `${payments(state.run.appended_event_count)} added. Starting again begins from the imported data.`
      action = { text: "Start again", onClick: onStart }
      break
    case "unavailable":
      label = "Live feed unavailable"
      copy = "The feed needs the local API with the Sandbox store configured."
      action = { text: "Try again", onClick: onStart }
      break
  }

  return (
    <section className="feed-bar" aria-label="Live feed" data-state={state.status}>
      <span className="feed-dot" aria-hidden="true" />
      <div className="feed-text" aria-live="polite">
        <span className="feed-label">{label}</span>
        <span className="feed-copy">{copy}</span>
      </div>
      {action ? (
        <Button
          className="feed-action"
          disabled={action.disabled}
          onClick={action.onClick}
          size="sm"
          variant={state.status === "live" ? "outline" : "default"}
        >
          {action.text}
        </Button>
      ) : null}
    </section>
  )
}
