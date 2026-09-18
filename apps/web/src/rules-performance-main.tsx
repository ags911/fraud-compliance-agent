import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shadcn-defaults.css'
import RulesPerformance from './RulesPerformance'

createRoot(document.getElementById('root')!).render(<StrictMode><RulesPerformance /></StrictMode>)
