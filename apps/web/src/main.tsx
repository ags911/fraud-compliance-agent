import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./shadcn-defaults.css"
// Loaded after shadcn-defaults.css so its :root overrides win the cascade --
// see its own header comment for why ConsoleTopbarControls needs retheming here.
import "./console/console-controls-theme.css"
import { RiskConsole } from "./console/RiskConsole"

createRoot(document.getElementById("console-root")!).render(
  <StrictMode>
    <RiskConsole />
  </StrictMode>,
)
