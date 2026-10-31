import { useState } from 'react'
import { useStore, useKeyHandler } from '../state/store.jsx'
import ScreenLayout from '../components/ScreenLayout.jsx'
import ActivePreview from '../components/ActivePreview.jsx'
import { rtcNow, formatClock, formatDate } from '../engine/rtc.js'
import { statusLabel, modelInfo } from '../engine/sim.js'
import { FAULTS } from '../engine/faults.js'

const ITEMS = [
  { menu: 'PROD', label: 'Producción', key: 'P', desc: 'Marcha/paro, selección de mensajes, estado del cabezal y mantenimiento' },
  { menu: 'EDIT', label: 'Edición de mensaje', key: 'E', desc: 'Crear y modificar mensajes WYSIWYG: textos, fechas, contadores, códigos' },
  { menu: 'PREP', label: 'Preparación de impresora', key: 'R', desc: 'Reloj, chorro, deflexión, cabezal, encoder, E/S y equipo' },
  { menu: 'OPVAR', label: 'Variables operador / V24', key: 'V', desc: 'Datos dinámicos de planta: variables de operador y enlace serie V24' },
]

export function MainMenu() {
  const { state, dispatch } = useStore()
  const [sel, setSel] = useState(0)
  const open = (i) => dispatch({ type: 'NAV', menu: ITEMS[i].menu, tab: 0, view: null })
  useKeyHandler((k) => {
    if (k === 'UP') setSel((i) => (i + ITEMS.length - 1) % ITEMS.length)
    else if (k === 'DOWN') setSel((i) => (i + 1) % ITEMS.length)
    else if (k === 'ENTER') open(sel)
    else if (k === 'ESC') dispatch({ type: 'NAV', menu: 'STANDBY' })
    else return false
    return true
  })
  const faults = Object.keys(state.faults)
  return (
    <ScreenLayout desc={ITEMS[sel].desc} help="▲ ▼ para seleccionar y ENTER · ESC: pantalla de espera">
      <div className="flex h-full gap-2 p-1.5">
        <div className="flex w-[46%] flex-col gap-1">
          {ITEMS.map((it, i) => (
            <button
              key={it.menu}
              type="button"
              onClick={() => open(i)}
              onPointerEnter={() => setSel(i)}
              className={`lcd-btn lcd-font !justify-start !py-2 text-left text-[14px] font-bold ${i === sel ? 'on' : ''}`}
            >
              <span className="w-5 opacity-70">{i === sel ? '▶' : ' '}</span>
              {it.label}
            </button>
          ))}
          <div className="mt-auto text-[10.5px] c-dim">Estado impresora / Selección mensajes / Mantenimiento</div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 rounded border b-line p-1.5">
          <div className="lcd-font flex justify-between text-[11px] font-bold">
            <span>{modelInfo(state).label}</span>
            <span>{state.activeMessage}</span>
          </div>
          <div className="min-h-[44px] flex-1 rounded border b-line">
            <ActivePreview />
          </div>
          <div className="text-[11px] leading-snug">
            {faults.length ? (
              faults.map((c) => (
                <div key={c} className={FAULTS[c].severity === 'DEFECTO' ? 'c-bad font-bold' : 'c-warn'}>
                  ⚠ {FAULTS[c].title}
                </div>
              ))
            ) : (
              <div className="c-ok">Sin defectos ni alarmas</div>
            )}
          </div>
        </div>
      </div>
    </ScreenLayout>
  )
}

export function Standby() {
  const { state, dispatch } = useStore()
  const now = rtcNow(state.rtcOffset)
  const back = () => dispatch({ type: 'NAV', menu: 'HOME' })
  useKeyHandler(() => {
    back()
    return true
  })
  return (
    <button type="button" onClick={back} className="lcd-font flex h-full w-full flex-col items-center justify-center gap-1">
      <div className="text-[clamp(40px,12vw,96px)] font-bold leading-none">{formatClock(now, 'HH:MM:SS')}</div>
      <div className="text-xl">{formatDate(now, 'DD-MMM-YYYY')}</div>
      <div className="mt-2 text-sm c-dim">{statusLabel(state)} · {state.activeMessage}</div>
      <div className="text-[11px] c-dim">Pulse cualquier tecla para volver al menú principal</div>
    </button>
  )
}
