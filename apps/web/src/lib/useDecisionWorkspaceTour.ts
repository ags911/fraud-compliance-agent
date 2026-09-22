import { useCallback, useEffect, useRef } from "react"
import { driver, type Driver } from "driver.js"
import "driver.js/dist/driver.css"

/** An opt-in guide to the simulated decision workspace's evidence flow. */
export function useDecisionWorkspaceTour() {
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
      overlayColor: "#0b0b0b",
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
        { element: "#decision-scenario-controls", popover: { title: "Choose a simulated path", description: "Presets are fixed synthetic scenarios. Custom input uses a disclosed synthetic baseline and never submits a payment.", side: "right", align: "start" } },
        { element: "#decision-trace", popover: { title: "Follow the decision flow", description: "The trace shows deterministic controls, an APP-scam assessment, any required explanation, and evidence packaging in the order returned by the API.", side: "bottom", align: "start" } },
        { element: "#decision-record", popover: { title: "Inspect the audit record", description: "The record is demonstration metadata only. Signature presence does not claim that verification was performed.", side: "left", align: "start", doneBtnText: "Finish" } },
      ],
      onDestroyed: () => { tourRef.current = null },
    })
    tourRef.current = tour
    tour.drive()
  }, [stop])

  return { start, stop }
}
