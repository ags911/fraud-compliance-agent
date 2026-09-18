import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shadcn-defaults.css'
import './overview.css'
import ProductApp from './ProductApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProductApp />
  </StrictMode>,
)
