// Chasis de la interfaz operador: barra superior con indicadores luminosos,
// teclas de acceso directo (izquierda) y teclado de edición (derecha).
import { useEffect, useState } from 'react'
import { useStore, pressKey } from '../state/store.jsx'
import { canPrint, blockingFaults, modelInfo } from '../engine/sim.js'
import { rtcNow, formatClock } from '../engine/rtc.js'
import { MODELS } from '../engine/defaults.js'
import { missionById } from '../engine/missions.js'

function HwKey({ label, sub, icon, onPress, color = '', className = '', title }) {
  return (
    <button
      type="button"
      title={title || label}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress()
        if (navigator.vibrate) navigator.vibrate(8)
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`hwkey ${color} min-h-0 select-none ${className}`}
    >
      {icon && <span className="text-[15px] leading-none">{icon}</span>}
      <span className="text-[9px] leading-[1.05] tracking-tight">{label}</span>
      {sub && <span className="text-[7.5px] font-semibold opacity-70">{sub}</span>}
    </button>
  )
}

export function useNavKeys() {
  const { state, dispatch } = useStore()
  const nav = (menu, tab = 0, view = null) => dispatch({ type: 'NAV', menu, tab, view })
  const key = (k) => {
    if (pressKey(k)) return
    if (k === 'ESC') {
      if (state.nav.menu === 'HOME') nav('STANDBY')
      else nav('HOME')
    }
  }
  return { key, nav }
}

export function LeftKeys() {
  const { state, dispatch } = useStore()
  const { nav } = useNavKeys()
  const faults = Object.keys(state.faults).length
  return (
    <div className="grid w-[58px] shrink-0 grid-rows-7 gap-[5px] py-[2px]">
      <HwKey icon="⏻" label="MARCHA" sub="PARADA" color={state.power === 'OFF' ? 'green' : 'red'} onPress={() => dispatch({ type: 'POWER_TOGGLE' })} />
      <HwKey icon="⚠" label="DEFECTOS" color={faults ? 'amber' : ''} className={faults ? 'animate-pulse' : ''} onPress={() => nav('PROD', 4, 'faults')} />
      <HwKey icon="✉" label="MENSAJE" sub="selección" onPress={() => nav('PROD', 1, 'select')} />
      <HwKey
        icon="⚙"
        label="PARÁM."
        sub="mensaje"
        onPress={() => {
          dispatch({ type: 'EDIT_OPEN', name: state.activeMessage })
          nav('EDIT', 3, 'edit-params')
        }}
      />
      <HwKey icon="#" label="CONTADOR" onPress={() => nav('PROD', 1, 'select')} />
      <HwKey icon={state.paused ? '▶' : '⏸'} label="PAUSA" color={state.paused ? 'amber' : ''} onPress={() => dispatch({ type: 'PAUSE_TOGGLE' })} />
      <HwKey icon="💧" label="CHORRO" sub="manten." onPress={() => nav('PROD', 2, 'status')} />
    </div>
  )
}

export function RightKeys({ onMissions }) {
  const { state, dispatch } = useStore()
  const { key, nav } = useNavKeys()
  return (
    <div className="flex w-[118px] shrink-0 flex-col gap-[5px] py-[2px]">
      <div className="grid flex-[3] grid-cols-3 grid-rows-3 gap-[4px]">
        <HwKey label="MENÚ" color="blue" onPress={() => nav('HOME')} className="!text-[8px]" />
        <HwKey icon="▲" label="" onPress={() => key('UP')} />
        <HwKey label="F6" sub="var.op" onPress={() => nav('OPVAR', 0, 'opvars')} />
        <HwKey icon="◄" label="" onPress={() => key('LEFT')} />
        <HwKey icon="↵" label="ENTER" color="green" onPress={() => key('ENTER')} />
        <HwKey icon="►" label="" onPress={() => key('RIGHT')} />
        <HwKey label="ESC" color="red" onPress={() => key('ESC')} />
        <HwKey icon="▼" label="" onPress={() => key('DOWN')} />
        <HwKey label="CTRL+P" sub="impr." onPress={() => dispatch({ type: 'MANUAL_PRINT' })} />
      </div>
      <button type="button" onClick={onMissions} className="hwkey amber flex-1 !flex-row gap-1 px-1">
        <span className="text-lg">🎯</span>
        <span className="text-left text-[10px] leading-tight">
          MISIONES
          <br />
          <span className="font-semibold opacity-80">{Object.keys(state.progress).length}/15 ✓</span>
        </span>
      </button>
    </div>
  )
}

