import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./shadcn-defaults.css"
import "./overview.css"
import Overview from "./Overview"

// The Payments Overview, kept as a frozen design reference page. The product
// Overview is the dashboard route in ProductApp.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Overview />
  </StrictMode>,
)
