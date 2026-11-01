// Firmware de cada equipo y cambio de equipo (cada uno conserva sus mensajes y su hardware).
import * as S8 from './s8classic/firmware.js'
import * as M9 from './m9040/firmware.js'
import { defaultHardware, defaultOpvars, makeMessage, T, F } from '../engine/defaults.js'
import { defaultMessages } from '../engine/defaults.js'

export const FIRMWARE = {
  S8_CLASSIC: {
    init: S8.initFw,
    press: S8.press,
    view: S8.view,
    leds: S8.leds,
    input: S8.input,
    typingKey: S8.typingKey,
    navKey: S8.navKey,
    fromKeyboard: S8.fromKeyboard,
    screenId: S8.screenId,
  },
  M9040: {
    init: M9.initFw,
    press: M9.press,
    view: M9.view,
    leds: M9.leds,
    input: M9.input,
    typingKey: M9.typingKey,
    navKey: M9.navKey,
    fromKeyboard: M9.fromKeyboard,
    screenId: M9.screenId,
  },
}

const S8P = { sense: 'DIRECTO', printSpeed: 500, trigger: 'OBJETO', repeat: 1, delayFwd: 50, delayRev: 50, interval: 100, dtopCancel: 20, dtopFilter: 100, width: 100, din: false, vSense: 'UP', hSense: 'RIGHT' }
export const makeS8Message = (name, lines, extra = {}) => makeMessage(name, lines, { params: { ...S8P }, shift: { start: '06:00', interval: '08:00', type: 'LETRAS', codes: [] }, ...extra })

// Biblioteca de mensajes del S8 Classic (numerados 01…25)
export function defaultMessagesS8() {
  return {
    '01': makeS8Message('01', [[T('IMAJE S8 CLASSIC')]]),
    '02': makeS8Message('02', [[T('LOTE A1 '), F('date', { format: 'JJJ' }), F('date', { format: 'Y' })]]),
    '03': makeS8Message('03', [[T('CLIENTE X L:1234')], [T('CAD '), F('expiry', { slot: 1, format: 'DD' }), T('/'), F('expiry', { slot: 1, format: 'MM' }), T('/'), F('expiry', { slot: 1, format: 'YY' })]], {
      expiry: { amount: 180, unit: 'DIAS' },
    }),
    '04': makeS8Message('04', [[T('FAB '), F('date', { format: 'DD' }), T('/'), F('date', { format: 'MM' }), T('/'), F('date', { format: 'YY' }), T(' '), F('clock', { format: 'HH' }), T(':'), F('clock', { format: 'MM' })]]),
  }
}

// Hardware propio de cada equipo (referencia del tacómetro, orientación de chorros del bichorro)
export function machineHw(m, hw) {
  hw.model = m
  hw.head = { ...hw.head, jets: m === 'M9040' ? 2 : 1 }
  if (m === 'M9040') {
    hw.head.orient = hw.head.orient || { j1: 0, j2: 0 }
    hw.head.skew = hw.head.skew || 0
    hw.encoder.ref = 12
  } else {
    delete hw.head.orient
    hw.encoder.ref = 15
  }
  return hw
}

export const defaultMessagesFor = (m) => (m === 'S8_CLASSIC' ? defaultMessagesS8() : defaultMessages())
export const defaultActiveFor = (m) => (m === 'S8_CLASSIC' ? '01' : 'PRUEBA')

function freshMachineData(m) {
  const hw = machineHw(m, defaultHardware())
  hw.encoder.division = hw.encoder.ref
  if (m === 'S8_CLASSIC') {
    hw.agitator = false
    hw.airKit = { enabled: false, inlet: 0, regulator: 0, purged: false }
  }
  return { messages: defaultMessagesFor(m), activeMessage: defaultActiveFor(m), opvars: defaultOpvars(), hw }
}

// Asegura que el estado corresponde al equipo elegido en el menú
export function applyMachine(s) {
  const m = s.ui.machine
  if (!s.fw) s.fw = {}
  if (!s.stash) s.stash = {}
  if (!s.fw[m]) s.fw[m] = FIRMWARE[m].init()
  if (s.loadedMachine !== m) {
    if (s.loadedMachine) s.stash[s.loadedMachine] = { messages: s.messages, activeMessage: s.activeMessage, opvars: s.opvars, hw: s.hw }
    const data = s.stash[m] || freshMachineData(m)
    s.messages = data.messages
    s.activeMessage = data.activeMessage
    s.opvars = data.opvars
    s.hw = data.hw
    delete s.stash[m]
    s.loadedMachine = m
    s.editing = null
    s.prints = []
    s.faults = {}
    s.jetState = 'STOPPED'
    s.power = m === 'S8_CLASSIC' ? 'OFF' : 'ON'
    s.fw[m] = FIRMWARE[m].init()
  }
  machineHw(m, s.hw)
}

// Restablece los mensajes de ejemplo del equipo actual (escenarios de misión/lección)
export function ensureDefaultMessages(s, names) {
  const defs = defaultMessagesFor(s.ui.machine)
  for (const n of names || Object.keys(defs)) if (!s.messages[n]) s.messages[n] = defs[n]
}

export function resetMessages(s) {
  s.messages = defaultMessagesFor(s.ui.machine)
  s.activeMessage = defaultActiveFor(s.ui.machine)
}
