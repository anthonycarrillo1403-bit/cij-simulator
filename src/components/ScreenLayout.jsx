// Zonas del visualizador según el manual S8 Contrast:
// 1 título · 2 edición (barra de menús + zona de trabajo) · 3 descripción · 4 ayuda
import { useStore, useKeyHandler } from '../state/store.jsx'
import { rtcNow, formatClock, formatDate } from '../engine/rtc.js'
import { statusLabel } from '../engine/sim.js'

export const MENU_TITLES = {
  HOME: 'MENÚ PRINCIPAL',
  PROD: 'PRODUCCIÓN',
  EDIT: 'EDICIÓN DE MENSAJE',
  PREP: 'PREPARACIÓN DE IMPRESORA',
  OPVAR: 'VARIABLES OPERADOR / V24',
  STANDBY: 'ESPERA',
}

export default function ScreenLayout({ tabs, desc, help, children, msgName }) {
  const { state, dispatch } = useStore()
  const { nav } = state
  const now = rtcNow(state.rtcOffset)
  const status = statusLabel(state)
  const go = (i) => dispatch({ type: 'NAV', menu: nav.menu, tab: i, view: tabs?.[i]?.view ?? null })

  useKeyHandler((k) => {
    if (!tabs) return false
    if (k === 'LEFT') go((nav.tab - 1 + tabs.length) % tabs.length)
    else if (k === 'RIGHT') go((nav.tab + 1) % tabs.length)
    else return false
    return true
  })

  const statusCls = status === 'DEFECTO' ? 'c-bad' : status === 'LISTO' || status === 'IMPRIMIENDO' ? 'c-ok' : 'c-warn'
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 1 - zona de título */}
      <div className="bg-sel lcd-font flex items-center gap-2 px-2 py-[1px] text-[11px] font-bold">
        <span className="truncate">{MENU_TITLES[nav.menu]}</span>
        <span className="ml-auto truncate opacity-90">{msgName ?? state.activeMessage}</span>
        <span className="whitespace-nowrap">{formatDate(now, 'DD/MM/YY')} {formatClock(now, 'HH:MM:SS')}</span>
      </div>
      {/* barra de menús */}
      {tabs && (
        <div className="scroll-x flex shrink-0 gap-[2px] border-b-2 b-line px-1 pt-[2px]">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              type="button"
              onClick={() => go(i)}
              className={`lcd-font whitespace-nowrap rounded-t px-2 py-[3px] text-[12px] font-bold ${i === nav.tab ? 'bg-sel' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {/* 2 - zona de trabajo */}
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
      {/* 3 - descripción / 4 - ayuda */}
      <div className="flex shrink-0 items-center gap-2 border-t-2 b-line px-2 py-[1px] text-[10.5px] leading-tight">
        <span className="min-w-0 flex-1 truncate">{desc || ' '}</span>
        <span className={`lcd-font whitespace-nowrap font-bold ${statusCls}`}>{status}</span>
      </div>
      <div className="shrink-0 truncate px-2 pb-[1px] text-[10px] leading-tight c-dim">{help || '◄ ► submenú · ▲ ▼ valor · ENTER valida · ESC vuelve'}</div>
    </div>
  )
}
