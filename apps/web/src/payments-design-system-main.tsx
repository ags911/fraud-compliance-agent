import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./shadcn-defaults.css"
import PaymentsDesignSystem from "./PaymentsDesignSystem"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PaymentsDesignSystem />
  </StrictMode>
)
