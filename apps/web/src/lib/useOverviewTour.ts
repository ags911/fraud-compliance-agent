import { useCallback, useEffect, useRef } from "react"
import { driver, type Driver } from "driver.js"
import "driver.js/dist/driver.css"

import type { DemoScenarioId } from "@/components/demo-session"

type TourProgress = {
  selectedScenario: DemoScenarioId | null
  activeScenario: DemoScenarioId | null
}

/**
 * Index of the tour step that matches the demo's real progress.
 *
 * Args:
 *   selectedScenario: The scenario chosen in the header, if any.
 *   activeScenario: The scenario that has actually been run, if any.
 *
 * Returns:
 *   0 to choose a scenario, 1 to run it, 2 to inspect the results. The final
 *   "Go deeper" step is only reached with Next.
 */
export function tourStepFor(selectedScenario: DemoScenarioId | null, activeScenario: DemoScenarioId | null) {
  if (activeScenario) return 2
  return selectedScenario ? 1 : 0
}

/**
 * An opt-in spotlight tour of the Overview demo, built on driver.js.
 *
 * The tour never starts by itself. Next and Back move between steps, and it also
 * follows what the user actually does: choosing a scenario moves it to "Run", and
 * running moves it to the results. The highlighted control stays
 * clickable, and the rest of the page is masked.
 *
 * Args:
 *   selectedScenario: The scenario chosen in the header, if any.
 *   activeScenario: The scenario that has actually been run, if any.
 *
 * Returns:
 *   start: Begin the tour at step 1.
 *   stop: End the tour.
 */
export function useOverviewTour({ selectedScenario, activeScenario }: TourProgress) {
  const tourRef = useRef<Driver | null>(null)
  const targetStep = tourStepFor(selectedScenario, activeScenario)

  // Keep the tour on the step that matches real progress, whichever way it moved
  // (choosing, running, or resetting the demo).
  useEffect(() => {
    const tour = tourRef.current
    if (tour?.isActive() && tour.getActiveIndex() !== targetStep) tour.moveTo(targetStep)
  }, [targetStep])

  const stop = useCallback(() => {
    tourRef.current?.destroy()
    tourRef.current = null
  }, [])

  // End the tour if the page unmounts while it is running.
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
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: "overview-tour",
      showProgress: true,
      progressText: "Step {{current}} of {{total}}",
      showButtons: ["next", "previous", "close"],
      nextBtnText: "Next",
      prevBtnText: "Back",
      steps: [
        {
          element: "#payments-demo-scenario-trigger",
          popover: {
            title: "Choose a scenario",
            description: "Open this menu and pick a payment path. Each one fills the dashboard with different demo decisions.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#payments-demo-run",
          popover: {
            title: "Run it",
            description: "Press Run to generate the decisions, the outcome mix, and the health signals for that scenario.",
            side: "left",
            align: "center",
          },
        },
        {
          element: () => document.getElementById("overview-results") ?? document.body,
          popover: {
            title: "Inspect the results",
            description: "The outcomes and recent decisions for your scenario appear here.",
            side: "top",
            align: "start",
          },
        },
        {
          element: "#overview-quick-actions",
          popover: {
            title: "Go deeper",
            description: "After a run, Analyse a transaction opens a live decision. Insights in the sidebar shows the benchmark evidence.",
            side: "top",
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
    // Always begin at step 1; later steps follow the user's actions.
    tour.drive()
  }, [stop])

  return { start, stop }
}
