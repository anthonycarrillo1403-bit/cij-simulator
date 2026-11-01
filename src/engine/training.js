// Entrenamiento guiado: lecciones paso a paso por equipo.
// Cada paso indica qué tecla presionar (se resalta en el panel) o qué escribir, y se valida solo.
//
// Formato de un paso:
//   say:    texto de la instrucción (obligatorio)
//   key:    id de la tecla a resaltar, o función (s) => id
//   region: zona del panel a resaltar ('screen', 'leds', …) para pasos informativos
//   type:   texto que hay que escribir en el campo activo (el tutor resalta la siguiente tecla)
//   done:   (s, ctx) => boolean — el paso se completa cuando devuelve true
//   next:   true — paso informativo: se avanza con el botón «Entendido»
//   enter:  (s) => void — prepara algo al entrar al paso (raro; p. ej. provocar un defecto)
// ctx = { ev: eventos desde el inicio del paso, fw: firmware del equipo }
import { pushEvent } from './sim.js'
import { FIRMWARE } from '../machines/firmware.js'
import { lessons9040 } from '../machines/m9040/lessons.js'

const LESSONS = { M9040_1: lessons9040(1), M9040: lessons9040(2) }

export const lessonsFor = (machine) => LESSONS[machine] || []
export const lessonById = (machine, id) => lessonsFor(machine).find((l) => l.id === id)

export function trainingStatus(s, machine) {
  const list = lessonsFor(machine)
  const done = list.filter((l) => s.training?.[machine]?.[l.id]).length
  return { done, total: list.length, complete: list.length > 0 && done >= list.length }
}

export function currentStep(s) {
  const L = s.lesson
  if (!L) return null
  const def = lessonById(L.machine, L.id)
  return def?.steps[L.step] || null
}

export function stepCtx(s) {
  const L = s.lesson
  return {
    ev: s.events.filter((e) => e.seq > (L?.stepSeq ?? 0)),
    fw: FIRMWARE[s.ui.machine],
  }
}

function enterStep(s) {
  const st = currentStep(s)
  s.lesson.stepSeq = s.seq
  s.lesson.stepAt = Date.now()
  if (st?.enter) st.enter(s)
}

export function startLesson(s, machine, id) {
  const def = lessonById(machine, id)
  if (!def) return
  s.mission = null
  s.lesson = { machine, id, step: 0, stepSeq: s.seq, startedAt: Date.now(), stepAt: Date.now() }
  def.setup?.(s)
  pushEvent(s, 'LESSON_START', { id })
  enterStep(s)
}

function advance(s) {
  const def = lessonById(s.lesson.machine, s.lesson.id)
  s.lesson.step += 1
  pushEvent(s, 'LESSON_STEP', { id: def.id, step: s.lesson.step })
  if (s.lesson.step >= def.steps.length) {
    s.lesson.completedAt = Date.now()
    s.training[s.lesson.machine] = { ...(s.training[s.lesson.machine] || {}), [def.id]: Date.now() }
    pushEvent(s, 'LESSON_DONE', { id: def.id })
    return false
  }
  enterStep(s)
  return true
}

// Botón «Entendido» de un paso informativo
export function lessonNext(s) {
  if (!s.lesson || s.lesson.completedAt) return
  const st = currentStep(s)
  if (st && (st.next || !st.done)) advance(s)
}

export function lessonBack(s) {
  if (!s.lesson || s.lesson.completedAt || s.lesson.step === 0) return
  s.lesson.step -= 1
  enterStep(s)
}

// Se llama tras cada acción del reducer
export function evaluateLesson(s) {
  if (!s.lesson || s.lesson.completedAt) return
  let guard = 0
  while (guard++ < 30) {
    const st = currentStep(s)
    if (!st || st.next || !st.done) return
    let ok = false
    try {
      ok = st.done(s, stepCtx(s))
    } catch {
      ok = false
    }
    if (!ok) return
    if (!advance(s)) return
  }
}

// Tecla que el tutor debe resaltar ahora mismo
export function targetKey(s) {
  const st = currentStep(s)
  if (!st) return null
  const fw = FIRMWARE[s.ui.machine]
  if (st.type != null) return fw.typingKey(s, st.type)
  if (typeof st.key === 'function') return st.key(s)
  return st.key || null
}

// Zona del panel a resaltar en un paso informativo
export function targetRegion(s) {
  const st = currentStep(s)
  return st?.region || null
}

// Sección del cajón «Línea» donde se hace el paso (acción física en la máquina)
export function stepDrawer(s) {
  const st = currentStep(s)
  return s.lesson && !s.lesson.completedAt ? st?.drawer || null : null
}

// Texto de la instrucción (puede ser función del estado)
export function stepText(s) {
  const st = currentStep(s)
  if (!st) return ''
  return typeof st.say === 'function' ? st.say(s) : st.say
}
