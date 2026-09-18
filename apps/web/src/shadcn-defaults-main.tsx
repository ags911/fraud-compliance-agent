import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shadcn-defaults.css'
import ShadcnDefaults from './ShadcnDefaults'

createRoot(document.getElementById('root')!).render(<StrictMode><ShadcnDefaults /></StrictMode>)
