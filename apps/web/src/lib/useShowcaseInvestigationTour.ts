import { useCallback, useEffect, useRef } from "react"
import { driver, type Driver } from "driver.js"
import "driver.js/dist/driver.css"

/**
 * An opt-in guide to the bounded synthetic investigation.
 *
 * It opens on the demo API's status, because the API runs on scale-to-zero
 * compute: the first run after an idle period waits for a cold start, and a
 * reader who does not know that would read the wait as a fault.
 */
export function useShowcaseInvestigationTour() {
  const tourRef = useRef<Driver | null>(null)

  const stop = useCallback(() => {
    tourRef.current?.destroy()
    tourRef.current = null
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    stop()
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const tour = driver({
      animate: !reduceMotion,
      smoothScroll: !reduceMotion,
      allowClose: true,
      allowKeyboardControl: true,
      overlayColor: "#0a2540",
      overlayOpacity: 0.5,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: "decision-workspace-tour",
      showProgress: true,
      progressText: "Step {{current}} of {{total}}",
      showButtons: ["next", "previous", "close"],
      nextBtnText: "Next",
      prevBtnText: "Back",
      steps: [
        {
          element: "[data-testid='api-health']",
          popover: {
            title: "Check the demo API first",
            description:
              "This shows what a liveness check actually found, not an assumed status. The demo API scales to zero, so the first run after an idle period waits for a cold start. A wake-up is shown as waking, never as an outage.",
            side: "top",
            align: "start",
          },
        },
        {
          element: "#showcase-scenario-controls",
          popover: {
            title: "Pick a synthetic scenario",
            description:
              "Every scenario is fixture data. Recorded playback replays an accepted trace; a requested live run falls back to recorded playback whenever its safety controls say so, and the trace says which you got.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "#showcase-trace",
          popover: {
            title: "Follow the evidence",
            description:
              "Deterministic scenarios visibly skip the agent. An investigated scenario lists each tool call, the evidence it returned, and the evidence each finding cites. Authority is never evaluated and no action is executed.",
            side: "left",
            align: "start",
          },
        },
        {
          element: "[data-testid='explain-decision']",
          popover: {
            title: "Ask about this run",
            description:
              "Explain is a preview that answers only from the events this run produced and names its source. It refuses anything it cannot ground in the run, and no language model is connected.",
            side: "left",
            align: "start",
            doneBtnText: "Finish",
          },
        },
      ],
      onDestroyed: () => {
        tourRef.current = null
      },
    })
    tourRef.current = tour
    tour.drive()
  }, [stop])

  return { start, stop }
}
