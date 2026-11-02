// Estado inicial de la impresora simulada.
let uid = 1
export const newId = () => `f${Date.now().toString(36)}${(uid++).toString(36)}`

export const T = (value, extra = {}) => ({ id: newId(), type: 'text', value, font: '7x5', bold: 1, ...extra })
export const F = (type, extra = {}) => ({ id: newId(), type, font: '7x5', bold: 1, ...extra })

export function defaultMessageParams() {
  return {
    sense: 'DIRECTO', // sentido mensaje
    printSpeed: 500, // mm/s (modo velocidad constante)
    trigger: 'OBJETO', // MANUAL_OBJETO | MANUAL_AUTO | OBJETO | REPETITIVO
    repeat: 1,
    delayFwd: 50, // retardo ida (mm)
    delayRev: 50, // retardo vuelta (mm)
    dtopCancel: 20, // mm
    dtopFilter: 100, // µs
    width: 100, // anchura de impresión %
    din: false,
  }
}

export function makeMessage(name, lines, extra = {}) {
  return {
    name,
    lines,
    params: defaultMessageParams(),
    counter: { start: 1, end: 9999, step: 1, batch: 1, incType: 'OBJETOS', leadingZeros: true, cyclic: false, value: 1 },
    expiry: { amount: 30, unit: 'DIAS' },
    expiry2: { amount: 12, unit: 'MESES' },
    shift: { start: '06:00', interval: '08:00', type: 'LETRAS', codes: ['A', 'B', 'C'] },
    ...extra,
  }
}

export function defaultMessages() {
  return {
    PRUEBA: makeMessage('PRUEBA', [[T('IMAJE TEST 0123456789')]]),
    LOTE_A1: makeMessage('LOTE_A1', [
      [T('LOTE A1-'), F('date', { format: 'JJJY' })],
      [T('FAB '), F('date', { format: 'DD/MM/YY' }), T(' '), F('clock', { format: 'HH:MM' })],
    ]),
    LOTE_B2: makeMessage('LOTE_B2', [[T('LOTE B2 '), F('date', { format: 'DD.MM.YYYY' })]]),
    CLIENTE_X: makeMessage(
      'CLIENTE_X',
      [
        [T('CLIENTE X L:'), F('opvar', { name: 'LOTE' })],
        [T('CAD '), F('expiry', { slot: 1, format: 'DD/MM/YY' }), T(' T'), F('shift')],
      ],
      { expiry: { amount: 180, unit: 'DIAS' } },
    ),
    BARRAS_01: makeMessage('BARRAS_01', [
      [F('barcode', { symbology: 'CODE128', source: 'text', value: '7501234567', height: 14 }), T(' 7501234567')],
    ]),
    DM_9040: makeMessage('DM_9040', [
      [F('barcode', { symbology: 'DATAMATRIX', source: 'date' }), T(' EXP'), F('expiry', { slot: 1, format: 'MM/YY' })],
    ]),
  }
}

export const IO_INPUTS = {
  NONE: 'Sin asignar',
  PHOTOCELL_PNP: 'Fotocélula producto PNP',
  PHOTOCELL_NPN: 'Fotocélula producto NPN',
  ENCODER: 'Encoder / Tacómetro',
  INHIBIT: 'Inhibición de impresión',
  RESET_COUNTER: 'Reset contador',
}

export const IO_OUTPUTS = {
  NONE: 'Sin asignar',
  GENERAL_ALARM: 'Alarma general',
  JET_ALARM: 'Alarma chorro',
  INK_LOW_LAMP: 'Lámpara alarma falta de tinta',
  READY: 'Impresora lista',
  PRINT_END: 'Fin de impresión',
}

export const MODELS = {
  M9040_1: { label: '9040 monochorro', short: '9040', pigmented: false, airKit: false, opvars: true, datamatrix: true, lcd: '9040' },
  M9040: { label: '9040', short: '9040', pigmented: false, airKit: false, opvars: true, datamatrix: true, lcd: '9040' },
}

export function defaultHardware() {
  return {
    model: 'M9040_1',
    jet: {
      pressureSet: 2.9, // bar
      piezoFreq: 62.5, // kHz
      modulation: 200, // V (ajuste punto de quiebra)
      alignX: 0, // µm tornillo horizontal
      alignY: 0, // µm tornillo vertical
      ehtSet: 7200, // V
    },
    head: { jets: 1, delayJet1: 50, delayJet2: 74, physOffset: 24 },
    encoder: { source: 'CONSTANTE', division: 1000, ppr: 2500, wheelMm: 200 },
    io: { in: ['PHOTOCELL_PNP', 'NONE', 'NONE', 'NONE'], out: ['GENERAL_ALARM', 'NONE', 'NONE', 'NONE'] },
    agitator: true,
    airKit: { enabled: true, inlet: 6.0, regulator: 3.6, purged: true },
    v24: { baud: 9600, parity: 'NINGUNA', bits: 8, stop: 1, protocol: 'IMAJE', data: '', lastFrame: '' },
    startMode: 'AUTO',
    faultInhibit: { cover: false, recup: false },
    language: 'ESPAÑOL',
    autoClock: true,
    dateChange: '00:00', // Hora cambio fecha (hh:mm)
  }
}

// Condiciones ocultas de la máquina (escenarios de avería de las misiones)
export function defaultHidden() {
  return { biasX: 0, biasY: 0, platesDirt: 0.05, platesWet: false, dusty: false, inkLevel: 82, coverOpen: false }
}

export function defaultOpvars() {
  return [
    { name: 'LOTE', size: 8, def: 'L0001', value: 'L0001' },
    { name: 'OPERADOR', size: 10, def: 'OP1', value: 'OP1' },
    { name: 'PEDIDO', size: 12, def: '000000', value: '' },
  ]
}
