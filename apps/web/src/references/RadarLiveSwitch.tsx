import { Switch } from "@/components/ui/switch"
import type { SandboxFeedState } from "@/lib/useSandboxFeed"

type RadarLiveSwitchProps = {
  state: SandboxFeedState
  onStart: () => void
  onStop: () => void
}

const countFormatter = new Intl.NumberFormat("en-GB")

/** A short status beside the switch; the hint is the longer explanation. */
function status(state: SandboxFeedState): { text: string; hint: string } | null {
  switch (state.status) {
    case "unsupported":
      return { text: "", hint: "Workflow scenarios have no payment schedule to simulate." }
    case "idle":
      return null
    case "starting":
      return { text: "Starting…", hint: "Starting the live feed." }
    case "live":
      return state.waitingForWorker
        ? {
            text: "Worker not running",
            hint: "Start the API with SIMULATION_WORKER_ENABLED=true (or run scripts/run_sandbox_simulation_worker.py) to add payments.",
          }
        : {
            text: `${countFormatter.format(state.run.appended_event_count)} / ${countFormatter.format(state.run.scheduled_event_count)}`,
            hint: "Simulated payments added so far, one every 3 seconds, on top of the imported data.",
          }
    case "finished":
      return {
        text: `${state.run.state === "completed" ? "Finished" : "Stopped"} · ${countFormatter.format(state.run.appended_event_count)}`,
        hint: "Payments added by the last feed. Switching Live on again starts from the imported data.",
      }
    case "busy":
      return { text: "Busy", hint: "The live feed is at its limit right now. Try again in a minute." }
    case "unavailable":
      return { text: "Unavailable", hint: "The live feed needs the API with the Sandbox store configured, and site data allowed in this browser." }
  }
}

/**
 * The top bar's Live switch for the selected scenario (spec 0003): on starts a
 * feed of simulated payments over the imported data, off stops it. It sits
 * beside the scenario selector because a feed belongs to that scenario.
 */
export function RadarLiveSwitch({ state, onStart, onStop }: RadarLiveSwitchProps) {
  const on = state.status === "starting" || state.status === "live"
  const note = status(state)
  return (
    <div className="live-switch" data-state={state.status} title={note?.hint}>
      <label className="live-switch-label">
        <Switch
          aria-label="Live feed"
          checked={on}
          disabled={state.status === "unsupported" || state.status === "starting"}
          onCheckedChange={(checked) => (checked ? onStart() : onStop())}
          size="sm"
        />
        <span className="live-dot" aria-hidden="true" />
        Live
      </label>
      <span className="live-status" aria-live="polite">{note?.text}</span>
    </div>
  )
}
