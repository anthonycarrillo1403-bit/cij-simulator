// Tarjeta de la misión en curso: objetivo, pasos con validación automática y pistas.
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { missionDef, missionsFor, missionHintText } from '../engine/missions.js'
import { MACHINES } from '../machines/registry.jsx'
import { renderRich } from './Coach.jsx'

export function MissionCard({ showHint, setShowHint, onShowKey, hasKey, onDrawer, onMinimize }) {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(true)
  const M = state.mission
  const machine = state.ui.machine
  const def = missionDef(machine, M.id)
  const keyName = MACHINES[machine].keyName
  const cur = M.done.findIndex((d) => !d)

  // La pista se apaga al completar un paso
  useEffect(() => {
    setShowHint(false)
  }, [cur, setShowHint])

  if (!def) return null
  const list = missionsFor(machine)
  const next = list[list.findIndex((m) => m.id === def.id) + 1]

  if (M.completedAt) {
    const secs = Math.round((M.completedAt - M.startedAt) / 1000)
    return (
      <div className={`pop h-full w-full overflow-y-auto rounded-xl border-2 border-amber-300 bg-amber-900/95 p-2.5 text-white shadow-2xl`}>
        <div className="text-[22px] leading-none">🏆</div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Misión {String(def.id).padStart(2, '0')} completada</div>
        <div className="text-[15px] font-black leading-tight">{def.title}</div>
        <div className="text-[12px] text-amber-100">
          Tiempo: {Math.floor(secs / 60)} min {secs % 60} s · pistas usadas: {M.hints || 0}
        </div>
        <div className="mt-2 flex gap-1.5">
          {next && (
            <button type="button" className="flex-1 rounded-lg bg-amber-500 px-2 py-1.5 text-[13px] font-black" onClick={() => dispatch({ type: 'MISSION_START', id: next.id })}>
              Siguiente misión ›
            </button>
          )}
          <button type="button" className="rounded-lg bg-black/30 px-2 py-1.5 text-[12px] font-bold" onClick={() => dispatch({ type: 'UI_SET', patch: { screen: 'MISSIONS' }, exit: true })}>
            Misiones
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-full w-full flex-col rounded-xl border border-amber-400/70 bg-[#2a1c08]/95 p-2 text-white shadow-2xl backdrop-blur`}>
      <div className="flex items-center gap-1">
        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-amber-300">
          Misión {String(def.id).padStart(2, '0')} · {def.area}
        </span>
        <button type="button" className="ml-auto rounded bg-black/30 px-1.5 text-[11px]" onClick={() => setOpen((o) => !o)}>
          {open ? 'ocultar objetivo' : 'ver objetivo'}
        </button>
        <button type="button" className="rounded bg-black/30 px-1.5 text-[11px]" onClick={onMinimize}>
          ◀
        </button>
      </div>
      <div className="text-[14px] font-black leading-tight">{def.title}</div>
      {open && <div className="mt-0.5 text-[11.5px] leading-snug text-amber-50/90">{def.brief}</div>}
      <ol className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
        {def.steps.map((st, i) => (
          <li key={i} className={`flex gap-1.5 rounded px-1 py-0.5 text-[12px] leading-snug ${i === cur ? 'bg-amber-500/25 font-semibold' : ''} ${M.done[i] ? 'text-emerald-300' : i === cur ? 'text-white' : 'text-slate-400'}`}>
            <span className="w-4 shrink-0 text-center">{M.done[i] ? '✔' : i + 1}</span>
            <span>{renderRich(st.text, keyName)}</span>
          </li>
        ))}
      </ol>
      {showHint && cur >= 0 && (
        <div className="mt-1 rounded-lg border border-yellow-300/60 bg-yellow-300/15 p-1.5 text-[12px] leading-snug">
          💡 {renderRich(missionHintText(state), keyName)}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {!showHint ? (
          <button
            type="button"
            className="rounded-lg bg-yellow-400 px-2 py-1 text-[12px] font-black text-slate-900"
            onClick={() => {
              setShowHint(true)
              dispatch({ type: 'MISSION_HINT' })
            }}
          >
            💡 Pista
          </button>
        ) : (
          hasKey && (
            <button type="button" className="rounded-lg bg-yellow-400 px-2 py-1 text-[12px] font-black text-slate-900" onClick={onShowKey}>
              👁 Muéstrame la tecla
            </button>
          )
        )}
        {showHint && /Línea/.test(missionHintText(state)) && (
          <button type="button" className="rounded-lg bg-sky-500 px-2 py-1 text-[12px] font-black" onClick={onDrawer}>
            ▤ Abrir Línea
          </button>
        )}
        {def.lesson && (
          <button type="button" className="rounded-lg bg-black/30 px-2 py-1 text-[11.5px] font-bold" onClick={() => dispatch({ type: 'LESSON_START', id: def.lesson })}>
            🎓 Repasar lección
          </button>
        )}
        <button type="button" className="ml-auto rounded-lg bg-black/30 px-2 py-1 text-[11.5px] font-bold" onClick={() => dispatch({ type: 'MISSION_START', id: def.id })}>
          ↺ Reiniciar
        </button>
      </div>
    </div>
  )
}
