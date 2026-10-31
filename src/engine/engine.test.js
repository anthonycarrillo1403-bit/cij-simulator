import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { reducer } from '../state/reducer.js'
import { createInitialState, canPrint } from './sim.js'
import { rtcNow, offsetFor, shiftCode, formatDate, addDays } from './rtc.js'
import { breakoffDrops, jetVelocity, phasePattern, phaseOk } from './jet.js'
import { MISSIONS } from './missions.js'
import { rasterMessage } from './render.js'
import { F, T } from './defaults.js'

let s
const d = (a) => (s = reducer(s, a))
function run(ms) {
  for (let t = 0; t < ms; t += 250) {
    vi.advanceTimersByTime(250)
    d({ type: 'TICK', dt: 250 })
  }
}
const mission = () => s.mission
const doneCount = () => mission().done.filter(Boolean).length

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 30, 10, 0, 0))
  s = createInitialState()
})
afterEach(() => vi.useRealTimers())

describe('RTC con offset', () => {
  it('mantiene el avance tras ajuste manual', () => {
    const target = new Date(2026, 9, 30, 6, 0, 0)
    const off = offsetFor(target)
    expect(rtcNow(off).getHours()).toBe(6)
    vi.advanceTimersByTime(65_000)
    const n = rtcNow(off)
    expect(n.getHours()).toBe(6)
    expect(n.getMinutes()).toBe(1)
    expect(n.getSeconds()).toBe(5)
  })
  it('turnos T1/T2/T3 con inicio 07:00 e intervalo 08:00', () => {
    const sh = { start: '07:00', interval: '08:00', type: 'CIFRAS', codes: ['T1', 'T2', 'T3'] }
    const at = (h, m = 0) => shiftCode(new Date(2026, 0, 1, h, m), sh)
    expect(at(7)).toBe('T1')
    expect(at(14, 59)).toBe('T1')
    expect(at(15)).toBe('T2')
    expect(at(22, 59)).toBe('T2')
    expect(at(23)).toBe('T3')
    expect(at(3)).toBe('T3')
    expect(at(6, 59)).toBe('T3')
  })
  it('formatos de fecha', () => {
    const x = new Date(2026, 9, 30)
    expect(formatDate(x, 'DD/MM/YY')).toBe('30/10/26')
    expect(formatDate(x, 'JJJY')).toBe('3036')
    expect(formatDate(addDays(x, 365), 'DD/MM/YYYY')).toBe('30/10/2027')
    expect(formatDate(x, 'DD-MMM-YY')).toBe('30-OCT-26')
  })
})

describe('Modelo de chorro', () => {
  it('valores nominales dejan el punto de quiebra en 8-10 gotas', () => {
    const b = breakoffDrops(200, 62.5, jetVelocity(2.9))
    expect(b).toBeGreaterThanOrEqual(8)
    expect(b).toBeLessThanOrEqual(10)
    expect(phaseOk(phasePattern(b, 0))).toBe(true)
  })
  it('modulación baja aleja el punto de quiebra', () => {
    expect(breakoffDrops(95, 57, jetVelocity(2.9))).toBeGreaterThan(14)
    expect(phaseOk(phasePattern(16, 3))).toBe(false)
  })
})

describe('Render de mensajes', () => {
  it('apila líneas y respeta alturas', () => {
    const m = createInitialState().messages.LOTE_A1
    const r = rasterMessage(m, { now: new Date(2026, 9, 30, 8, 5), opvars: [], v24: {} })
    expect(r.height).toBe(7 + 1 + 7)
    expect(r.width).toBeGreaterThan(40)
  })
  it('Code 128 + texto en una línea', () => {
    const m = { ...createInitialState().messages.PRUEBA, lines: [[F('barcode', { symbology: 'CODE128', source: 'text', value: 'ABC', height: 12 }), T('X')]] }
    const r = rasterMessage(m, { now: new Date(), opvars: [], v24: {} })
    expect(r.height).toBe(12)
  })
})

describe('Producción', () => {
  it('arranque de chorro y estado listo', () => {
    d({ type: 'JET_START' })
    run(6500)
    expect(s.jetState).toBe('RUNNING')
    run(1500)
    expect(canPrint(s)).toBe(true)
    const prints = s.stats.prints
    run(3000)
    expect(s.stats.prints).toBeGreaterThan(prints)
  })
  it('tecla MARCHA/PARADA apaga y enciende con arranque automático', () => {
    d({ type: 'POWER_TOGGLE' })
    run(6000)
    expect(s.power).toBe('OFF')
    d({ type: 'POWER_TOGGLE' })
    run(3500)
    expect(s.power).toBe('ON')
    expect(['STARTING', 'RUNNING']).toContain(s.jetState)
  })
})

// --------------------------------------------------- recorridos de misiones
const startJetAndWait = () => {
  d({ type: 'JET_START' })
  run(8000)
}

