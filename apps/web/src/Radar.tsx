import { useState } from "react"

/**
 * /radar embeds the RADAR-AGENT Overview mockup artifact exactly as given —
 * unmodified HTML/CSS, none of it adapted to this app's design system. It
 * lives as its own static Vite entry (references/radar-reference.html, same
 * pattern as the other frozen reference pages) and is embedded here via an
 * iframe so the SPA route can reach it without app-theme.css or any other
 * app-wide CSS bleeding into it (or its own styles bleeding out).
 *
 * A shared or refreshed /radar?case=<id> link is handed to the frame once, on
 * load; the frame keeps /radar's URL in step itself, so the src never changes
 * (changing it would reload the whole dashboard).
 */
export default function RadarPage() {
  const [src] = useState(() => {
    const caseId = new URLSearchParams(window.location.search).get("case")
    return caseId
      ? `/references/radar-reference.html?case=${encodeURIComponent(caseId)}`
      : "/references/radar-reference.html"
  })
  return <iframe title="RADAR-AGENT Overview" src={src} className="h-screen w-full border-0" />
}
