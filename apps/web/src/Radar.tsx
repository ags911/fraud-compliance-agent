/**
 * /radar embeds the RADAR-AGENT Overview mockup artifact exactly as given —
 * unmodified HTML/CSS, none of it adapted to this app's design system. It
 * lives as its own static Vite entry (references/radar-reference.html, same
 * pattern as the other frozen reference pages) and is embedded here via an
 * iframe so the SPA route can reach it without app-theme.css or any other
 * app-wide CSS bleeding into it (or its own styles bleeding out).
 */
export default function RadarPage() {
  return (
    <iframe
      title="RADAR-AGENT Overview"
      src="/references/radar-reference.html"
      className="h-screen w-full border-0"
    />
  )
}
