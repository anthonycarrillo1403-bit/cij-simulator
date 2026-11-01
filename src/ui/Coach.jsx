// Tutor del entrenamiento guiado: tarjeta con la instrucción + anillo que señala la tecla.
import { useStore } from '../state/store.jsx'
import { currentStep, lessonById, lessonsFor, stepText } from '../engine/training.js'
import { FIRMWARE } from '../machines/firmware.js'
import { MACHINES } from '../machines/registry.jsx'

// Anillo pulsante sobre la tecla (se dibuja dentro del panel, así acompaña al zoom)
export function CoachRing({ rect, region }) {
  const pad = region ? 4 : 7
  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 }}
    >
      <div className="coach-ring absolute inset-0 rounded-[14px] border-[5px] border-yellow-300" />
      <div className="coach-ring-pulse absolute inset-0 rounded-[14px] border-[5px] border-yellow-300" />
      {!region && (
        <div className="coach-arrow absolute left-1/2 -translate-x-1/2 text-[34px] leading-none text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,.9)]" style={{ bottom: '100%' }}>
          ▼
        </div>
      )}
    </div>
  )
}

// Muestra el texto a escribir con lo ya tecleado en verde
function TypeHelper({ target, typed }) {
  const ok = typed != null && target.startsWith(typed) ? typed.length : 0
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px]">
      <span className="text-slate-300">Escribe:</span>
      <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[15px] font-bold tracking-wider">
        <span className="text-emerald-300">{target.slice(0, ok)}</span>
        <span className="text-white underline decoration-yellow-300 decoration-2 underline-offset-4">{target.slice(ok, ok + 1)}</span>
        <span className="text-slate-400">{target.slice(ok + 1)}</span>
      </span>
      {typed != null && !target.startsWith(typed) && <span className="text-amber-300">(borra lo que sobra)</span>}
    </div>
  )
}

export function Coach({ autoZoom, setAutoZoom, onShowKey, hasKey, onDrawer, onMinimize }) {
  const { state, dispatch } = useStore()
  const L = state.lesson
  const machine = state.ui.machine
  const def = lessonById(L.machine, L.id)
  if (!def) return null
  const list = lessonsFor(machine)
  const idx = list.findIndex((l) => l.id === def.id)
  const nextLesson = list[idx + 1]
  const st = currentStep(state)
  const fw = FIRMWARE[machine]
  const keyLabel = MACHINES[machine].keyName

  if (L.completedAt) {
    return (
      <div className={`h-full w-full overflow-y-auto rounded-xl border-2 border-emerald-400 bg-emerald-900/95 p-2.5 text-white shadow-2xl`}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Lección {idx + 1} completada ✔</div>
        <div className="text-[15px] font-black leading-tight">{def.title}</div>
        {def.summary && <div className="mt-1 text-[12px] leading-snug text-emerald-50">{def.summary}</div>}
        <div className="mt-2 flex gap-1.5">
          {nextLesson ? (
            <button type="button" className="flex-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-[13px] font-black" onClick={() => dispatch({ type: 'LESSON_START', id: nextLesson.id })}>
              Siguiente lección ›
            </button>
          ) : (
            <button type="button" className="flex-1 rounded-lg bg-amber-500 px-2 py-1.5 text-[13px] font-black" onClick={() => dispatch({ type: 'UI_SET', patch: { screen: 'MISSIONS' }, exit: true })}>
              ¡Ir a las misiones! ›
            </button>
          )}
          <button type="button" className="rounded-lg bg-black/30 px-2 py-1.5 text-[12px] font-bold" onClick={() => dispatch({ type: 'UI_SET', patch: { screen: 'LESSONS' }, exit: true })}>
            Lecciones
          </button>
        </div>
      </div>
    )
  }

  const text = stepText(state)
  const typed = st?.type != null ? fw.input(state) : null

  return (
    <div className={`h-full w-full overflow-y-auto rounded-xl border border-emerald-400/70 bg-[#0c2a22]/95 p-2 text-white shadow-2xl backdrop-blur`}>
      <div className="flex items-center gap-1">
        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          Lección {idx + 1} · {def.title}
        </span>
        <button type="button" className="ml-auto shrink-0 rounded bg-black/30 px-1.5 text-[11px]" title="Ocultar la tarjeta (ver el panel entero)" onClick={onMinimize}>
          ◀ ocultar
        </button>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/30">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(L.step / def.steps.length) * 100}%` }} />
      </div>
      <div className="mt-1.5 text-[13.5px] font-semibold leading-snug">
        <span className="mr-1 rounded bg-emerald-500 px-1 text-[11px] font-black">{L.step + 1}</span>
        {renderRich(text, keyLabel)}
      </div>
      {st?.type != null && <TypeHelper target={st.type} typed={typed} />}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {L.step > 0 && (
          <button type="button" className="rounded-lg bg-black/30 px-2 py-1 text-[12px] font-bold" onClick={() => dispatch({ type: 'LESSON_BACK' })}>
            ‹ Atrás
          </button>
        )}
        {hasKey && (
          <button type="button" className="rounded-lg bg-yellow-400 px-2 py-1 text-[12px] font-black text-slate-900" onClick={onShowKey}>
            👁 Muéstrame la tecla
          </button>
        )}
        {onDrawer && (
          <button type="button" className="rounded-lg bg-sky-500 px-2 py-1 text-[12px] font-black" onClick={onDrawer}>
            ▤ Abrir Línea
          </button>
        )}
        {(st?.next || !st?.done) && (
          <button type="button" className="ml-auto rounded-lg bg-emerald-500 px-3 py-1 text-[13px] font-black" onClick={() => dispatch({ type: 'LESSON_NEXT' })}>
            Entendido ›
          </button>
        )}
        {!st?.next && st?.done && (
          <span className="ml-auto text-[10.5px] text-emerald-200/80">avanza solo al hacerlo bien</span>
        )}
      </div>
      <label className="mt-1 flex items-center gap-1 text-[10.5px] text-slate-300">
        <input type="checkbox" checked={autoZoom} onChange={(e) => setAutoZoom(e.target.checked)} />
        Acercar automáticamente a la tecla
      </label>
    </div>
  )
}

// **negrita** y [TECLA] → etiqueta de tecla dibujada
export function renderRich(text, keyName) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g)
  return parts.map((p, i) => {
    if (p.startsWith('**')) return <b key={i} className="text-yellow-200">{p.slice(2, -2)}</b>
    if (p.startsWith('[') && p.endsWith(']')) {
      const id = p.slice(1, -1)
      return (
        <span key={i} className="mx-0.5 inline-block rounded border border-slate-400 bg-slate-100 px-1 font-mono text-[11.5px] font-bold leading-[1.35] text-slate-900 shadow-[0_1px_0_#64748b]">
          {keyName?.(id) ?? id}
        </span>
      )
    }
    return <span key={i}>{p}</span>
  })
}
