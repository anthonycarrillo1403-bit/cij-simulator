// Reducer central: todas las acciones del operador pasan por aquí, se registran
// como eventos (para validar las misiones) y se reevalúa la misión activa.
import {
  createInitialState, tick, pushEvent, startPrinter, stopPrinter, startJet, stopJet, printOnce,
  acknowledgeFaults, startDiag, activeFaults, canPrint, modelInfo, productPasses,
} from '../engine/sim.js'
import { startMission, evaluateMission } from '../engine/missions.js'
import { startLesson, evaluateLesson, lessonNext, lessonBack, lessonGroup } from '../engine/training.js'
import { FIRMWARE, applyMachine } from '../machines/firmware.js'
import { makeMessage, newId, defaultMessages, MODELS } from '../engine/defaults.js'
import { offsetFor } from '../engine/rtc.js'
import { CHARGE_ELECTRODE, headOverpressure } from '../engine/jet.js'

export function setPath(obj, path, value) {
  const keys = path.split('.')
  let o = obj
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]]
  o[keys.at(-1)] = value
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}

const toast = (s, text, kind = 'info') => {
  s.toast = { text, kind, t: Date.now() }
}

function cloneMessage(m) {
  const c = structuredClone(m)
  c.lines.forEach((l) => l.forEach((f) => (f.id = newId())))
  return c
}

export function reducer(state, action) {
  const s = structuredClone(state)
  apply(s, action)
  evaluateMission(s)
  evaluateLesson(s)
  return s
}

