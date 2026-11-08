import './style.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { isMobile } from '$backend'

// Global hook for phone-only styles, including overlays rendered outside the layout.
if (isMobile) document.documentElement.classList.add('mobile')

const app = mount(App, {
  target: document.getElementById('app')!
})

export default app