describe('Misiones (recorrido completo)', () => {
  it('hay 15 misiones con pasos', () => {
    expect(MISSIONS).toHaveLength(15)
    MISSIONS.forEach((m) => expect(m.steps.length).toBeGreaterThan(1))
  })

  it('M01 selección LOTE_A1', () => {
    d({ type: 'MISSION_START', id: 1 })
    d({ type: 'NAV', menu: 'PROD', tab: 1, view: 'select' })
    d({ type: 'SELECT_MESSAGE', name: 'LOTE_A1' })
    startJetAndWait()
    expect(mission().completedAt).toBeTruthy()
  })

  it('M02 caducidad +365', () => {
    d({ type: 'MISSION_START', id: 2 })
    d({ type: 'EDIT_OPEN', name: 'LOTE_A1' })
    d({ type: 'EDIT_INSERT', line: 0, field: { type: 'expiry', slot: 1, format: 'DD/MM/YY' } })
    d({ type: 'EDIT_SET', path: 'expiry.amount', value: 365 })
    d({ type: 'EDIT_LOAD_PRINTER' })
    expect(mission().completedAt).toBeTruthy()
  })

  it('M03 RTC 06:00 sigue avanzando', () => {
    d({ type: 'MISSION_START', id: 3 })
    d({ type: 'NAV', menu: 'PREP', tab: 0, view: 'clock' })
    d({ type: 'RTC_SET', y: 2026, mo: 10, d: 30, h: 6, m: 0 })
    run(5000)
    expect(doneCount()).toBe(2)
    run(6000)
    expect(mission().completedAt).toBeTruthy()
    expect(rtcNow(s.rtcOffset).getHours()).toBe(6)
  })

  it('M04 turnos', () => {
    d({ type: 'MISSION_START', id: 4 })
    d({ type: 'EDIT_OPEN', name: 'PRUEBA' })
    d({ type: 'EDIT_INSERT', line: 0, field: { type: 'shift' } })
    d({ type: 'EDIT_SET', path: 'shift', value: { start: '07:00', interval: '08:00', type: 'CIFRAS', codes: ['T1', 'T2', 'T3'] } })
    d({ type: 'EDIT_LOAD_PRINTER' })
    expect(doneCount()).toBe(4)
    d({ type: 'RTC_SET', y: 2026, mo: 10, d: 30, h: 16, m: 30 })
    expect(mission().completedAt).toBeTruthy()
  })

  it('M05 contador por fotocélula', () => {
    d({ type: 'MISSION_START', id: 5 })
    d({ type: 'EDIT_OPEN', name: 'PRUEBA' })
    d({ type: 'EDIT_INSERT', line: 0, field: { type: 'counter' } })
    d({ type: 'EDIT_SET', path: 'counter', value: { start: 1, end: 9999, step: 1, batch: 1, incType: 'OBJETOS', leadingZeros: true, cyclic: false, value: 1 } })
    d({ type: 'EDIT_INSERT', line: 0, field: { type: 'opvar', name: 'LOTE' } })
    d({ type: 'EDIT_LOAD_PRINTER' })
    expect(doneCount()).toBe(4)
    startJetAndWait()
    run(3000)
    expect(mission().completedAt).toBeTruthy()
    expect(s.messages.PRUEBA.counter.value).toBeGreaterThan(3)
  })

  it('M06 punto de quiebra', () => {
    d({ type: 'MISSION_START', id: 6 })
    d({ type: 'NAV', menu: 'PREP', tab: 1, view: 'jet' })
    startJetAndWait()
    expect(s.live.breakoff).toBeGreaterThan(12)
    d({ type: 'SET_HW', path: 'jet.piezoFreq', value: 62.5 })
    d({ type: 'SET_HW', path: 'jet.modulation', value: 200 })
    run(6000)
    expect(doneCount()).toBe(4)
    d({ type: 'JET_VALIDATE' })
    expect(mission().completedAt).toBeTruthy()
  })

  it('M07 centrado en canal (sin AJUSTE salta defecto de recuperación)', () => {
    d({ type: 'MISSION_START', id: 7 })
    startJetAndWait()
    run(2000)
    expect(s.faults.RECUP).toBeTruthy()
    d({ type: 'ADJUST_ENTER' })
    d({ type: 'SET_HW', path: 'jet.pressureSet', value: 2.9 })
    d({ type: 'SET_HW', path: 'jet.alignX', value: -85 })
    d({ type: 'SET_HW', path: 'jet.alignY', value: 50 })
    run(6000)
    expect(s.live.gutterOk).toBe(true)
    d({ type: 'ADJUST_EXIT' })
    run(3000)
    expect(s.faults.RECUP).toBeUndefined()
    expect(mission().completedAt).toBeTruthy()
  })

  it('M08 encoder', () => {
    d({ type: 'MISSION_START', id: 8 })
    d({ type: 'NAV', menu: 'PREP', tab: 2, view: 'encoder' })
    d({ type: 'SET_HW', path: 'encoder.source', value: 'ENCODER' })
    d({ type: 'SET_HW', path: 'encoder.division', value: 1500 })
    startJetAndWait()
    run(2000)
    expect(mission().completedAt).toBeTruthy()
  })

  it('M09 Code 128 por V24', () => {
    d({ type: 'MISSION_START', id: 9 })
    d({ type: 'SET_HW', path: 'v24.baud', value: 9600 })
    d({ type: 'EDIT_NEW', name: 'ERP128' })
    d({ type: 'EDIT_INSERT', line: 0, field: { type: 'barcode', symbology: 'CODE128', source: 'external', height: 14 } })
    d({ type: 'EDIT_LOAD_PRINTER' })
    d({ type: 'V24_FRAME', data: 'PED-778812' })
    startJetAndWait()
    run(1500)
    expect(mission().completedAt).toBeTruthy()
  })

  it('M10 agitador y kit aire', () => {
    d({ type: 'SET_MODEL', model: 'M9040' })
    d({ type: 'MISSION_START', id: 10 })
    expect(s.hw.model).toBe('S8_CONTRAST')
    run(500)
    expect(s.faults.AIR).toBeTruthy()
    d({ type: 'SET_HW', path: 'agitator', value: true })
    d({ type: 'SET_HW', path: 'airKit.enabled', value: true })
    d({ type: 'AIR_PURGE' })
    d({ type: 'SET_HW', path: 'airKit.regulator', value: 3.6 })
    d({ type: 'AIR_TEST' })
    run(10000)
    expect(mission().completedAt).toBeTruthy()
  })

  it('M11 bichorro', () => {
    d({ type: 'MISSION_START', id: 11 })
    d({ type: 'NAV', menu: 'PREP', tab: 1, view: 'head' })
    d({ type: 'SET_HW', path: 'head.delayJet2', value: 74 })
    startJetAndWait()
    run(1000)
    expect(mission().completedAt).toBeTruthy()
  })

  it('M12 E/S', () => {
    d({ type: 'MISSION_START', id: 12 })
    d({ type: 'NAV', menu: 'PREP', tab: 2, view: 'io' })
    startJetAndWait()
    expect(s.stats.missed).toBeGreaterThan(0) // fotocélula NPN no reconocida como PNP
    d({ type: 'IO_SET', dir: 'in', index: 0, fn: 'PHOTOCELL_NPN' })
    d({ type: 'IO_SET', dir: 'out', index: 1, fn: 'INK_LOW_LAMP' })
    run(1500)
    d({ type: 'INK_SET', level: 5 })
    run(500)
    d({ type: 'INK_SET', level: 95 })
    run(500)
    expect(mission().completedAt).toBeTruthy()
  })

  it('M13 THT', () => {
    d({ type: 'MISSION_START', id: 13 })
    run(500)
    expect(s.faults.EHT).toBeTruthy()
    d({ type: 'FAULT_VIEW', code: 'EHT' })
    d({ type: 'FAULT_ACK' })
    expect(s.faults.EHT).toBeTruthy() // la causa persiste
    run(5000)
    expect(s.jetState).toBe('STOPPED')
    d({ type: 'DIAG_START', step: 'CLEAN' })
    run(5500)
    d({ type: 'JET_START' })
    run(8000)
    expect(s.faults.EHT).toBeTruthy() // placas húmedas: vuelve a fallar
    run(5000)
    d({ type: 'DIAG_START', step: 'DRY' })
    run(8500)
    d({ type: 'DIAG_START', step: 'TEST' })
    run(3500)
    d({ type: 'FAULT_ACK' })
    expect(s.faults.EHT).toBeUndefined()
    startJetAndWait()
    expect(mission().completedAt).toBeTruthy()
  })

  it('M14 anchura y THT', () => {
    d({ type: 'MISSION_START', id: 14 })
    d({ type: 'NAV', menu: 'PREP', tab: 1, view: 'deflect' })
    d({ type: 'SET_ACTIVE_MSG', path: 'params.width', value: 100 })
    d({ type: 'SET_HW', path: 'jet.ehtSet', value: 7200 })
    startJetAndWait()
    run(1000)
    expect(mission().completedAt).toBeTruthy()
  })

  it('M15 cambio de turno en orden', () => {
    d({ type: 'MISSION_START', id: 15 })
    d({ type: 'SELECT_MESSAGE', name: 'CLIENTE_X' })
    d({ type: 'OPVAR_SET', name: 'LOTE', value: 'L0777' })
    d({ type: 'NAV', menu: 'PREP', tab: 0, view: 'clock' })
    startJetAndWait()
    d({ type: 'SET_HW', path: 'jet.modulation', value: 200 })
    run(3000)
    d({ type: 'JET_VALIDATE' })
    expect(doneCount()).toBe(4)
    d({ type: 'PAUSE_TOGGLE' })
    run(1500)
    expect(mission().completedAt).toBeTruthy()
  })

  it('M15 respeta el orden (validar antes de cargar mensaje no cuenta)', () => {
    d({ type: 'MISSION_START', id: 15 })
    startJetAndWait()
    d({ type: 'SET_HW', path: 'jet.modulation', value: 200 })
    run(2000)
    d({ type: 'JET_VALIDATE' })
    d({ type: 'SELECT_MESSAGE', name: 'CLIENTE_X' })
    d({ type: 'OPVAR_SET', name: 'LOTE', value: 'L0777' })
    d({ type: 'NAV', menu: 'PREP', tab: 0, view: 'clock' })
    expect(doneCount()).toBe(3)
  })
})
