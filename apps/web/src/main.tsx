import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shadcn-defaults.css'
import './overview.css'
// Overrides shadcn-defaults.css's palette with the app-wide theme; must load after it.
import './app-theme.css'
import ProductApp from './ProductApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProductApp />
  </StrictMode>,
)
