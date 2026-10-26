import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App'
import { STORAGE_KEY } from './store/AppStore'

// Demo reset link: any URL with ?reset starts the demo fresh (same as Demo settings → Reset demo) and opens Detect.
// A normal or hard refresh keeps progress; the browser can't tell those two apart.
if (new URLSearchParams(window.location.search).has('reset')) {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable: nothing to clear */
  }
  window.history.replaceState(null, '', `${import.meta.env.BASE_URL}detect`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
