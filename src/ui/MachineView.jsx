// Vista de la máquina: panel real con zoom + tutor (lecciones) + tarjeta de misión + cajón de la línea.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { Viewport } from './Viewport.jsx'
import { MACHINES } from '../machines/registry.jsx'
import { Coach, CoachRing } from './Coach.jsx'
import { MissionCard } from './MissionCard.jsx'
import LineDrawer from './LineDrawer.jsx'
import { targetKey, targetRegion, stepDrawer } from '../engine/training.js'
import { missionHintKey } from '../engine/missions.js'

function ZoomButton({ children, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[11px] font-bold ${active ? 'bg-sky-500 text-white' : 'bg-slate-700/80 text-slate-100'}`}
    >
      {children}
    </button>
  )
}

export default function MachineView() {
  const { state, dispatch } = useStore()
  const machine = MACHINES[state.ui.machine]
  const { layout, Panel } = machine
  const vp = useRef(null)
  const [view, setView] = useState({ zoomed: false })
  const [drawer, setDrawer] = useState(false)
  const [preset, setPreset] = useState('all')
  const [autoZoom, setAutoZoom] = useState(true)
  const [showHint, setShowHint] = useState(false)
  const [cardMin, setCardMin] = useState(false)

  const lessonKey = state.lesson && !state.lesson.completedAt ? targetKey(state) : null
  const hintKey = state.mission && !state.mission.completedAt && showHint ? missionHintKey(state) : null
  const highlight = lessonKey || hintKey
  const keyRect = useMemo(() => (highlight ? layout.keys.find((k) => k.id === highlight) : null), [highlight, layout])
  const region = state.lesson && !state.lesson.completedAt && !keyRect ? targetRegion(state) : null
  const regionRect = region ? layout.regions[region] : null
  const drawerFocus = stepDrawer(state)
  const stepIdx = state.lesson ? `${state.lesson.id}:${state.lesson.step}` : null
  // Abrir el cajón «Línea» automáticamente cuando el paso se hace en la máquina física
  useEffect(() => {
    if (drawerFocus) setDrawer(true)
  }, [drawerFocus, stepIdx])

  const zoomPreset = useCallback(
    (p) => {
      setPreset(p)
      if (p === 'all') vp.current?.reset()
      else vp.current?.zoomTo(layout.regions[p], { pad: 0.03 })
    },
    [layout],
  )

  const showKey = useCallback(() => {
    if (!keyRect) return
    // Ampliar una zona alrededor de la tecla (para ver también las vecinas)
    const r = layout.regions.keyboard
    const w = Math.min(r.w, Math.max(keyRect.w * 6, layout.width * 0.38))
    const h = w * 0.5
    vp.current?.zoomTo({ x: keyRect.x + keyRect.w / 2 - w / 2, y: keyRect.y + keyRect.h / 2 - h / 2, w, h }, { pad: 0 })
    setPreset(null)
  }, [keyRect, layout])

  // Zoom automático hacia la tecla indicada si no se ve bien
  useEffect(() => {
    if (!autoZoom || !keyRect || !vp.current) return
    const id = setTimeout(() => {
      if (!vp.current.isVisible(keyRect, 30)) showKey()
    }, 250)
    return () => clearTimeout(id)
  }, [keyRect, autoZoom, showKey])

  const onViewChange = useCallback((v) => setView(v), [])

  const mode = state.lesson ? 'lesson' : state.mission ? 'mission' : 'free'

  return (
    <div className="flex h-full w-full flex-col bg-[#0b1220]">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-slate-800 bg-[#0e1626] px-1.5 text-white">
        <button type="button" onClick={() => dispatch({ type: 'EXIT_TO_MENU' })} className="rounded-md bg-slate-700/80 px-2 py-1 text-[12px] font-bold">
          ☰ Menú
        </button>
        <div className="min-w-0 leading-none">
          <div className="truncate text-[12px] font-black">{machine.label}</div>
          <div className="truncate text-[10px] text-slate-400">
            {machine.tag} · {mode === 'lesson' ? 'Entrenamiento' : mode === 'mission' ? 'Misión' : 'Práctica libre'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ZoomButton active={preset === 'all'} onClick={() => zoomPreset('all')}>
            ⤢ Todo
          </ZoomButton>
          <ZoomButton active={preset === 'screen'} onClick={() => zoomPreset('screen')}>
            🖵 Pantalla
          </ZoomButton>
          <ZoomButton active={preset === 'keyboard'} onClick={() => zoomPreset('keyboard')}>
            ⌨ Teclado
          </ZoomButton>
          <ZoomButton active={drawer} onClick={() => setDrawer((d) => !d)}>
            ▤ Línea
          </ZoomButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {mode !== 'free' && !cardMin && (
          <div className="w-[36%] min-w-[230px] max-w-[340px] shrink-0 p-1">
            {mode === 'lesson' && <Coach autoZoom={autoZoom} setAutoZoom={setAutoZoom} onShowKey={showKey} hasKey={Boolean(keyRect)} onDrawer={drawerFocus ? () => setDrawer(true) : null} onMinimize={() => setCardMin(true)} />}
            {mode === 'mission' && <MissionCard showHint={showHint} setShowHint={setShowHint} onShowKey={showKey} hasKey={Boolean(keyRect)} onDrawer={() => setDrawer(true)} onMinimize={() => setCardMin(true)} />}
          </div>
        )}
      <div className="relative min-h-0 flex-1">
        {mode !== 'free' && cardMin && (
          <button type="button" onClick={() => setCardMin(false)} className={`absolute left-1 top-1 z-40 rounded-full px-3 py-1.5 text-[12px] font-bold text-white shadow-xl ${mode === 'lesson' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
            {mode === 'lesson' ? '🎓 Ver instrucción ▶' : '🎯 Ver misión ▶'}
          </button>
        )}
        <Viewport ref={vp} width={layout.width} height={layout.height} onViewChange={onViewChange} maxZoom={4.5}>
          <Panel />
          {keyRect && <CoachRing rect={keyRect} />}
          {regionRect && <CoachRing rect={regionRect} region />}
        </Viewport>

        <LineDrawer open={drawer} onClose={() => setDrawer(false)} focus={drawerFocus} />
      </div>
      </div>
    </div>
  )
}
