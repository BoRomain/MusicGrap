import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@romain/uilib/style.css'
import './style.css'
import { isMobile } from '$backend'
import { App } from './App'

// Global hook for phone-only styles, including overlays rendered outside the layout.
if (isMobile) document.documentElement.classList.add('mobile')

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
