// Motor de simulación: transiciones de la impresora, chorro, defectos y línea de producción.
// Todas las funciones mutan el borrador `s` (el reducer trabaja sobre una copia).
import {
  defaultHardware, defaultHidden, defaultMessages, defaultOpvars, MODELS,
} from './defaults.js'
import {
  jetVelocity, breakoffDrops, phasePattern, phaseOk, gutterDeviation, ehtLeakage, headOverpressure,
  PRESSURE_MIN, PRESSURE_MAX, EHT_LEAK_LIMIT, EHT_NOMINAL, ENCODER_DIVISION_REF,
} from './jet.js'
import { FAULTS, isBlocking } from './faults.js'
import { rasterMessage } from './render.js'
import { rtcNow } from './rtc.js'

export const BOOT_MS = 3000
export const JET_START_MS = 6000
export const JET_STOP_MS = 4000
export const DIAG_MS = { CLEAN: 5000, DRY: 8000, TEST: 3000 }

export function createInitialState() {
  return {
    version: 1,
    hw: defaultHardware(),
    hidden: defaultHidden(),
    messages: defaultMessages(),
    activeMessage: 'PRUEBA',
    opvars: defaultOpvars(),
    rtcOffset: 0,
    rtcLastSet: null,
    power: 'ON',
    powerTimer: 0,
    jetState: 'STOPPED',
    jetTimer: 0,
    adjustMode: false,
    paused: false,
    live: {
      pressure: 0, velocity: 0, breakoff: 0, phase: '00000000', phaseOk: false,
      devX: 0, devY: 0, gutterOk: false, recovery: 0, eht: 0, leak: 0,
      overpressure: false, sediment: 10, temp: 31, phaseStableMs: 0,
    },
    timers: { recup: 0, pressure: 0, phase: 0 },
    faults: {},
    faultLog: [],
    line: { running: true, speed: 30, pitch: 250, travel: 0, sensorType: 'PNP' },
    stats: { prints: 0, products: 0, missed: 0 },
    prints: [],
    lastPrintAt: 0,
    diag: { running: null, progress: 0, lastLeak: null, done: {} },
    editing: null,
    nav: { menu: 'HOME', tab: 0, view: null },
    events: [],
    seq: 0,
    mission: null,
    progress: {},
  }
}

export const modelInfo = (s) => MODELS[s.hw.model] || MODELS.S8_CONTRAST

export function pushEvent(s, type, data = {}) {
  s.seq += 1
  s.events.push({ seq: s.seq, type, t: Date.now(), ...data })
  if (s.events.length > 400) s.events.splice(0, s.events.length - 400)
}

export function raiseFault(s, code) {
  if (s.faults[code]) return
  s.faults[code] = { since: Date.now(), viewed: false }
  s.faultLog.unshift({ code, t: Date.now(), kind: 'ON' })
  s.faultLog = s.faultLog.slice(0, 40)
  pushEvent(s, 'FAULT_ON', { code })
  if (isBlocking(code) && (s.jetState === 'RUNNING' || s.jetState === 'STARTING')) {
    s.jetState = 'STOPPING'
    s.jetTimer = JET_STOP_MS
    s.adjustMode = false
  }
}

function clearAlarm(s, code) {
  if (!s.faults[code]) return
  delete s.faults[code]
  s.faultLog.unshift({ code, t: Date.now(), kind: 'OFF' })
  pushEvent(s, 'FAULT_OFF', { code })
}

export const activeFaults = (s) => Object.keys(s.faults)
export const blockingFaults = (s) => activeFaults(s).filter(isBlocking)

// Condición física actual que sostiene un defecto (para la anulación).
export function faultConditionPresent(s, code) {
  switch (code) {
    case 'EHT':
      return ehtLeakage(s.hidden) > EHT_LEAK_LIMIT
    case 'RECUP':
      return false
    case 'PRESSURE':
      return s.hw.jet.pressureSet < PRESSURE_MIN || s.hw.jet.pressureSet > PRESSURE_MAX
    case 'COVER':
      return s.hidden.coverOpen
    default:
      return false
  }
}

export function acknowledgeFaults(s) {
  let cleared = 0
  for (const code of activeFaults(s)) {
    if (isBlocking(code) && !faultConditionPresent(s, code)) {
      delete s.faults[code]
      s.faultLog.unshift({ code, t: Date.now(), kind: 'ACK' })
      cleared++
    }
  }
  pushEvent(s, 'FAULT_ACK', { cleared, remaining: activeFaults(s) })
  return cleared
}

