import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./shadcn-defaults.css"
import RulesPerformanceReference from "./references/RulesPerformanceReference"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RulesPerformanceReference />
  </StrictMode>,
)
