import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Si algo falla al arrancar (p. ej. datos guardados de una versión anterior),
// en vez de quedar una pantalla negra que "no responde" se ofrece reiniciar.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  reset = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('cij'))
        .forEach((k) => localStorage.removeItem(k))
    } catch {
      /* sin almacenamiento */
    }
    location.reload()
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ color: '#fff', padding: 24, fontFamily: 'system-ui', textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>La aplicación tuvo un problema al abrir</h2>
        <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>{String(this.state.error?.message || this.state.error)}</p>
        <button type="button" onClick={this.reset} style={{ background: '#0ea5e9', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 15, fontWeight: 700 }}>
          Reiniciar datos y volver a abrir
        </button>
      </div>
    )
  }
}

// Pantalla completa al primer toque (sólo cuando corre instalada como app).
function enterFullscreenOnce() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
  const el = document.documentElement
  if (standalone && !document.fullscreenElement && el.requestFullscreen) {
    el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
  }
}
window.addEventListener('pointerdown', enterFullscreenOnce, { once: true })

// Cuando se publica una versión nueva, el service worker la activa y la app se recarga sola
// (sólo si ya había una versión controlando la página: no en la primera visita).
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
