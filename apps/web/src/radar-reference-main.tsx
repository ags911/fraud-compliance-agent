import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./shadcn-defaults.css"
// Loaded after shadcn-defaults.css so its :root overrides win the cascade --
// see its own header comment for why RadarTopbarControls needs retheming here.
import "./references/radar-controls-theme.css"
import { NetworkMark } from "@/components/averlynx-logo"

import { RadarChart } from "./references/RadarChart"
import { RadarTopbarControls } from "./references/RadarTopbarControls"

// The rest of references/radar-reference.html is plain static markup (an
// exact copy of the mockup artifact, deliberately not using this app's
// design system). These are the mounted islands in it: a real Recharts chart
// standing in for the original's hand-drawn, buggy gridlines, the app's own
// NetworkMark logo standing in for the topbar's former "Radar" page title,
// and a search input + scenario select in the topbar's actions area.
createRoot(document.getElementById("radar-chart-root")!).render(
  <StrictMode>
    <RadarChart />
  </StrictMode>,
)

createRoot(document.getElementById("radar-brand-icon-root")!).render(
  <StrictMode>
    <NetworkMark className="size-4 shrink-0" />
  </StrictMode>,
)

createRoot(document.getElementById("radar-topbar-controls-root")!).render(
  <StrictMode>
    <RadarTopbarControls />
  </StrictMode>,
)