export function canPrint(s) {
  return (
    s.power === 'ON' &&
    s.jetState === 'RUNNING' &&
    !s.adjustMode &&
    !s.paused &&
    blockingFaults(s).length === 0 &&
    s.live.eht >= 0.9 * s.hw.jet.ehtSet &&
    Boolean(s.messages[s.activeMessage])
  )
}

export function statusLabel(s) {
  if (s.power === 'OFF') return 'APAGADA'
  if (s.power === 'BOOT') return 'ARRANQUE EN CURSO…'
  if (s.power === 'STOPPING') return 'PARO EN CURSO…'
  if (blockingFaults(s).length) return 'DEFECTO'
  if (s.jetState === 'STARTING') return 'ARRANQUE CHORRO…'
  if (s.jetState === 'STOPPING') return 'PARO CHORRO…'
  if (s.jetState === 'STOPPED') return 'CHORRO PARADO'
  if (s.adjustMode) return 'AJUSTE CHORRO'
  if (s.paused) return 'IMPRESIÓN EN PAUSA'
  if (!canPrint(s)) return 'CHORRO EN MARCHA'
  return Date.now() - s.lastPrintAt < 1500 ? 'IMPRIMIENDO' : 'LISTO'
}

export function startPrinter(s) {
  if (s.power !== 'OFF') return
  s.power = 'BOOT'
  s.powerTimer = BOOT_MS
  pushEvent(s, 'POWER_ON')
}

export function stopPrinter(s) {
  if (s.power !== 'ON') return
  s.power = 'STOPPING'
  s.powerTimer = JET_STOP_MS + 1000
  if (s.jetState !== 'STOPPED') {
    s.jetState = 'STOPPING'
    s.jetTimer = JET_STOP_MS
  }
  s.adjustMode = false
  pushEvent(s, 'POWER_OFF')
}

export function startJet(s) {
  if (s.power !== 'ON') return false
  if (s.jetState === 'RUNNING' || s.jetState === 'STARTING') return false
  if (blockingFaults(s).length) {
    pushEvent(s, 'JET_START_REFUSED', { faults: blockingFaults(s) })
    return false
  }
  s.jetState = 'STARTING'
  s.jetTimer = JET_START_MS
  s.timers = { recup: 0, pressure: 0, phase: 0 }
  pushEvent(s, 'JET_START')
  return true
}

export function stopJet(s) {
  if (s.jetState === 'STOPPED' || s.jetState === 'STOPPING') return
  s.jetState = 'STOPPING'
  s.jetTimer = JET_STOP_MS
  s.adjustMode = false
  pushEvent(s, 'JET_STOP')
}

// Factores de deformación del marcaje
export function printGeometry(s) {
  const m = s.messages[s.activeMessage]
  const lineMmS = (s.line.speed * 1000) / 60
  let wf
  if (s.hw.encoder.source === 'ENCODER') wf = s.hw.encoder.division / ENCODER_DIVISION_REF
  else wf = lineMmS / Math.max(1, m?.params.printSpeed || 500)
  wf *= (m?.params.width || 100) / 100
  const hf = (s.live.eht || s.hw.jet.ehtSet) / EHT_NOMINAL
  const twinOffset = s.hw.head.jets === 2 ? s.hw.head.delayJet2 - s.hw.head.delayJet1 - s.hw.head.physOffset : 0
  return { wf, hf, twinOffset }
}

