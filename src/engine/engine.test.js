import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { reducer } from '../state/reducer.js'
import { createInitialState, canPrint } from './sim.js'
import { rtcNow, offsetFor, shiftCode, formatDate, addDays } from './rtc.js'
import { breakoffDrops, jetVelocity, phasePattern, phaseOk } from './jet.js'
import { rasterMessage } from './render.js'
import { F, T } from './defaults.js'
import { applyMachine } from '../machines/firmware.js'
import { lessonsFor, currentStep, targetKey } from './training.js'
import { missionsFor, missionDef, missionHintKey } from './missions.js'
import * as S8 from '../machines/s8classic/firmware.js'

let s
const d = (a) => (s = reducer(s, a))
function run(ms, step = 250) {
  for (let t = 0; t < ms; t += step) {
    vi.advanceTimersByTime(step)
    d({ type: 'TICK', dt: step })
  }
}
function boot(machine) {
  s = createInitialState()
  s.ui.machine = machine
  applyMachine(s)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 30, 10, 0, 0))
  boot('M9040')
})
afterEach(() => vi.useRealTimers())

describe('RTC con offset', () => {
  it('mantiene el avance tras ajuste manual', () => {
    const off = offsetFor(new Date(2026, 9, 30, 6, 0, 0))
    expect(rtcNow(off).getHours()).toBe(6)
    vi.advanceTimersByTime(65_000)
    const n = rtcNow(off)
    expect([n.getHours(), n.getMinutes(), n.getSeconds()]).toEqual([6, 1, 5])
  })
  it('turnos 01/02/03 con inicio 07:00 e intervalo 08:00', () => {
    const sh = { start: '07:00', interval: '08:00', type: '01', codes: [] }
    const at = (h, m = 0) => shiftCode(new Date(2026, 0, 1, h, m), sh)
    expect([at(7), at(14, 59), at(15), at(22, 59), at(23), at(3), at(6, 59)]).toEqual(['01', '01', '02', '02', '03', '03', '03'])
  })
  it('formatos de fecha', () => {
    const x = new Date(2026, 9, 30)
    expect(formatDate(x, 'DD/MM/YY')).toBe('30/10/26')
    expect(formatDate(x, 'JJJY')).toBe('3036')
    expect(formatDate(addDays(x, 365), 'DD/MM/YYYY')).toBe('30/10/2027')
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
    expect(breakoffDrops(95, 62.5, jetVelocity(2.9))).toBeGreaterThan(14)
    expect(phaseOk(phasePattern(16, 3))).toBe(false)
  })
})

describe('Render de mensajes', () => {
  it('apila líneas y respeta alturas', () => {
    const r = rasterMessage(s.messages.LOTE_A1, { now: new Date(2026, 9, 30, 8, 5), opvars: [], v24: {} })
    expect(r.height).toBe(7 + 1 + 7)
  })
  it('códigos de barras Code 128, Code 39 y 2/5', () => {
    for (const symbology of ['CODE128', 'CODE39', 'ITF']) {
      const m = { ...s.messages.PRUEBA, lines: [[F('barcode', { symbology, source: 'text', value: '1234', height: 12 }), T('X')]] }
      const r = rasterMessage(m, { now: new Date(), opvars: [], v24: {} })
      expect(r.height).toBe(12)
      expect(r.width).toBeGreaterThan(30)
    }
  })
})

describe('Equipos', () => {
  it('cada equipo conserva sus mensajes y su número de chorros', () => {
    boot('S8_CLASSIC')
    expect(Object.keys(s.messages)).toContain('02')
    expect(s.hw.head.jets).toBe(1)
    expect(s.power).toBe('OFF')
    d({ type: 'UI_SET', patch: { machine: 'M9040' } })
    expect(s.messages.LOTE_A1).toBeTruthy()
    expect(s.hw.head.jets).toBe(2)
    d({ type: 'UI_SET', patch: { machine: 'S8_CLASSIC' } })
    expect(s.messages['02']).toBeTruthy()
  })
  it('S8 Classic: ON/OFF arranca y la pantalla pasa de «ON/OFF?» a «Function?...»', () => {
    boot('S8_CLASSIC')
    expect(S8.view(s).text).toBe('ON/OFF?')
    d({ type: 'KEY', key: 'ONOFF' })
    run(12000)
    expect(s.jetState).toBe('RUNNING')
    expect(S8.view(s).text).toBe('Function?...')
    run(1500)
    expect(canPrint(s)).toBe(true)
  })
  it('S8 Classic: hora 06:00 con [DATE] [DOWN] cifras [UP]', () => {
    boot('S8_CLASSIC')
    d({ type: 'KEY', key: 'ONOFF' })
    run(4000)
    for (const k of ['DATE', 'DOWN', '0', '6', '0', '0', '0', '0', 'UP']) d({ type: 'KEY', key: k })
    expect(rtcNow(s.rtcOffset).getHours()).toBe(6)
    expect(S8.view(s).text.startsWith('Time (HMS) : 06.00.0')).toBe(true)
  })
})

