// Panel lateral "Misiones de Planta" (modo entrenamiento)
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { MISSIONS, missionById } from '../engine/missions.js'
import { MODELS } from '../engine/defaults.js'

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function MissionsPanel({ open, onClose }) {
  const { state, dispatch } = useStore()
  const [detail, setDetail] = useState(state.mission?.id ?? null)
  useEffect(() => {
    if (open && state.mission) setDetail(state.mission.id)
  }, [open, state.mission?.id])
  const done = Object.keys(state.progress).length
  const m = detail ? missionById(detail) : null
  const run = state.mission && m && state.mission.id === m.id ? state.mission : null
  const elapsed = run ? Math.round(((run.completedAt || Date.now()) - run.startedAt) / 1000) : 0
  return (
    <div className={`absolute inset-y-0 right-0 z-50 flex w-[min(430px,64%)] flex-col bg-slate-900/95 backdrop-blur-sm text-slate-100 shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : 'pointer-events-none translate-x-full'}`}>
      <div className="flex items-center gap-2 border-b border-slate-700 px-2 py-1">
        <span className="text-sm font-black text-amber-300">🎯 Misiones de Planta</span>
        <span className="text-[11px] text-slate-400">{done}/15 completadas</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-700">
          <div className="h-full bg-emerald-400" style={{ width: `${(done / 15) * 100}%` }} />
        </div>
        <button type="button" onClick={onClose} className="rounded bg-slate-700 px-2 py-0.5 text-sm">
          ✕
        </button>
      </div>
      {m ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1 p-2">
          <button type="button" className="self-start text-[11px] text-sky-300" onClick={() => setDetail(null)}>
            ◄ Todas las misiones
          </button>
          <div className="text-[13px] font-bold">
            Misión {String(m.id).padStart(2, '0')} · {m.title}
          </div>
          <div className="text-[11px] text-slate-300">{m.brief}</div>
          {m.model && <div className="text-[10.5px] text-amber-300">Equipo: {MODELS[m.model].label} (se selecciona al iniciar)</div>}
          {run ? (
            <>
              <div className="flex items-center gap-2 text-[11px]">
                <div className="h-2 flex-1 overflow-hidden rounded bg-slate-700">
                  <div className={`h-full ${run.completedAt ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${(run.done.filter(Boolean).length / m.steps.length) * 100}%` }} />
                </div>
                <span>{run.done.filter(Boolean).length}/{m.steps.length}</span>
                <span className="font-mono">⏱ {fmtTime(elapsed)}</span>
              </div>
              <ol className="min-h-0 flex-1 space-y-[3px] overflow-y-auto text-[11.5px]">
                {m.steps.map((st, i) => {
                  const isDone = run.done[i]
                  const current = !isDone && run.done.slice(0, i).every(Boolean)
                  return (
                    <li key={i} className={`flex gap-1.5 rounded px-1 py-[3px] ${current ? 'bg-amber-500/20 text-amber-100' : isDone ? 'text-emerald-300' : 'text-slate-400'}`}>
                      <span>{isDone ? '✔' : current ? '▶' : '○'}</span>
                      <span>{st.text}</span>
                    </li>
                  )
                })}
              </ol>
              {run.completedAt && <div className="rounded bg-emerald-600/30 p-1.5 text-center text-[12px] font-bold text-emerald-200">✅ ¡Misión completada en {fmtTime(elapsed)}!</div>}
              <div className="flex gap-1">
                <button type="button" className="flex-1 rounded bg-slate-700 py-1 text-[12px]" onClick={() => dispatch({ type: 'MISSION_START', id: m.id })}>
                  ↺ Reiniciar
                </button>
                <button type="button" className="flex-1 rounded bg-slate-700 py-1 text-[12px]" onClick={() => dispatch({ type: 'MISSION_ABORT' })}>
                  Abandonar
                </button>
                <button type="button" className="flex-1 rounded bg-sky-700 py-1 text-[12px]" onClick={onClose}>
                  Ir a la impresora
                </button>
              </div>
            </>
          ) : (
            <>
              <ol className="min-h-0 flex-1 list-decimal space-y-[2px] overflow-y-auto pl-5 text-[11.5px] text-slate-300">
                {m.steps.map((st, i) => (
                  <li key={i}>{st.text}</li>
                ))}
              </ol>
              <button
                type="button"
                className="rounded bg-amber-500 py-1.5 text-[13px] font-bold text-slate-900"
                onClick={() => {
                  dispatch({ type: 'MISSION_START', id: m.id })
                  onClose()
                }}
              >
                ▶ Iniciar misión
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-1 overflow-y-auto p-2">
          {MISSIONS.map((mi) => {
            const p = state.progress[mi.id]
            const active = state.mission?.id === mi.id && !state.mission.completedAt
            const pct = active ? Math.round((state.mission.done.filter(Boolean).length / mi.steps.length) * 100) : p ? 100 : 0
            return (
              <button key={mi.id} type="button" onClick={() => setDetail(mi.id)} className={`flex items-center gap-2 rounded px-2 py-1 text-left ${active ? 'bg-amber-500/20' : 'bg-slate-800'}`}>
                <span className={`w-7 text-center text-[13px] font-black ${p ? 'text-emerald-400' : 'text-slate-400'}`}>{String(mi.id).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold">{mi.title}</span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    {mi.area} · {mi.steps.length} pasos
                    {p && <span className="text-emerald-400">· ✓ mejor {fmtTime(p.best)}</span>}
                  </span>
                </span>
                <span className="h-1.5 w-12 overflow-hidden rounded bg-slate-700">
                  <span className={`block h-full ${p && !active ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
