// Preparación de escenarios para lecciones y misiones (estado de partida conocido).
import { defaultHidden, defaultHardware } from './defaults.js'
import { FIRMWARE, ensureDefaultMessages, resetMessages, machineHw } from '../machines/firmware.js'

export function prep(s, { power = 'ON', jet = 'RUNNING', resetMsgs = false, keepMessages = false } = {}) {
  const m = s.ui.machine
  const hwDef = defaultHardware()
  s.hidden = { ...defaultHidden(), inkLevel: Math.max(s.hidden?.inkLevel ?? 80, 60) }
  s.faults = {}
  s.paused = false
  s.adjustMode = false
  s.diag = { running: null, progress: 0, lastLeak: null, done: {} }
  s.hw.jet = { ...hwDef.jet }
  s.hw.faultInhibit = { cover: false, recup: false }
  s.hw.encoder = { ...hwDef.encoder }
  s.hw.io = structuredClone(hwDef.io)
  s.hw.startMode = 'AUTO'
  s.hw.clockStop = false
  s.hw.head = { ...hwDef.head }
  machineHw(m, s.hw)
  s.hw.head.orient = m === 'M9040' ? { j1: 0, j2: 0 } : undefined
  s.hw.head.skew = 0
  s.hw.encoder.division = s.hw.encoder.ref
  s.line.running = true
  s.line.speed = 30
  s.line.sensorType = 'PNP'
  s.rtcOffset = s.rtcOffset || 0
  if (resetMsgs) resetMessages(s)
  else if (!keepMessages) ensureDefaultMessages(s)
  s.power = power
  s.powerTimer = 0
  s.jetState = power === 'ON' ? jet : 'STOPPED'
  s.jetTimer = 0
  if (s.jetState === 'RUNNING') {
    s.live.pressure = s.hw.jet.pressureSet
    s.live.eht = s.hw.jet.ehtSet
  } else {
    s.live.pressure = 0
    s.live.eht = 0
  }
  s.timers = { recup: 0, pressure: 0, phase: 0 }
  s.editing = null
  s.prints = []
  s.fw[m] = FIRMWARE[m].init()
}
