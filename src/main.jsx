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

// Actualización forzada: si el servidor tiene una versión distinta a la que corre,
// se borran el service worker y la caché y se recarga (una sola vez por versión).
async function forceUpdate() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return
    const { build } = await r.json()
    const key = `cij-healed-${build}`
    if (build === __BUILD__ || sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []
    await Promise.all(regs.map((g) => g.unregister()))
    if (window.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
    location.reload()
  } catch {
    /* sin conexión: se usa la versión guardada */
  }
}
forceUpdate()
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && forceUpdate())
window.__forceUpdate = async () => {
  const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []
  await Promise.all(regs.map((g) => g.unregister()))
  if (window.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
  location.replace(`${location.pathname}?app=4&t=${Date.now()}`)
}

// Instalación como app: se guarda el aviso del navegador para el botón «Instalar» del menú.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__installPrompt = e
  window.dispatchEvent(new Event('cij-installable'))
})
window.addEventListener('appinstalled', () => {
  window.__installPrompt = null
  window.dispatchEvent(new Event('cij-installable'))
})

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