function useFullscreen() {
  const [fs, setFs] = useState(Boolean(document.fullscreenElement))
  useEffect(() => {
    const h = () => setFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  const toggle = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        await screen.orientation?.lock?.('landscape').catch(() => {})
      } else await document.exitFullscreen()
    } catch {
      /* no soportado (iOS): usar «Añadir a pantalla de inicio» */
    }
  }
  return { fs, toggle, supported: Boolean(document.documentElement.requestFullscreen) }
}

function useInstallPrompt() {
  const [evt, setEvt] = useState(null)
  useEffect(() => {
    const h = (e) => {
      e.preventDefault()
      setEvt(e)
    }
    window.addEventListener('beforeinstallprompt', h)
    window.addEventListener('appinstalled', () => setEvt(null))
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  return evt
    ? async () => {
        evt.prompt()
        await evt.userChoice.catch(() => {})
        setEvt(null)
      }
    : null
}

export function TopBar({ onMissions }) {
  const { state, dispatch } = useStore()
  const { fs, toggle, supported } = useFullscreen()
  const install = useInstallPrompt()
  const blocking = blockingFaults(state).length
  const anyFault = Object.keys(state.faults).length
  const ready = canPrint(state)
  const jetOn = state.jetState === 'RUNNING' || state.jetState === 'STARTING'
  const mi = modelInfo(state)
  const ms = state.mission
  const md = ms && missionById(ms.id)
  const pct = md ? Math.round((ms.done.filter(Boolean).length / md.steps.length) * 100) : 0
  const models = Object.keys(MODELS)
  return (
    <div className="flex h-[26px] shrink-0 items-center gap-2 whitespace-nowrap px-2 text-[10px] font-semibold text-slate-200">
      <span className="whitespace-nowrap text-[11px] font-black tracking-wide text-sky-300">CIJ·SIM</span>
      <button
        type="button"
        className="rounded bg-slate-700/80 px-1.5 py-[1px] text-[10px] text-white"
        onClick={() => dispatch({ type: 'SET_MODEL', model: models[(models.indexOf(state.hw.model) + 1) % models.length] })}
        title="Cambiar modelo"
      >
        {mi.label} ▾
      </button>
      <span className="flex items-center gap-1"><span className={`led ${state.power !== 'OFF' ? 'green' : ''}`} />POWER</span>
      <span className="flex items-center gap-1"><span className={`led ${blocking ? 'red blink' : anyFault ? 'amber' : ''}`} />FAULT</span>
      <span className="flex items-center gap-1"><span className={`led ${ready ? 'green' : jetOn ? 'green blink' : ''}`} />READY H1</span>
      <span className="lcd-font ml-1 hidden text-[11px] text-emerald-300 min-[700px]:inline">{formatClock(rtcNow(state.rtcOffset), 'HH:MM:SS')}</span>
      <button type="button" onClick={onMissions} className="ml-auto flex min-w-0 shrink items-center gap-1 overflow-hidden rounded bg-slate-800 px-1.5 py-[1px]">
        {md ? (
          <>
            <span className="shrink-0">M{String(md.id).padStart(2, '0')}</span>
            <span className="min-w-0 max-w-[260px] truncate font-normal text-amber-200">
              {ms.completedAt ? '✓ completada' : `▶ ${md.steps[ms.done.findIndex((d) => !d)]?.text ?? ''}`}
            </span>
            <span className="h-[6px] w-12 shrink-0 overflow-hidden rounded bg-slate-600">
              <span className={`block h-full ${ms.completedAt ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
            </span>
            <span>{pct}%</span>
          </>
        ) : (
          <span>🎯 Elegir misión</span>
        )}
      </button>
      {install && (
        <button type="button" onClick={install} className="rounded bg-sky-600 px-1.5 py-[1px] text-white">
          ⤓ Instalar
        </button>
      )}
      {supported && (
        <button type="button" onClick={toggle} className="rounded bg-slate-700 px-1.5 py-[1px]" title="Pantalla completa">
          {fs ? '⤡' : '⛶'}
        </button>
      )}
    </div>
  )
}
