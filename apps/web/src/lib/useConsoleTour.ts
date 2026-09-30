import { useCallback, useEffect, useRef } from "react"
import { driver, type Driver } from "driver.js"
import "driver.js/dist/driver.css"

// The tour starts by itself once per browser (spec 0007 AC-1, amended
// 2026-09-30). Blocked storage reads as not seen, so the tour offers itself
// again rather than never.
const SEEN_KEY = "console-tour-seen"

/** Whether this browser has already been shown the tour. */
export function consoleTourSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1"
  } catch {
    return false
  }
}

function rememberTourSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1")
  } catch {
    // A convenience only; without storage the tour may offer itself again.
  }
}

/**
 * A spotlight tour of Risk Console (spec 0007), built on driver.js with the
 * same options as the Overview tour (`useOverviewTour`).
 *
 * The console starts it once for a new browser; the help icon replays it. It
 * steps through with Next and Back only, and every step but the last offers
 * "Skip tour": nothing on Risk Console has to happen in order. Each step describes only what Risk Console
 * has today; later stages add their own steps when they ship. The highlighted
 * control stays usable, and the rest of the page is masked.
 *
 * Returns:
 *   start: Begin the tour at step 1.
 *   stop: End the tour.
 */
export function useConsoleTour() {
  const tourRef = useRef<Driver | null>(null)

  const stop = useCallback(() => {
    tourRef.current?.destroy()
    tourRef.current = null
  }, [])

  // End the tour if the page unmounts while it is running.
  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    stop()
    rememberTourSeen()
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
      popoverClass: "console-tour",
      showProgress: true,
      progressText: "Step {{current}} of {{total}}",
      showButtons: ["next", "previous", "close"],
      nextBtnText: "Next",
      prevBtnText: "Back",
      steps: [
        {
          element: "#console-scenario-trigger",
          popover: {
            title: "Choose a scenario",
            description: "Each scenario is a synthetic payment path, S01 to S05. The whole dashboard follows the one you pick.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#console-live-switch",
          popover: {
            title: "The live feed",
            description:
              "On by default: a simulated payment lands every 3 seconds on top of the scenario's imported Sandbox history. Switch it off to see the history only; the status tooltip explains what it is doing.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#console-run-showcase",
          popover: {
            title: "Run showcase",
            description: "Replays this scenario's recorded investigation. Its result is saved as a case.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#console-cases-tab",
          popover: {
            title: "Cases",
            description:
              "HOLD and CHALLENGE payments from the feed, and showcase runs, are saved here. Open one to see its route and evidence; cases are read only. The Model tab shows benchmark results, which never decide a payment.",
            side: "bottom",
            align: "start",
          },
        },
        {
          // No highlight: the routing board sits on the Cases tab (spec 0010 AC 13).
          popover: {
            title: "Raised by model",
            description:
              "The rules clear a payment first. The model can still raise a cleared payment to CHALLENGE or HOLD, and the routing board on the Cases tab counts these as Raised by model. The score comes from Sparkov synthetic data: a mechanics demo, not a fraud probability.",
          },
        },
        {
          element: "#console-summary",
          popover: {
            title: "Scenario figures",
            description: "Sanitised Sandbox totals for the selected days. They count up while the feed runs.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#console-recommendations",
          popover: {
            title: "Recommendations over time",
            description:
              "Every outbound payment, decided by the scenario's deterministic rule. The model can only raise a live feed payment the rules cleared.",
            side: "top",
            align: "start",
            doneBtnText: "Finish",
          },
        },
      ],
      // "Skip tour" ends the tour from any step; the last step has Finish.
      onPopoverRender: (popover, { driver: tour }) => {
        if (tour.isLastStep()) return
        const skip = document.createElement("button")
        skip.type = "button"
        skip.className = "console-tour-skip"
        skip.textContent = "Skip tour"
        skip.addEventListener("click", () => tour.destroy())
        popover.footerButtons.prepend(skip)
      },
      onDestroyed: () => {
        tourRef.current = null
      },
    })
    tourRef.current = tour
    tour.drive()
  }, [stop])

  return { start, stop }
}