export function printOnce(s, cause = 'PHOTOCELL') {
  if (!canPrint(s)) {
    if (cause === 'PHOTOCELL') s.stats.missed += 1
    pushEvent(s, 'PRINT_REFUSED', { cause })
    return false
  }
  const m = s.messages[s.activeMessage]
  const now = rtcNow(s.rtcOffset)
  const r = rasterMessage(m, { now, opvars: s.opvars, v24: s.hw.v24 })
  let bits = ''
  for (const col of r.cols) for (const d of col) bits += d ? '1' : '0'
  const g = printGeometry(s)
  const quality = s.live.phaseOk ? (s.faults.SEDIMENT ? 0.75 : 1) : 0.55
  const counterBefore = m.counter.value
  const repeat = Math.max(1, m.params.repeat || 1)
  s.prints.unshift({ id: s.stats.prints + 1, t: Date.now(), w: r.width, h: r.height, bits, ...g, quality, repeat, msg: m.name, lines: r.lineCount })
  s.prints = s.prints.slice(0, 5)
  s.stats.prints += repeat
  s.lastPrintAt = Date.now()
  s.hidden.inkLevel = Math.max(0, s.hidden.inkLevel - 0.004 * repeat)
  // contador
  const c = m.counter
  const ticks = c.incType === 'MENSAJES' ? repeat : 1
  for (let k = 0; k < ticks; k++) {
    c.batchCount = (c.batchCount || 0) + 1
    if (c.batchCount >= Math.max(1, c.batch)) {
      c.batchCount = 0
      const up = c.end >= c.start
      let v = c.value + (up ? c.step : -c.step)
      if (up ? v > c.end : v < c.end) v = c.start
      c.value = v
    }
  }
  pushEvent(s, 'PRINT', { cause, msg: m.name, counterBefore, counterAfter: c.value, ...g, quality })
  return true
}

function photocellAssigned(s) {
  const want = s.line.sensorType === 'NPN' ? 'PHOTOCELL_NPN' : 'PHOTOCELL_PNP'
  return s.hw.io.in.includes(want)
}

export function productPasses(s) {
  s.stats.products += 1
  if (s.hw.io.in.includes('INHIBIT') && s.hidden.inhibit) return
  if (!photocellAssigned(s)) {
    s.stats.missed += 1
    return
  }
  const trig = s.messages[s.activeMessage]?.params.trigger
  if (trig === 'MANUAL_OBJETO' || trig === 'MANUAL_AUTO') return
  printOnce(s, 'PHOTOCELL')
}

export function outputsState(s) {
  const faults = activeFaults(s)
  const map = {
    NONE: false,
    GENERAL_ALARM: faults.length > 0,
    JET_ALARM: blockingFaults(s).length > 0,
    INK_LOW_LAMP: Boolean(s.faults.INK_LOW),
    READY: canPrint(s),
    PRINT_END: Date.now() - s.lastPrintAt < 400,
  }
  return s.hw.io.out.map((fn) => map[fn] || false)
}

