import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './state/store.jsx'
import { ModalProvider } from './components/Modals.jsx'
import { FocusProvider } from './components/Fields.jsx'
import { TopBar, LeftKeys, RightKeys, useNavKeys } from './components/Chassis.jsx'
import MissionsPanel from './components/MissionsPanel.jsx'
import { MainMenu, Standby } from './screens/MainMenu.jsx'
import Production from './screens/Production.jsx'
import Edit from './screens/Edit.jsx'
import Prep from './screens/Prep.jsx'
import OpVars from './screens/OpVars.jsx'
import { modelInfo } from './engine/sim.js'
import { missionById } from './engine/missions.js'

function useLandscape() {
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

function ScreenRouter() {
  const { state } = useStore()
  switch (state.nav.menu) {
    case 'STANDBY':
      return <Standby />
    case 'PROD':
      return <Production />
    case 'EDIT':
      return <Edit />
    case 'PREP':
      return <Prep />
    case 'OPVAR':
      return <OpVars />
    default:
      return <MainMenu />
  }
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
  return <div className={`pointer-events-none absolute bottom-2 left-1/2 z-[60] max-w-[70%] -translate-x-1/2 rounded px-3 py-1 text-[12px] font-semibold shadow-lg ${color}`}>{t.text}</div>
}

function MissionCelebration() {
  const { state } = useStore()
  const done = state.mission?.completedAt
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!done || Date.now() - done > 3000) return
    setShow(true)
    const id = setTimeout(() => setShow(false), 3500)
    return () => clearTimeout(id)
  }, [done])
  if (!show) return null
  const m = missionById(state.mission.id)
  return (
    <div className="pointer-events-none absolute inset-0 z-[55] flex items-center justify-center">
      <div className="pop rounded-xl border-2 border-emerald-300 bg-emerald-700/95 px-6 py-3 text-center text-white shadow-2xl">
        <div className="text-2xl">🏆</div>
        <div className="text-base font-black">MISIÓN {String(m.id).padStart(2, '0')} COMPLETADA</div>
        <div className="text-[12px]">{m.title}</div>
      </div>
    </div>
  )
}

function Shell() {
  const { state } = useStore()
  const portrait = useLandscape()
  const [missions, setMissions] = useState(false)
  const { key } = useNavKeys()
  const theme = modelInfo(state).lcd

  // teclado físico (PC / teclado bluetooth)
  useEffect(() => {
    const map = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Enter: 'ENTER', Escape: 'ESC' }
    const h = (e) => {
      if (map[e.key]) {
        e.preventDefault()
        key(map[e.key])
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // En vertical se gira la interfaz 90° para trabajar siempre en horizontal.
  const rot = portrait
    ? { width: '100dvh', height: '100dvw', transform: 'rotate(90deg) translateY(-100%)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }
    : { width: '100dvw', height: '100dvh' }

  return (
    <div style={rot} className="relative flex flex-col overflow-hidden bg-[var(--chassis)] pl-[var(--safe-l)] pr-[var(--safe-r)]">
      <TopBar onMissions={() => setMissions(true)} />
      <div className="flex min-h-0 flex-1 gap-1.5 px-1.5 pb-1.5">
        <LeftKeys />
        <div className="relative min-w-0 flex-1 rounded-md border-[5px] border-[#0d141c] shadow-[inset_0_0_12px_rgba(0,0,0,.5)]">
          <div className={`scr ${theme === 'classic' ? 'classic' : theme === '9040' ? 'm9040' : ''} relative h-full w-full overflow-hidden rounded-sm`}>
            <ModalProvider>
              <FocusProvider>
                <ScreenRouter />
              </FocusProvider>
            </ModalProvider>
          </div>
        </div>
        <RightKeys onMissions={() => setMissions(true)} />
      </div>
      <MissionsPanel open={missions} onClose={() => setMissions(false)} />
      <MissionCelebration />
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
