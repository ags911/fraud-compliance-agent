import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { SandboxFeedState } from "@/lib/useSandboxFeed"

type RadarLiveSwitchProps = {
  state: SandboxFeedState
  onStart: () => void
  onStop: () => void
}

const countFormatter = new Intl.NumberFormat("en-GB")

const HISTORY_HINT = "The figures show this scenario's imported Sandbox history. Switch Live on to add simulated payments."

/**
 * The short status beside the switch, the tooltip's longer explanation, and
 * the dot's tone. An automatic start that failed stays quiet: it reads as
 * history, with the reason in the tooltip (spec 0005, AC-4).
 */
function status(state: SandboxFeedState): { text: string; hint: string; tone: string } {
  switch (state.status) {
    case "unsupported":
      return { text: "", hint: "Workflow scenarios have no payment schedule to simulate.", tone: "unsupported" }
    case "idle":
      return { text: "Showing history", hint: HISTORY_HINT, tone: "idle" }
    case "starting":
      return { text: "Starting…", hint: "Starting the live feed.", tone: "idle" }
    case "live":
      return state.waitingForWorker
        ? {
            text: "Worker not running",
            hint: "No payments are arriving. Start the API with SIMULATION_WORKER_ENABLED=true, or run scripts/run_sandbox_simulation_worker.py.",
            tone: "busy",
          }
        : {
            text: `${countFormatter.format(state.run.appended_event_count)} / ${countFormatter.format(state.run.scheduled_event_count)}`,
            hint: "Simulated payments added so far, one every 3 seconds, on top of the imported history. Saved cases appear in the Cases tab.",
            tone: "live",
          }
    case "finished":
      return {
        text: `${state.run.state === "completed" ? "Finished" : "Stopped"} · ${countFormatter.format(state.run.appended_event_count)}`,
        hint: "Payments added by the last feed. Switch Live on again to start a fresh run from the imported history.",
        tone: "idle",
      }
    case "busy":
      return state.auto
        ? { text: "Showing history", hint: "The live feed is at its limit right now, so this shows the imported history.", tone: "idle" }
        : { text: "Busy", hint: "The live feed is at its limit. Try again in a minute.", tone: "busy" }
    case "unavailable":
      return state.auto
        ? { text: "Showing history", hint: "The live feed isn't available here, so this shows the imported history.", tone: "idle" }
        : {
            text: "Unavailable",
            hint: "The live feed needs the API with the Sandbox store configured, and site data allowed in this browser.",
            tone: "unavailable",
          }
  }
}

/**
 * The top bar's Live switch for the selected scenario (spec 0003): on starts a
 * feed of simulated payments over the imported data, off stops it. The feed
 * starts by itself unless switched off (spec 0005), and this is its only
 * control and status. The tooltip opens on hover and on keyboard focus.
 */
export function RadarLiveSwitch({ state, onStart, onStop }: RadarLiveSwitchProps) {
  const on = state.status === "starting" || state.status === "live"
  const note = status(state)
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="live-switch" data-state={state.status} data-tone={note.tone} id="radar-live-switch">
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
            <span className="live-status" aria-live="polite">{note.text}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent align="end" className="live-switch-hint" side="bottom" sideOffset={6}>
          {note.hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