// --------------------------------------------------- piloto automático
// Recorre una lección o misión pulsando SOLO la tecla que señala el tutor;
// los pasos físicos (▤ Línea) se resuelven como lo haría el operador.
function physical(st) {
  const txt = `${st.drawer || ''} ${st.hint || ''} ${st.text || ''} ${st.say || ''}`
  const L = s.live
  if (/pot|Potenci/i.test(txt) && !(L.breakoff >= 8 && L.breakoff <= 10 && L.phaseOk)) d({ type: 'SET_HW', path: 'jet.modulation', value: 200 })
  if (/cams|Levas|Excéntricas/i.test(txt) && !L.gutterOk) {
    d({ type: 'SET_HW', path: 'jet.alignX', value: -s.hidden.biasX })
    d({ type: 'SET_HW', path: 'jet.alignY', value: -s.hidden.biasY })
  }
  if (/Limpiar placas/i.test(txt) && s.hidden.platesDirt > 0.3 && !s.diag.running) d({ type: 'DIAG_START', step: 'CLEAN' })
  if (/Secar/i.test(txt) && s.hidden.platesWet && !s.diag.running) d({ type: 'DIAG_START', step: 'DRY' })
  if (/Rellenar tinta/i.test(txt) && s.hidden.inkLevel < 50) d({ type: 'INK_SET', level: 98 })
  if (/Terminal V24/i.test(txt)) d({ type: 'V24_FRAME', data: 'PED123' })
}

function missionStep() {
  const def = missionDef(s.mission.machine, s.mission.id)
  return def.steps[s.mission.done.findIndex((x) => !x)]
}

function drive(kind) {
  const keys = []
  for (let it = 0; it < 3000; it++) {
    const done = kind === 'lesson' ? s.lesson?.completedAt : s.mission?.completedAt
    if (done) return { ok: true, keys: keys.length }
    const st = kind === 'lesson' ? currentStep(s) : missionStep()
    if (kind === 'lesson' && st.next) {
      d({ type: 'LESSON_NEXT' })
      continue
    }
    const key = kind === 'lesson' ? targetKey(s) : missionHintKey(s)
    if (key) {
      keys.push(key)
      d({ type: 'KEY', key })
      run(100, 100)
    } else {
      physical(st)
      run(500)
    }
  }
  const st = kind === 'lesson' ? currentStep(s) : missionStep()
  return { ok: false, step: st?.say || st?.text, last: keys.slice(-12).join(' '), scr: JSON.stringify(s.fw[s.ui.machine]).slice(0, 300) }
}

for (const machine of ['S8_CLASSIC', 'M9040']) {
  describe(`Entrenamiento guiado · ${machine}`, () => {
    for (const lesson of lessonsFor(machine)) {
      it(`lección «${lesson.title}» se completa siguiendo al tutor`, () => {
        boot(machine)
        d({ type: 'LESSON_START', id: lesson.id })
        const r = drive('lesson')
        expect(r.ok, JSON.stringify(r)).toBe(true)
      })
    }
  })
  describe(`Misiones · ${machine}`, () => {
    for (const m of missionsFor(machine)) {
      it(`misión ${m.id} «${m.title}» se completa siguiendo las pistas`, () => {
        boot(machine)
        d({ type: 'MISSION_START', id: m.id })
        const r = drive('mission')
        expect(r.ok, JSON.stringify(r)).toBe(true)
        expect(s.progress[machine][m.id]).toBeTruthy()
      })
    }
  })
}
