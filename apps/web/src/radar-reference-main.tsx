import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./shadcn-defaults.css"
// Loaded after shadcn-defaults.css so its :root overrides win the cascade --
// see its own header comment for why RadarTopbarControls needs retheming here.
import "./references/radar-controls-theme.css"
import { RadarReference } from "./references/RadarReference"

createRoot(document.getElementById("radar-reference-root")!).render(
  <StrictMode>
    <RadarReference />
  </StrictMode>,
)
