import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shadcn-defaults.css'
import './overview.css'
// Scoped to the Overview route's data-app-theme attribute, so it restyles nothing else.
import './dashboard-theme.css'
import ProductApp from './ProductApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProductApp />
  </StrictMode>,
)