export function apply(s, a) {
  switch (a.type) {
    // ----- Aplicación (menú, entrenamiento, misiones)
    case 'UI_SET': {
      const prevMachine = s.ui.machine
      s.ui = { ...s.ui, ...a.patch }
      if (a.exit) {
        s.lesson = null
        s.mission = null
      }
      if (s.ui.machine !== prevMachine) applyMachine(s)
      break
    }
    case 'EXIT_TO_MENU':
      s.ui.screen = s.lesson ? (lessonGroup(s.lesson.machine, s.lesson.id) === 'codif' ? 'CODIF' : 'LESSONS') : s.mission ? 'MISSIONS' : 'HOME'
      s.lesson = null
      s.mission = null
      break
    case 'PRACTICE_START': {
      // Práctica libre: impresora encendida y pantalla en Producción, sin diálogos
      // ni ediciones pendientes de una lección anterior (antes parecía que «no respondía»).
      s.lesson = null
      s.mission = null
      applyMachine(s)
      const m = s.ui.machine
      s.fw[m] = FIRMWARE[m].init()
      s.editing = null
      if (s.power !== 'ON') {
        s.power = 'ON'
        s.powerTimer = 0
        s.jetState = 'STOPPED'
      }
      if (s.jetState === 'STOPPED' && !Object.keys(s.faults).length) startJet(s)
      s.paused = false
      s.ui.screen = 'MACHINE'
      break
    }
    case 'LESSON_START':
      applyMachine(s)
      startLesson(s, s.ui.machine, a.id)
      s.ui.screen = 'MACHINE'
      break
    case 'LESSON_NEXT':
      lessonNext(s)
      break
    case 'LESSON_BACK':
      lessonBack(s)
      break
    case 'MISSION_HINT':
      if (s.mission) s.mission.hints = (s.mission.hints || 0) + 1
      break
    case 'UNLOCK_MISSIONS':
      s.ui.unlocked = { ...(s.ui.unlocked || {}), [s.ui.machine]: true }
      break
    case 'KEY': {
      const fw = FIRMWARE[s.ui.machine]
      pushEvent(s, 'KEY', { key: a.key })
      fw.press(s, a.key, (act) => apply(s, act))
      break
    }
    case 'TICK':
      tick(s, a.dt)
      break
    case 'HYDRATE':
      return Object.assign(s, a.state)
    case 'RESET_ALL': {
      const keep = a.keepProgress ? { progress: s.progress, training: s.training, ui: s.ui } : { ui: { ...createInitialState().ui, machine: s.ui.machine } }
      Object.assign(s, createInitialState(), keep)
      applyMachine(s)
      toast(s, 'Simulador reiniciado')
      break
    }
    case 'NAV': {
      // El firmware de cada equipo avisa cuando el operador entra en una pantalla
      // (vistas estándar: select, clock, jet, adjust, encoder, head, io, deflect, faults, v24…)
      pushEvent(s, 'NAV', { view: a.view })
      if (a.view === 'clock') pushEvent(s, 'RTC_VIEW')
      break
    }
    case 'TOAST':
      toast(s, a.text, a.kind)
      break
    case 'SET_MODEL':
      s.hw.model = a.model
      toast(s, `Modelo: ${MODELS[a.model].label}`)
      pushEvent(s, 'SET_MODEL', { model: a.model })
      break

    // ----- Producción
    case 'POWER_TOGGLE':
      if (s.power === 'OFF') startPrinter(s)
      else if (s.power === 'ON') stopPrinter(s)
      break
    case 'POWER_ON':
      startPrinter(s)
      break
    case 'POWER_OFF':
      stopPrinter(s)
      break
    case 'JET_START':
      if (!startJet(s)) toast(s, s.power !== 'ON' ? 'Impresora parada: pulse MARCHA' : activeFaults(s).length ? 'Anule los defectos antes de arrancar' : 'El chorro ya está en marcha', 'warn')
      break
    case 'JET_STOP':
      stopJet(s)
      break
    case 'SET_START_MODE':
      s.hw.startMode = a.mode
      break
    case 'SELECT_MESSAGE':
      if (s.messages[a.name]) {
        s.activeMessage = a.name
        pushEvent(s, 'SELECT_MESSAGE', { name: a.name })
        if (!a.quiet) toast(s, `Mensaje ${a.name} seleccionado para impresión`)
      }
      break
    case 'PAUSE_TOGGLE':
      s.paused = !s.paused
      if (s.paused) pushEvent(s, 'PRINT_PAUSE')
      else pushEvent(s, 'PRINT_START', { faults: activeFaults(s), ready: canPrint(s) })
      break
    case 'MANUAL_PRINT':
      if (!printOnce(s, 'MANUAL')) toast(s, 'Impresión imposible: verifique chorro, defectos y pausa', 'warn')
      break
    case 'COUNTER_RESET': {
      const m = s.messages[s.activeMessage]
      if (m) {
        m.counter.value = m.counter.start
        m.counter.batchCount = 0
        pushEvent(s, 'COUNTER_RESET')
      }
      break
    }
    case 'SET_ACTIVE_MSG': {
      const m = s.messages[s.activeMessage]
      if (m) {
        setPath(m, a.path, a.value)
        pushEvent(s, 'ACTIVE_MSG_SET', { path: a.path, value: a.value })
      }
      break
    }
    case 'SET_LINE':
      s.line[a.key] = a.value
      if (a.key === 'headY') pushEvent(s, 'HEAD_MOVE', { y: a.value })
      break
    case 'PRODUCT_TRIGGER':
      productPasses(s)
      break

    // ----- Hardware / preparación
    case 'SET_HW':
      setPath(s.hw, a.path, a.value)
      pushEvent(s, 'HW_SET', { path: a.path, value: a.value })
      if (a.path.startsWith('v24.')) pushEvent(s, 'V24_CONFIG')
      break
    case 'IO_SET':
      s.hw.io[a.dir][a.index] = a.fn
      pushEvent(s, 'IO_SET', { dir: a.dir, index: a.index, fn: a.fn })
      break
    case 'ADJUST_ENTER':
      if (s.power !== 'ON') {
        toast(s, 'Impresora parada', 'warn')
        break
      }
      if (s.faults.RECUP) delete s.faults.RECUP
      s.adjustMode = true
      if (s.jetState === 'STOPPED' || s.jetState === 'STOPPING') {
        s.jetState = 'STARTING'
        s.jetTimer = 4000
      }
      pushEvent(s, 'ADJUST_ENTER')
      break
    case 'ADJUST_EXIT':
      s.adjustMode = false
      s.timers.recup = 0
      pushEvent(s, 'ADJUST_EXIT', { gutterOk: s.live.gutterOk })
      break
    case 'JET_VALIDATE': {
      const ok = s.jetState === 'RUNNING' && s.live.breakoff >= CHARGE_ELECTRODE.from && s.live.breakoff <= CHARGE_ELECTRODE.to && s.live.phaseOk
      pushEvent(s, 'JET_VALIDATE', { ok, breakoff: s.live.breakoff })
      if (!a.quiet) toast(s, ok ? 'Control de gotas correcto' : 'Fase incorrecta: punto de quiebra fuera del electrodo de carga', ok ? 'ok' : 'warn')
      break
    }
    case 'JET_MAINT': {
      // Funciones de Estado chorros: REFRESCO, ESTABILIDAD, INTRO. DISOLVENTE, DESOBTURACIÓN
      pushEvent(s, 'JET_MAINT', { fn: a.fn })
      toast(s, `${a.fn}: función ejecutada`)
      break
    }
    case 'FAULT_VIEW':
      if (s.faults[a.code]) s.faults[a.code].viewed = true
      pushEvent(s, 'FAULT_VIEW', { code: a.code })
      break
    case 'FAULT_ACK': {
      const before = activeFaults(s).length
      const n = acknowledgeFaults(s)
      toast(s, n ? `${n} defecto(s) anulado(s)` : before ? 'La causa del defecto persiste' : 'Sin defectos', n ? 'ok' : 'warn')
      break
    }
    case 'DIAG_START': {
      const r = startDiag(s, a.step)
      if (!r.ok) toast(s, r.msg, 'warn')
      break
    }
    case 'INK_SET':
      s.hidden.inkLevel = a.level
      pushEvent(s, 'INK_SET', { level: a.level })
      break
    case 'COVER_TOGGLE':
      s.hidden.coverOpen = !s.hidden.coverOpen
      break
    case 'AIR_PURGE':
      s.hw.airKit.purged = true
      pushEvent(s, 'AIR_PURGE')
      toast(s, 'Purga de filtros del kit aire realizada', 'ok')
      break
    case 'AIR_TEST': {
      const ok = headOverpressure(s.hw, modelInfo(s), s.hw.jet.pressureSet)
      s.live.overpressure = ok
      pushEvent(s, 'AIR_TEST', { ok })
      toast(s, ok ? 'Presión de entrada correcta' : 'Presión de entrada fuera de tolerancia', ok ? 'ok' : 'warn')
      break
    }

    // ----- RTC
    case 'RTC_SET': {
      const target = new Date(a.y, a.mo - 1, a.d, a.h, a.m, a.sec || 0)
      s.rtcOffset = offsetFor(target)
      s.rtcLastSet = { sys: Date.now(), target: target.getTime() }
      pushEvent(s, 'RTC_SET', { h: a.h, m: a.m, y: a.y, mo: a.mo, d: a.d })
      toast(s, 'Reloj ajustado. El RTC continúa avanzando desde la nueva hora.', 'ok')
      break
    }
    case 'RTC_SYNC':
      s.rtcOffset = 0
      s.rtcLastSet = null
      pushEvent(s, 'RTC_SYNC')
      toast(s, 'RTC sincronizado con la hora del sistema', 'ok')
      break

    // ----- Edición de mensajes
    case 'EDIT_NEW': {
      const name = a.name.toUpperCase().slice(0, 12)
      s.editing = { message: makeMessage(name, [[]], a.extra || {}), original: null, dirty: true }
      pushEvent(s, 'EDIT_OPEN', { name, isNew: true })
      break
    }
    case 'EDIT_OPEN':
      if (s.messages[a.name]) {
        s.editing = { message: cloneMessage(s.messages[a.name]), original: a.name, dirty: false }
        pushEvent(s, 'EDIT_OPEN', { name: a.name })
      }
      break
    case 'EDIT_CLOSE':
      s.editing = null
      pushEvent(s, 'EDIT_CLOSE')
      break
    case 'EDIT_SAVE':
    case 'EDIT_LOAD_PRINTER':
    case 'EDIT_SAVE_AS': {
      if (!s.editing) break
      const m = s.editing.message
      if (a.type === 'EDIT_SAVE_AS') m.name = a.name.toUpperCase().slice(0, 12)
      const prev = s.messages[m.name]
      // el contador en producción sigue avanzando mientras se edita: conservar su valor
      // salvo que se hayan cambiado sus límites
      const limitsChanged = !prev || prev.counter.start !== m.counter.start || prev.counter.end !== m.counter.end
      m.counter.value = limitsChanged ? m.counter.start : prev.counter.value
      s.messages[m.name] = structuredClone(m)
      s.editing.original = m.name
      s.editing.dirty = false
      pushEvent(s, 'EDIT_SAVE', { name: m.name })
      if (a.type === 'EDIT_LOAD_PRINTER') {
        s.activeMessage = m.name
        pushEvent(s, 'LOAD_PRINTER', { name: m.name })
        if (!a.quiet) toast(s, `${m.name} guardado y cargado en impresora`, 'ok')
      } else if (!a.quiet) toast(s, `${m.name} guardado`, 'ok')
      break
    }
    case 'MSG_DELETE':
      if (s.messages[a.name] && Object.keys(s.messages).length > 1) {
        delete s.messages[a.name]
        if (s.activeMessage === a.name) s.activeMessage = Object.keys(s.messages)[0]
        if (s.editing?.original === a.name) s.editing = null
        toast(s, `${a.name} borrado`)
      }
      break
    case 'MSG_RESTORE_DEFAULTS':
      Object.assign(s.messages, defaultMessages())
      toast(s, 'Mensajes de ejemplo restaurados', 'ok')
      break
    case 'EDIT_INSERT': {
      if (!s.editing) break
      const lines = s.editing.message.lines
      while (lines.length <= a.line) lines.push([])
      const idx = a.index ?? lines[a.line].length
      lines[a.line].splice(idx, 0, { id: newId(), font: '7x5', bold: 1, ...a.field })
      s.editing.dirty = true
      pushEvent(s, 'EDIT_INSERT', { fieldType: a.field.type })
      break
    }
    case 'EDIT_UPDATE_FIELD': {
      if (!s.editing) break
      const f = s.editing.message.lines[a.line]?.[a.index]
      if (f) Object.assign(f, a.patch)
      s.editing.dirty = true
      break
    }
    case 'EDIT_REMOVE_FIELD':
      if (!s.editing) break
      s.editing.message.lines[a.line]?.splice(a.index, 1)
      s.editing.dirty = true
      break
    case 'EDIT_MOVE_FIELD': {
      if (!s.editing) break
      const l = s.editing.message.lines[a.line]
      const j = a.index + a.dir
      if (l && j >= 0 && j < l.length) [l[a.index], l[j]] = [l[j], l[a.index]]
      s.editing.dirty = true
      break
    }
    case 'EDIT_ADD_LINE':
      if (s.editing && s.editing.message.lines.length < 4) s.editing.message.lines.push([])
      break
    case 'EDIT_REMOVE_LINE':
      if (s.editing && s.editing.message.lines.length > 1) s.editing.message.lines.splice(a.line, 1)
      break
    case 'EDIT_SET':
      if (!s.editing) break
      setPath(s.editing.message, a.path, a.value)
      s.editing.dirty = true
      pushEvent(s, 'EDIT_SET', { path: a.path })
      break

    // ----- Variables de operador / V24
    case 'OPVAR_SET': {
      const v = s.opvars.find((o) => o.name === a.name)
      if (v) {
        v.value = String(a.value).slice(0, v.size)
        pushEvent(s, 'OPVAR_SET', { name: a.name, value: v.value })
      }
      break
    }
    case 'OPVAR_DEF': {
      const v = s.opvars[a.index]
      if (v) Object.assign(v, a.patch)
      break
    }
    case 'OPVAR_ENSURE': {
      const name = a.name.toUpperCase().slice(0, 10)
      const v = s.opvars.find((o) => o.name === name)
      if (v) Object.assign(v, { size: a.size, def: a.def })
      else s.opvars.push({ name, size: a.size, def: a.def, value: '' })
      pushEvent(s, 'OPVAR_DEF', { name })
      break
    }
    case 'EDIT_INSERT_EVT':
      pushEvent(s, 'EDIT_INSERT', { fieldType: a.fieldType })
      break
    case 'OPVAR_ADD':
      if (s.opvars.length < 20 && !s.opvars.some((o) => o.name === a.name)) s.opvars.push({ name: a.name.toUpperCase().slice(0, 10), size: 8, def: '', value: '' })
      break
    case 'OPVAR_REMOVE':
      s.opvars.splice(a.index, 1)
      break
    case 'V24_FRAME':
      s.hw.v24.data = String(a.data)
      s.hw.v24.lastFrame = `${new Date().toLocaleTimeString()}  STX ${a.data} ETX`
      pushEvent(s, 'V24_FRAME', { data: String(a.data) })
      toast(s, `Trama V24 recibida (${String(a.data).length} car.)`, 'ok')
      break

    // ----- Misiones
    case 'MISSION_START':
      s.lesson = null
      applyMachine(s)
      startMission(s, s.ui.machine, a.id)
      s.ui.screen = 'MACHINE'
      break
    case 'MISSION_ABORT':
      s.mission = null
      break
    default:
      break
  }
}
