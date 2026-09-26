import { useCallback, useEffect, useRef } from "react"
import { driver, type Driver } from "driver.js"
import "driver.js/dist/driver.css"

/**
 * An opt in spotlight tour of Radar (spec 0007), built on driver.js with the
 * same options as the Overview tour (`useOverviewTour`).
 *
 * The tour never starts by itself and steps through with Next and Back only:
 * nothing on Radar has to happen in order. Each step describes only what Radar
 * has today; later stages add their own steps when they ship. The highlighted
 * control stays usable, and the rest of the page is masked.
 *
 * Returns:
 *   start: Begin the tour at step 1.
 *   stop: End the tour.
 */
export function useRadarTour() {
  const tourRef = useRef<Driver | null>(null)

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
      overlayColor: "#000000",
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: "radar-tour",
      showProgress: true,
      progressText: "Step {{current}} of {{total}}",
      showButtons: ["next", "previous", "close"],
      nextBtnText: "Next",
      prevBtnText: "Back",
      steps: [
        {
          element: "#radar-scenario-trigger",
          popover: {
            title: "Choose a scenario",
            description: "Each scenario is a synthetic payment path, S01 to S05. The whole dashboard follows the one you pick.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#radar-live-switch",
          popover: {
            title: "The live feed",
            description:
              "On by default: a simulated payment lands every 3 seconds on top of the scenario's imported Sandbox history. Switch it off to see the history only; the status tooltip explains what it is doing.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#radar-run-showcase",
          popover: {
            title: "Run showcase",
            description: "Replays this scenario's recorded investigation. Its result is saved as a case.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#radar-cases-tab",
          popover: {
            title: "Cases",
            description:
              "HOLD and CHALLENGE payments from the feed, and showcase runs, are saved here. Open one to see its route and evidence; cases are read only. The Model tab shows benchmark results, which never decide a payment.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#radar-summary",
          popover: {
            title: "Scenario figures",
            description: "Sanitised Sandbox totals for the selected days. They count up while the feed runs.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#radar-recommendations",
          popover: {
            title: "Recommendations over time",
            description:
              "Every outbound payment, decided by the scenario's deterministic rule. No model score decides anything.",
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
    tour.drive()
  }, [stop])

  return { start, stop }
}
