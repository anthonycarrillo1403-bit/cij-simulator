// Firmware de cada equipo y cambio de equipo (cada uno conserva sus mensajes y su hardware).
// Equipo A (M9040_1) = 9040 monochorro, Equipo B (M9040) = 9040 bichorro: mismo firmware.
import * as M9 from './m9040/firmware.js'
import { defaultHardware, defaultOpvars, defaultMessages } from '../engine/defaults.js'

const FW9040 = {
  init: M9.initFw,
  press: M9.press,
  view: M9.view,
  leds: M9.leds,
  input: M9.input,
  typingKey: M9.typingKey,
  navKey: M9.navKey,
  fromKeyboard: M9.fromKeyboard,
  screenId: M9.screenId,
}

export const FIRMWARE = { M9040_1: FW9040, M9040: FW9040 }
export const jetsOf = (m) => (m === 'M9040' ? 2 : 1)

// Hardware propio de cada equipo (número de chorros, referencia del tacómetro, orientación)
export function machineHw(m, hw) {
  hw.model = m
  hw.head = { ...hw.head, jets: jetsOf(m) }
  if (jetsOf(m) === 2) {
    hw.head.orient = hw.head.orient || { j1: 0, j2: 0 }
    hw.head.skew = hw.head.skew || 0
  } else {
    delete hw.head.orient
    hw.head.skew = 0
  }
  hw.encoder.ref = 12
  return hw
}

export const defaultMessagesFor = () => defaultMessages()
export const defaultActiveFor = () => 'PRUEBA'

function freshMachineData(m) {
  const hw = machineHw(m, defaultHardware())
  hw.encoder.division = hw.encoder.ref
  hw.agitator = false
  hw.airKit = { enabled: false, inlet: 0, regulator: 0, purged: false }
  return { messages: defaultMessagesFor(m), activeMessage: defaultActiveFor(m), opvars: defaultOpvars(), hw }
}

// Asegura que el estado corresponde al equipo elegido en el menú
export function applyMachine(s) {
  if (!FIRMWARE[s.ui.machine]) s.ui.machine = 'M9040_1'
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
    s.power = 'ON'
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
