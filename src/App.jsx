import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './state/store.jsx'
import Home from './ui/Home.jsx'
import MachineView from './ui/MachineView.jsx'
import { LessonsScreen, MissionsScreen, HelpScreen } from './ui/Lists.jsx'
import { FIRMWARE } from './machines/firmware.js'

function usePortrait() {
  const q = () => window.matchMedia('(orientation: portrait)').matches
  const [portrait, setPortrait] = useState(q)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const h = () => setPortrait(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return portrait
}

function Toast() {
  const { state } = useStore()
  const t = state.toast
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!t) return
    setVisible(true)
    const id = setTimeout(() => setVisible(false), 2600)
    return () => clearTimeout(id)
  }, [t?.t])
  if (!t || !visible) return null
  const color = t.kind === 'warn' ? 'bg-amber-500 text-slate-900' : t.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'
  return <div className={`pointer-events-none absolute left-1/2 top-10 z-[60] max-w-[70%] -translate-x-1/2 rounded px-3 py-1 text-[12px] font-semibold shadow-lg ${color}`}>{t.text}</div>
}

function Router() {
  const { state } = useStore()
  switch (state.ui.screen) {
    case 'MACHINE':
      return <MachineView />
    case 'LESSONS':
      return <LessonsScreen />
    case 'CODIF':
      return <LessonsScreen group="codif" />
    case 'MISSIONS':
      return <MissionsScreen />
    case 'HELP':
      return <HelpScreen />
    default:
      return <Home />
  }
}

function Shell() {
  const { state, dispatch } = useStore()
  const portrait = usePortrait()

  // Teclado del PC / teclado bluetooth → teclas de la máquina
  useEffect(() => {
    if (state.ui.screen !== 'MACHINE') return
    const fw = FIRMWARE[state.ui.machine]
    const h = (e) => {
      if (e.target.closest?.('input,textarea,select')) return
      const key = fw.fromKeyboard?.(e)
      if (key) {
        e.preventDefault()
        dispatch({ type: 'KEY', key })
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [state.ui.screen, state.ui.machine, dispatch])

  // En vertical se gira la interfaz 90° para trabajar siempre en horizontal.
  const rot = portrait
    ? { width: '100dvh', height: '100dvw', transform: 'rotate(90deg) translateY(-100%)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }
    : { width: '100dvw', height: '100dvh' }

  return (
    <div style={rot} className="relative overflow-hidden bg-[#0b1220] pl-[var(--safe-l)] pr-[var(--safe-r)]">
      <Router />
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
