// Pantallas de lista: lecciones del entrenamiento y misiones de planta, y ayuda.
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { MACHINES } from '../machines/registry.jsx'
import { lessonsFor, trainingStatus } from '../engine/training.js'
import { missionsFor, missionUnlocked } from '../engine/missions.js'

function Header({ title, sub, onBack }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-[#0e1626] px-2 py-1.5">
      <button type="button" onClick={onBack} className="rounded-md bg-slate-700/80 px-2 py-1 text-[12px] font-bold text-white">
        ‹ Menú
      </button>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[14px] font-black text-white">{title}</div>
        <div className="truncate text-[11px] text-slate-400">{sub}</div>
      </div>
    </div>
  )
}

export function LessonsScreen() {
  const { state, dispatch } = useStore()
  const machine = state.ui.machine
  const M = MACHINES[machine]
  const list = lessonsFor(machine)
  const tr = trainingStatus(state, machine)
  const doneMap = state.training[machine] || {}
  const firstPending = list.find((l) => !doneMap[l.id])
  return (
    <div className="flex h-full flex-col bg-[#0b1220] text-white">
      <Header title={`Entrenamiento guiado · ${M.label}`} sub={`${tr.done} de ${tr.total} lecciones completadas · ${M.tag}`} onBack={() => dispatch({ type: 'UI_SET', patch: { screen: 'HOME' } })} />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="mb-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-[12px] leading-snug text-emerald-50">
          Haz las lecciones en orden. En cada paso te digo <b>qué tecla presionar</b> (aparece con un anillo amarillo) y <b>qué escribir</b>.
          El paso avanza solo cuando lo haces bien. Al terminar todas, se desbloquean las misiones.
          {firstPending && (
            <button type="button" className="ml-2 rounded-md bg-emerald-500 px-2 py-0.5 font-black" onClick={() => dispatch({ type: 'LESSON_START', id: firstPending.id })}>
              Continuar: {firstPending.title} ›
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {list.map((l, i) => {
            const done = doneMap[l.id]
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => dispatch({ type: 'LESSON_START', id: l.id })}
                className={`flex items-start gap-2 rounded-lg border p-1.5 text-left ${done ? 'border-emerald-600/60 bg-emerald-900/30' : l === firstPending ? 'border-yellow-400 bg-yellow-400/10' : 'border-slate-700 bg-slate-800/50'}`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-black ${done ? 'bg-emerald-500' : 'bg-slate-600'}`}>{done ? '✔' : i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold leading-tight">{l.title}</span>
                  <span className="block text-[10.5px] leading-snug text-slate-400">
                    {l.goal} · {l.steps.length} pasos
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function MissionsScreen() {
  const { state, dispatch } = useStore()
  const machine = state.ui.machine
  const M = MACHINES[machine]
  const list = missionsFor(machine)
  const unlocked = missionUnlocked(state, machine)
  const prog = state.progress[machine] || {}
  const [peek, setPeek] = useState(null)
  return (
    <div className="flex h-full flex-col bg-[#0b1220] text-white">
      <Header
        title={`Misiones de planta · ${M.label}`}
        sub={`${list.filter((m) => prog[m.id]).length} de ${list.length} completadas · ${M.tag}`}
        onBack={() => dispatch({ type: 'UI_SET', patch: { screen: 'HOME' } })}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!unlocked && (
          <div className="mb-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 text-[12px] leading-snug">
            🔒 Las misiones se desbloquean al completar el <b>entrenamiento guiado</b> de este equipo ({trainingStatus(state, machine).done}/{lessonsFor(machine).length} lecciones).
            <span className="ml-2 inline-flex gap-1.5">
              <button type="button" className="rounded-md bg-emerald-600 px-2 py-0.5 font-bold" onClick={() => dispatch({ type: 'UI_SET', patch: { screen: 'LESSONS' } })}>
                Ir al entrenamiento
              </button>
              <button type="button" className="rounded-md bg-black/30 px-2 py-0.5 text-[11px] underline" onClick={() => dispatch({ type: 'UNLOCK_MISSIONS' })}>
                Desbloquear igualmente
              </button>
            </span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {list.map((m) => {
            const p = prog[m.id]
            return (
              <button
                key={m.id}
                type="button"
                disabled={!unlocked}
                onClick={() => setPeek(m)}
                className={`rounded-lg border p-1.5 text-left disabled:opacity-50 ${p ? 'border-emerald-600/60 bg-emerald-900/30' : 'border-slate-700 bg-slate-800/50'}`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-black text-amber-300">{String(m.id).padStart(2, '0')}</span>
                  <span className="truncate text-[10px] text-slate-400">{m.area}</span>
                  {p && <span className="ml-auto text-[11px] text-emerald-300">✔ {Math.floor(p.best / 60)}:{String(p.best % 60).padStart(2, '0')}</span>}
                </div>
                <div className="text-[12px] font-bold leading-tight">{m.title}</div>
              </button>
            )
          })}
        </div>
      </div>
      {peek && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 p-3" onClick={() => setPeek(null)}>
          <div className="w-[min(520px,100%)] rounded-xl border border-amber-400/60 bg-[#1d160b] p-3 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
              Misión {String(peek.id).padStart(2, '0')} · {peek.area}
            </div>
            <div className="text-[16px] font-black leading-tight">{peek.title}</div>
            <div className="mt-1 text-[12.5px] leading-snug text-amber-50/90">{peek.brief}</div>
            <div className="mt-1 text-[11px] text-slate-300">{peek.steps.length} pasos · validación automática · puedes pedir pistas</div>
            <div className="mt-2 flex gap-2">
              <button type="button" className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-[14px] font-black" onClick={() => dispatch({ type: 'MISSION_START', id: peek.id })}>
                Empezar misión ›
              </button>
              <button type="button" className="rounded-lg bg-black/30 px-3 py-2 text-[12px] font-bold" onClick={() => setPeek(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function HelpScreen() {
  const { dispatch } = useStore()
  const tips = [
    ['Elegir equipo', 'En el menú principal toca Equipo A (9040 monochorro, un chorro) o Equipo B (9040 bichorro, doble chorro). Las lecciones, las misiones y el progreso son independientes para cada equipo.'],
    ['Acercar y mover', 'Pellizca con dos dedos para acercar. Arrastra con un dedo para moverte. Doble toque en una zona sin teclas acerca ×2 (otro doble toque vuelve). Botones de arriba: ⤢ Todo, 🖵 Pantalla, ⌨ Teclado.'],
    ['Pantalla espejo', 'Cuando estás acercado al teclado y la pantalla de la máquina queda fuera de la vista, aparece una copia de la pantalla arriba. Así ves lo que pasa mientras presionas teclas. Tócala para ir a la pantalla.'],
    ['Entrenamiento', 'Cada lección te guía paso a paso. La tecla que debes presionar tiene un anillo amarillo y una flecha. «Muéstrame la tecla» acerca la vista hasta ella. Para escribir, la tarjeta muestra el texto y lo que ya llevas en verde.'],
    ['Misiones', 'Se desbloquean al terminar el entrenamiento. Si te atascas, «Pista» te dice qué hacer y señala la tecla. «Repasar lección» abre la lección relacionada.'],
    ['Línea', 'El botón ▤ Línea abre la cinta: el producto con el último marcaje, la vista del cabezal, la tinta y acciones físicas (rellenar tinta, tapa del cabezal, pasar un producto).'],
    ['Instalar en el teléfono', 'Abre el enlace en Chrome › menú ⋮ › Instalar aplicación (o Añadir a pantalla de inicio). Funciona sin internet.'],
  ]
  return (
    <div className="flex h-full flex-col bg-[#0b1220] text-white">
      <Header title="Cómo usar CIJ Trainer" sub="Guía rápida" onBack={() => dispatch({ type: 'UI_SET', patch: { screen: 'HOME' } })} />
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 overflow-y-auto p-2">
        {tips.map(([t, d]) => (
          <div key={t} className="rounded-lg border border-slate-700 bg-slate-800/50 p-2">
            <div className="text-[13px] font-black text-sky-300">{t}</div>
            <div className="text-[12px] leading-snug text-slate-200">{d}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
