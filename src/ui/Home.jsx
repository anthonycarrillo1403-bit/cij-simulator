// Menú principal de la aplicación: elegir equipo, entrenamiento guiado, misiones y práctica libre.
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { MACHINES, MACHINE_IDS } from '../machines/registry.jsx'
import { lessonsFor, trainingStatus } from '../engine/training.js'
import { missionsFor, missionUnlocked } from '../engine/missions.js'

function MachineCard({ id, selected, onSelect }) {
  const m = MACHINES[id]
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border-2 p-2 text-left transition ${
        selected ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_0_3px_rgba(56,189,248,.25)]' : 'border-slate-700 bg-slate-800/60'
      }`}
    >
      <m.Thumb />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">{m.tag}</div>
        <div className="truncate text-[15px] font-black text-white">{m.label}</div>
        <div className="text-[11px] leading-tight text-slate-300">{m.jetsLabel}</div>
      </div>
      <div className={`ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? 'border-sky-400 bg-sky-400' : 'border-slate-500'}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-slate-900" />}
      </div>
    </button>
  )
}

function BigButton({ n, title, sub, onClick, color, locked, progress }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white shadow-lg active:scale-[.98] ${color} ${locked ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-black/25 text-sm font-black">{n}</span>
        {locked && <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-bold">🔒 BLOQUEADO</span>}
      </div>
      <div>
        <div className="text-[15px] font-black leading-tight">{title}</div>
        <div className="text-[11px] leading-snug opacity-90">{sub}</div>
        {progress != null && (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/25">
            <div className="h-full rounded-full bg-white/90" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
    </button>
  )
}

export default function Home() {
  const { state, dispatch } = useStore()
  const machine = state.ui.machine
  const [confirmReset, setConfirmReset] = useState(false)
  const lessons = lessonsFor(machine)
  const tr = trainingStatus(state, machine)
  const missions = missionsFor(machine)
  const doneMissions = missions.filter((m) => state.progress[machine]?.[m.id]).length
  const unlocked = missionUnlocked(state, machine)

  const go = (screen) => dispatch({ type: 'UI_SET', patch: { screen } })

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-y-auto bg-gradient-to-br from-[#0b1220] via-[#101a2c] to-[#0b1220] p-2.5 text-white">
      <div className="flex items-center gap-2">
        <img src="icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
        <div className="min-w-0">
          <div className="text-[16px] font-black leading-none">CIJ Trainer</div>
          <div className="text-[11px] text-slate-400">Simulador de codificadoras Markem-Imaje</div>
        </div>
        <button type="button" onClick={() => go('HELP')} className="ml-auto rounded-lg bg-slate-700/70 px-2.5 py-1.5 text-[12px] font-bold">
          ? Cómo usar
        </button>
      </div>

      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">1 · Elige el equipo</div>
        <div className="flex gap-2">
          {MACHINE_IDS.map((id) => (
            <MachineCard key={id} id={id} selected={machine === id} onSelect={() => dispatch({ type: 'UI_SET', patch: { machine: id } })} />
          ))}
        </div>
      </div>

      <div className="flex min-h-[150px] flex-1 gap-2">
        <BigButton
          n="2"
          title="Entrenamiento guiado"
          sub={`${tr.done} de ${lessons.length} lecciones · te indico qué tecla presionar y qué escribir`}
          color="bg-gradient-to-br from-emerald-600 to-emerald-800"
          progress={tr.done / lessons.length}
          onClick={() => go('LESSONS')}
        />
        <BigButton
          n="3"
          title="Misiones de planta"
          sub={unlocked ? `${doneMissions} de ${missions.length} completadas · con pistas si te atascas` : 'Se desbloquean al terminar el entrenamiento'}
          color="bg-gradient-to-br from-amber-600 to-orange-800"
          locked={!unlocked}
          progress={doneMissions / missions.length}
          onClick={() => go('MISSIONS')}
        />
        <BigButton
          n="4"
          title="Práctica libre"
          sub="La máquina sola, sin guía, para practicar a tu ritmo"
          color="bg-gradient-to-br from-sky-600 to-indigo-800"
          onClick={() => dispatch({ type: 'PRACTICE_START' })}
        />
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>Progreso guardado en este teléfono.</span>
        {!confirmReset ? (
          <button type="button" className="ml-auto underline" onClick={() => setConfirmReset(true)}>
            Borrar progreso
          </button>
        ) : (
          <span className="ml-auto flex gap-2">
            <span className="text-amber-300">¿Borrar todo el progreso?</span>
            <button type="button" className="font-bold text-red-400 underline" onClick={() => { dispatch({ type: 'RESET_ALL' }); setConfirmReset(false) }}>
              Sí, borrar
            </button>
            <button type="button" className="underline" onClick={() => setConfirmReset(false)}>
              No
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