export function tick(s, dt) {
  const mi = modelInfo(s)
  // --- alimentación
  if (s.power === 'BOOT') {
    s.powerTimer -= dt
    if (s.powerTimer <= 0) {
      s.power = 'ON'
      pushEvent(s, 'POWER_READY')
      if (s.hw.startMode === 'AUTO') startJet(s)
    }
  } else if (s.power === 'STOPPING') {
    s.powerTimer -= dt
    if (s.powerTimer <= 0) s.power = 'OFF'
  }
  // --- chorro
  if (s.jetState === 'STARTING') {
    s.jetTimer -= dt
    if (s.hidden.coverOpen) raiseFault(s, 'COVER')
    if (s.jetTimer <= 0 && s.jetState === 'STARTING') {
      s.jetState = 'RUNNING'
      pushEvent(s, 'JET_RUNNING')
      if (ehtLeakage(s.hidden) > EHT_LEAK_LIMIT) raiseFault(s, 'EHT')
    }
  } else if (s.jetState === 'STOPPING') {
    s.jetTimer -= dt
    if (s.jetTimer <= 0) {
      s.jetState = 'STOPPED'
      pushEvent(s, 'JET_STOPPED')
    }
  }
  const jetOn = s.jetState === 'RUNNING' || s.jetState === 'STARTING'
  const L = s.live
  const k = 1 - Math.exp(-dt / 1200)
  const target = jetOn ? s.hw.jet.pressureSet : 0
  L.pressure += (target - L.pressure) * k
  if (jetOn) L.pressure += (Math.random() - 0.5) * 0.006
  L.pressure = Math.max(0, L.pressure)
  L.velocity = jetOn ? jetVelocity(L.pressure) : 0
  if (jetOn && L.pressure > 1) {
    L.breakoff = breakoffDrops(s.hw.jet.modulation, s.hw.jet.piezoFreq, L.velocity)
    L.phase = s.jetState === 'RUNNING' ? phasePattern(L.breakoff, Date.now() / 1000) : '00000000'
  } else {
    L.breakoff = 0
    L.phase = '00000000'
  }
  L.phaseOk = phaseOk(L.phase)
  L.phaseStableMs = L.phaseOk && L.breakoff >= 8 && L.breakoff <= 10 ? L.phaseStableMs + dt : 0
  const g = gutterDeviation(s.hw.jet, s.hidden, jetOn ? L.pressure : s.hw.jet.pressureSet)
  L.devX = g.devX
  L.devY = g.devY
  L.gutterOk = g.ok
  L.recovery = jetOn ? g.recovery : 0
  L.leak = ehtLeakage(s.hidden)
  const ehtTarget = s.jetState === 'RUNNING' && !s.faults.EHT && !s.adjustMode ? s.hw.jet.ehtSet : 0
  L.eht += (ehtTarget - L.eht) * (1 - Math.exp(-dt / 400))
  if (Math.abs(L.eht - ehtTarget) < 5) L.eht = ehtTarget
  L.overpressure = headOverpressure(s.hw, mi, s.hw.jet.pressureSet)
  L.temp = 31 + Math.sin(Date.now() / 60000) * 1.5
  if (mi.pigmented) {
    const rate = s.hw.agitator ? -4 : 1.5
    L.sediment = Math.max(0, Math.min(100, L.sediment + (rate * dt) / 1000))
  } else L.sediment = 0

  // --- defectos
  if (s.jetState === 'RUNNING') {
    s.timers.recup = !s.adjustMode && L.recovery < 60 ? s.timers.recup + dt : 0
    if (s.timers.recup > 2000) raiseFault(s, 'RECUP')
    s.timers.pressure = L.pressure < PRESSURE_MIN || L.pressure > PRESSURE_MAX ? s.timers.pressure + dt : 0
    if (s.timers.pressure > 3000) raiseFault(s, 'PRESSURE')
    if (L.leak > EHT_LEAK_LIMIT && !s.adjustMode) raiseFault(s, 'EHT')
    s.timers.phase = !L.phaseOk ? s.timers.phase + dt : 0
    if (s.timers.phase > 5000) raiseFault(s, 'PHASE')
    else if (L.phaseOk) clearAlarm(s, 'PHASE')
  } else {
    clearAlarm(s, 'PHASE')
  }
  if (s.hidden.inkLevel < 10) raiseFault(s, 'INK_LOW')
  else clearAlarm(s, 'INK_LOW')
  if (mi.pigmented && L.sediment > 70) raiseFault(s, 'SEDIMENT')
  else if (L.sediment < 40) clearAlarm(s, 'SEDIMENT')
  if (s.hidden.dusty && !L.overpressure && s.power === 'ON') raiseFault(s, 'AIR')
  else clearAlarm(s, 'AIR')

  // --- diagnóstico THT
  if (s.diag.running) {
    s.diag.progress += dt
    const total = DIAG_MS[s.diag.running]
    if (s.diag.progress >= total) finishDiag(s)
  }

  // --- línea de producción
  if (s.line.running && s.line.speed > 0) {
    s.line.travel += ((s.line.speed * 1000) / 60) * (dt / 1000)
    let guard = 0
    while (s.line.travel >= s.line.pitch && guard++ < 10) {
      s.line.travel -= s.line.pitch
      productPasses(s)
    }
  }
}

export function startDiag(s, step) {
  if (s.diag.running) return { ok: false, msg: 'Secuencia en curso' }
  if (s.jetState !== 'STOPPED') return { ok: false, msg: 'Pare el chorro antes de intervenir en el cabezal' }
  s.diag.running = step
  s.diag.progress = 0
  pushEvent(s, 'DIAG_START', { step })
  return { ok: true }
}

function finishDiag(s) {
  const step = s.diag.running
  s.diag.running = null
  s.diag.progress = 0
  if (step === 'CLEAN') {
    s.hidden.platesDirt = 0.02
    s.hidden.platesWet = true
  } else if (step === 'DRY') {
    s.hidden.platesWet = false
  }
  const leak = ehtLeakage(s.hidden)
  if (step === 'TEST') s.diag.lastLeak = leak
  s.diag.done[step] = Date.now()
  pushEvent(s, 'DIAG_DONE', { step, leak, ok: leak <= EHT_LEAK_LIMIT })
}

export { FAULTS, rtcNow }
