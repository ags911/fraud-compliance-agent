import { useCallback, useState } from "react"

// The routing board is shown by default (spec 0006 AC 9); hiding it is
// remembered for this browser. Blocked storage falls back to shown.
const HIDDEN_PREFERENCE_KEY = "radar-routing-board-hidden"

function boardHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_PREFERENCE_KEY) === "1"
  } catch {
    return false
  }
}

function rememberBoardHidden(hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(HIDDEN_PREFERENCE_KEY, "1")
    else window.localStorage.removeItem(HIDDEN_PREFERENCE_KEY)
  } catch {
    // A display preference only; without storage the default applies.
  }
}

/** Whether the viewer has hidden the routing board, and a setter that remembers it. */
export function useRoutingBoardHidden(): [boolean, (hidden: boolean) => void] {
  const [hidden, setHiddenState] = useState(boardHidden)
  const setHidden = useCallback((next: boolean) => {
    rememberBoardHidden(next)
    setHiddenState(next)
  }, [])
  return [hidden, setHidden]
}
