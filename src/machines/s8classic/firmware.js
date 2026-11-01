// Firmware simulado del Imaje S8 Classic (software D80): visualizador de 1 línea × 40 caracteres.
// Árbol de funciones, textos y teclas según el manual A20733 (I1–I10, M1–M32, E1–E13).
// Textos de pantalla en inglés, tal como aparecen en el manual del equipo.
//
// Teclas (id → tecla del panel):
//   ONOFF, ALT, F, FAULT (☹?/llave), EDIT (lápiz), AA (Aa), DATE (calendario+reloj), CNT (001),
//   PARAM (márgenes+documentos), UP (salir/borrar), DOWN (insertar/seleccionar/modificar),
//   LEFT, RIGHT, CYCLE (flechas circulares), CAPS, SPACE, letras A–Z, cifras 0–9,
//   COLON, LT, GT, SLASH, MINUS, EQUAL, QUOTE, LBR.
import { rtcNow, pad, addDays } from '../../engine/rtc.js'
import { newId } from '../../engine/defaults.js'

export const LIB_SIZE = 25
export const num = (i) => pad(i, 2)

// ------------------------------------------------------------------ caracteres
const DIRECT = { COLON: ':', LT: '<', GT: '>', SLASH: '/', MINUS: '-', EQUAL: '=', QUOTE: "'", LBR: '[', SPACE: ' ' }
const FCHAR = {
  COLON: ';', LT: ',', GT: '.', SLASH: '?', MINUS: '_', EQUAL: '+', QUOTE: '"', LBR: ']',
  7: '&', 8: '*', 9: '(', 4: '$', 5: '%', 6: '€', 1: '!', 2: '@', 3: '#', 0: ')',
}
const ALTCHAR = { Y: '¥', O: 'Ø', P: '°', A: 'Å', S: 'Ä', G: 'ü', H: 'Ü', J: 'Ö', K: 'ø', L: '£', Z: 'Æ', C: '¢', N: 'Ñ' }
const isLetter = (k) => /^[A-Z]$/.test(k)
const isDigit = (k) => /^[0-9]$/.test(k)

function charFor(fw, key) {
  if (key === 'F_KEY') key = 'F' // la letra F (la tecla de función F es otra)
  if (fw.pre === 'F') return FCHAR[key] ?? null
  if (fw.pre === 'ALT') return ALTCHAR[key] ?? null
  if (isLetter(key)) return fw.caps ? key : key.toLowerCase()
  if (isDigit(key)) return key
  return DIRECT[key] ?? null
}

// Tecla (y prefijo) que produce un carácter
export function keyForChar(ch) {
  const L = (c) => (c === 'F' ? 'F_KEY' : c)
  if (/^[A-Z]$/.test(ch)) return { key: L(ch), caps: true }
  if (/^[a-z]$/.test(ch)) return { key: L(ch.toUpperCase()), caps: false }
  if (/^[0-9]$/.test(ch)) return { key: ch }
  for (const [k, c] of Object.entries(DIRECT)) if (c === ch) return { key: k }
  for (const [k, c] of Object.entries(FCHAR)) if (c === ch) return { key: String(k), pre: 'F' }
  for (const [k, c] of Object.entries(ALTCHAR)) if (c === ch) return { key: k, pre: 'ALT' }
  return null
}

// ------------------------------------------------------------------ celdas de texto
// Una línea de mensaje = campos del motor. Para editar se convierte en celdas:
// cada carácter de texto es una celda y cada variable (fecha, contador…) una celda atómica.
const DATE_PH = { DD: 'dd', MM: 'mm', YY: 'yy', WW: 'ww', Y: 'y', D: 'x', JJJ: 'jjj' }
const POST_PH = { DD: 'pd', MM: 'pm', YY: 'py', JJJ: 'pju' }
const CLOCK_PH = { HH: 'hh', MM: 'nn', SS: 'ss' }

export function placeholder(f, m) {
  switch (f.type) {
    case 'date':
      return DATE_PH[f.format] || 'dd'
    case 'expiry':
      return POST_PH[f.format] || 'pd'
    case 'clock':
      return CLOCK_PH[f.format] || 'hh'
    case 'shift':
      return m?.shift?.type === '01' ? 'ee' : 'e'
    case 'counter':
      return 'ccccccccc'
    case 'barcode': {
      const d = f.symbology === 'CODE39' ? '↑' : '⇕'
      const inner = f.source === 'counter' ? 'ccccccccc' : f.value || ''
      return `${d}${inner}${d}`
    }
    default:
      return '?'
  }
}

export function lineToCells(line) {
  const cells = []
  for (const f of line || []) {
    if (f.type === 'text') for (const c of [...f.value]) cells.push({ c })
    else cells.push({ f })
  }
  return cells
}

export function cellsToLine(cells) {
  const out = []
  for (const cell of cells) {
    if (cell.f) out.push(cell.f)
    else {
      const last = out.at(-1)
      if (last && last.type === 'text') last.value += cell.c
      else out.push({ id: newId(), type: 'text', value: cell.c, font: '7x5', bold: 1 })
    }
  }
  return out
}

export const cellText = (cell, m) => (cell.f ? placeholder(cell.f, m) : cell.c)
export const lineText = (line, m) => lineToCells(line).map((c) => cellText(c, m)).join('')

// ------------------------------------------------------------------ estado
export function initFw() {
  return { scr: 'HOME', msg: '01', line: 0, pos: 0, caps: true, pre: null, mod: false, buf: '', cur: 0, var: null, bc: null, opt: {}, err: null, errT: 0 }
}

const fwOf = (s) => {
  if (!s.fw.S8_CLASSIC) s.fw.S8_CLASSIC = initFw()
  return s.fw.S8_CLASSIC
}

const msgOf = (s, n) => s.messages[n]
// mensaje en edición (copia de trabajo del motor) o el guardado
const curMsg = (s, fw) => (s.editing && s.editing.message.name === fw.msg ? s.editing.message : msgOf(s, fw.msg))

function openMsg(s, fw, act) {
  if (s.editing?.message.name === fw.msg) return
  if (msgOf(s, fw.msg)) act({ type: 'EDIT_OPEN', name: fw.msg })
  else act({ type: 'EDIT_NEW', name: fw.msg, extra: { params: { ...msgDefaultsParams() } } })
}

function msgDefaultsParams() {
  return { sense: 'DIRECTO', printSpeed: 500, trigger: 'OBJETO', repeat: 1, delayFwd: 50, delayRev: 50, interval: 100, dtopCancel: 20, dtopFilter: 100, width: 100, din: false, vSense: 'UP', hSense: 'RIGHT' }
}

// Guarda la copia de trabajo (el S8 memoriza al instante) y la recarga si es el mensaje en impresión
function commit(s, fw, act) {
  if (!s.editing || s.editing.message.name !== fw.msg) return
  act({ type: s.activeMessage === fw.msg ? 'EDIT_LOAD_PRINTER' : 'EDIT_SAVE', quiet: true })
}

function error(fw, text) {
  fw.err = text
  fw.errT = Date.now()
}

// ------------------------------------------------------------------ campos numéricos
// Plantilla con '#' por cada cifra editable. read() → cadena de cifras; write() aplica (o devuelve error).
const FONTS_S8 = [
  { lab: 'R 07 x 06: 053', font: '7x5' },
  { lab: 'R 05 x 05: 051', font: '5x5' },
  { lab: 'R 09 x 07: 055', font: '9x7' },
  { lab: 'R 11 x 09: 057', font: '11x9' },
  { lab: 'R 16 x 12: 061', font: '16x10' },
]
const LANGS = ['English', 'Français', 'Deutsch', 'Italiano', 'Español', 'Nederlands', 'Norsk', 'Swenska', 'Dansk', 'Portugues', 'Japanese']
const MODES = [
  ['MANUAL_OBJETO', 'Manual object'],
  ['MANUAL_AUTO', 'Manual auto'],
  ['OBJETO', 'Object'],
  ['REPETITIVO', 'Auto'],
]
const SHIFT_TYPES = ['01', 'A', 'A-O-I']

function shiftTypeLabel(sh) {
  return sh?.type === '01' ? '01' : sh?.type === 'A-O-I' ? 'A-O-I' : 'A'
}

// Definición de las funciones (pantallas)
export const FUNCS = {
  // ---------------- programación inicial
  I1: {
    nav: 'clock',
    tpl: (s) => `Time (HMS) : ##.##.## ${s.hw.clockStop ? 'STOP' : 'RUN'}`,
    read: (s) => {
      const d = rtcNow(s.rtcOffset)
      return pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds())
    },
    write: (s, b, act) => {
      const h = +b.slice(0, 2), m = +b.slice(2, 4), sec = +b.slice(4, 6)
      if (h > 23 || m > 59 || sec > 59) return 'Error: time'
      const d = rtcNow(s.rtcOffset)
      act({ type: 'RTC_SET', y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h, m, sec })
      s.hw.clockStop = false
      return null
    },
    cycle: (s) => {
      s.hw.clockStop = !s.hw.clockStop
    },
  },
  I2: {
    nav: 'clock',
    tpl: () => 'Date (DMY): ##.##.##',
    read: (s) => {
      const d = rtcNow(s.rtcOffset)
      return pad(d.getDate()) + pad(d.getMonth() + 1) + pad(d.getFullYear() % 100)
    },
    write: (s, b, act) => {
      const dd = +b.slice(0, 2), mo = +b.slice(2, 4), yy = 2000 + +b.slice(4, 6)
      const test = new Date(yy, mo - 1, dd)
      if (mo < 1 || mo > 12 || dd < 1 || test.getDate() !== dd) return 'Error: date'
      const d = rtcNow(s.rtcOffset)
      act({ type: 'RTC_SET', y: yy, mo, d: dd, h: d.getHours(), m: d.getMinutes(), sec: d.getSeconds() })
      return null
    },
  },
  I3: { text: () => `${LIB_SIZE} > 0150 <` },
  I4: { text: () => 'Code: xxx' },
  I5: { text: () => 'Security code: xxx' },
  V24: { nav: 'v24', text: (s) => `V24:${s.hw.v24.baud} Bds ${s.hw.v24.bits} bits ssPar` },
  V24W: { text: () => 'V24 watchdog:0500' },
  I6: {
    text: (s) => s.hw.languageS8 || 'English',
    arrows: (s, d) => {
      const i = LANGS.indexOf(s.hw.languageS8 || 'English')
      s.hw.languageS8 = LANGS[(i + d + LANGS.length) % LANGS.length]
    },
  },
  I7: { text: (s, fw) => (fw.opt.page2 ? 'Chk: 3E 3A 8F Hard: 00000000 00056H' : 'CPU: 11 D80 1101000 10000000'), cycleView: true },
  I8: { text: (s, fw) => (fw.opt.page2 ? 'Chk: 12 91 B4 Hard: 00000000' : 'IMP 1: G D00 04 00001000 00000 000'), cycleView: true },
  I9: {
    text: (s) => `Head start-up: ${s.hw.startMode === 'AUTO' ? 'Auto' : 'Man.'}`,
    cycle: (s) => {
      s.hw.startMode = s.hw.startMode === 'AUTO' ? 'MANUAL' : 'AUTO'
    },
  },
  I10: {
    nav: 'counter',
    text: (s) => {
      const m = s.messages[s.activeMessage]
      const v = m ? m.counter.value : 0
      const lz = m ? m.counter.leadingZeros !== false : true
      return lz ? `Jet 1 C: ${pad(v, 9)}` : `Jet 1 C : ${String(v).padStart(9, '.').replace(/\./g, '.')}`
    },
    cycle: (s, fw, act) => act({ type: 'COUNTER_RESET' }),
  },
  // ---------------- parámetros de mensaje (desde la cabecera)
  M9: {
    nav: 'delay',
    tpl: () => 'Printing delay: A#### R#### I####',
    read: (s, fw) => {
      const p = curMsg(s, fw).params
      return pad(p.delayFwd, 4) + pad(p.delayRev, 4) + pad(p.interval ?? 100, 4)
    },
    write: (s, b, act, fw) => {
      const a = +b.slice(0, 4), r = +b.slice(4, 8), i = +b.slice(8, 12)
      if (a < 1 || r < 1 || i < 1) return 'Error: value'
      const p = s.editing.message.params
      Object.assign(p, { delayFwd: a, delayRev: r, interval: i })
      commit(s, fw, act)
      return null
    },
  },
  M10: {
    nav: 'encoder',
    tpl: (s) => (s.hw.encoder.source === 'ENCODER' ? 'Tachy: ####' : 'Printing speed (mm/s): ####'),
    read: (s, fw) => (s.hw.encoder.source === 'ENCODER' ? pad(s.hw.encoder.division, 4) : pad(curMsg(s, fw).params.printSpeed, 4)),
    write: (s, b, act, fw) => {
      const v = +b
      if (v < 1) return 'Error: value'
      if (s.hw.encoder.source === 'ENCODER') act({ type: 'SET_HW', path: 'encoder.division', value: v })
      else {
        s.editing.message.params.printSpeed = v
        commit(s, fw, act)
      }
      return null
    },
    cycle: (s, fw, act) => {
      act({ type: 'SET_HW', path: 'encoder.source', value: s.hw.encoder.source === 'ENCODER' ? 'CONSTANTE' : 'ENCODER' })
      fw.buf = FUNCS.M10.read(s, fw)
      fw.cur = 0
    },
  },
  M11: {
    text: (s, fw) => `Message sense: ${curMsg(s, fw).params.sense === 'INVERSO' ? '←' : '→'}`,
    cycle: (s, fw, act) => {
      const p = s.editing.message.params
      p.sense = p.sense === 'INVERSO' ? 'DIRECTO' : 'INVERSO'
      commit(s, fw, act)
    },
  },
  M12V: {
    text: (s, fw) => `Vertical sense: ${curMsg(s, fw).params.vSense === 'DOWN' ? '↓' : '↑'}`,
    cycle: (s, fw, act) => {
      const p = s.editing.message.params
      p.vSense = p.vSense === 'DOWN' ? 'UP' : 'DOWN'
      commit(s, fw, act)
    },
  },
  M12H: {
    text: (s, fw) => `Horizontal sense: ${curMsg(s, fw).params.hSense === 'LEFT' ? '←' : '→'}`,
    cycle: (s, fw, act) => {
      const p = s.editing.message.params
      p.hSense = p.hSense === 'LEFT' ? 'RIGHT' : 'LEFT'
      commit(s, fw, act)
    },
  },
  M13: {
    nav: 'mode',
    text: (s, fw) => `Mode: ${(MODES.find((m) => m[0] === curMsg(s, fw).params.trigger) || MODES[2])[1]}`,
    cycle: (s, fw, act) => {
      const p = s.editing.message.params
      const i = MODES.findIndex((m) => m[0] === p.trigger)
      p.trigger = MODES[(i + 1) % MODES.length][0]
      commit(s, fw, act)
    },
  },
  M24: {
    nav: 'counterParams',
    tpl: () => 'Counter batch: ######',
    read: (s, fw) => pad(curMsg(s, fw).counter.batch, 6),
    write: (s, b, act, fw) => {
      if (+b < 1) return 'Error: value'
      s.editing.message.counter.batch = +b
      commit(s, fw, act)
      return null
    },
  },
  M25: {
    nav: 'counterParams',
    tpl: () => 'Step counter: ##',
    read: (s, fw) => pad(curMsg(s, fw).counter.step, 2),
    write: (s, b, act, fw) => {
      if (+b < 1) return 'Error: value'
      s.editing.message.counter.step = +b
      commit(s, fw, act)
      return null
    },
  },
  M26: {
    nav: 'counterParams',
    tpl: () => 'Start value: #########',
    read: (s, fw) => pad(curMsg(s, fw).counter.start, 9),
    write: (s, b, act, fw) => {
      if (+b < 1) return 'Error: value'
      const c = s.editing.message.counter
      c.start = +b
      c.value = +b
      commit(s, fw, act)
      return null
    },
  },
  M27: {
    nav: 'counterParams',
    tpl: () => 'Final value: #########',
    read: (s, fw) => pad(curMsg(s, fw).counter.end, 9),
    write: (s, b, act, fw) => {
      if (+b < 1) return 'Error: value'
      s.editing.message.counter.end = +b
      commit(s, fw, act)
      return null
    },
  },
  M29: {
    nav: 'postdate',
    tpl: (s, fw) => {
      const m = curMsg(s, fw)
      const d = addDays(rtcNow(s.rtcOffset), m.expiry?.unit === 'DIAS' ? m.expiry.amount : 0)
      return `Duration: ####P (DMY): ${pad(d.getDate())} ${pad(d.getMonth() + 1)} ${pad(d.getFullYear() % 100)}`
    },
    read: (s, fw) => {
      const e = curMsg(s, fw).expiry
      return pad(e?.unit === 'DIAS' ? e.amount : 0, 4)
    },
    write: (s, b, act, fw) => {
      s.editing.message.expiry = { amount: +b, unit: 'DIAS' }
      commit(s, fw, act)
      return null
    },
  },
  M30: {
    nav: 'shift',
    tpl: (s, fw) => `S: ##: ## I: ##: ## ${shiftTypeLabel(curMsg(s, fw).shift)}`,
    read: (s, fw) => {
      const sh = curMsg(s, fw).shift
      return sh.start.replace(':', '') + sh.interval.replace(':', '')
    },
    write: (s, b, act, fw) => {
      const sh = +b.slice(0, 2), sm = +b.slice(2, 4), ih = +b.slice(4, 6), im = +b.slice(6, 8)
      if (sh > 23 || sm > 59 || ih > 23 || im > 59 || ih * 60 + im < 1) return 'Error: value'
      const m = s.editing.message
      m.shift = { ...m.shift, start: `${pad(sh)}:${pad(sm)}`, interval: `${pad(ih)}:${pad(im)}`, codes: [] }
      commit(s, fw, act)
      return null
    },
    cycle: (s, fw, act) => {
      const m = s.editing.message
      const i = SHIFT_TYPES.indexOf(shiftTypeLabel(m.shift))
      const t = SHIFT_TYPES[(i + 1) % SHIFT_TYPES.length]
      m.shift = { ...m.shift, type: t === '01' ? '01' : t === 'A-O-I' ? 'A-O-I' : 'LETRAS', codes: [] }
      commit(s, fw, act)
    },
  },
  // ---------------- dentro del texto (tecla Aa)
  M14: {
    tpl: () => 'Bolderization: #',
    read: (s) => String(s.editing.message.lines.flat()[0]?.bold || 1),
    write: (s, b, act, fw) => {
      if (+b < 1) return 'Error: value'
      s.editing.message.lines.flat().forEach((f) => (f.bold = +b))
      return null
    },
    back: 'TXT',
  },
  M15: {
    text: (s) => {
      const f = s.editing.message.lines.flat()[0]?.font || '7x5'
      return `Font: ${(FONTS_S8.find((x) => x.font === f) || FONTS_S8[0]).lab}`
    },
    cycle: (s) => {
      const fields = s.editing.message.lines.flat()
      const f = fields[0]?.font || '7x5'
      const i = FONTS_S8.findIndex((x) => x.font === f)
      const next = FONTS_S8[(i + 1) % FONTS_S8.length].font
      fields.forEach((x) => (x.font = next))
    },
    back: 'TXT',
  },
  M19: {
    text: (s, fw) => `Bar code type: ${barcodeField(s, fw)?.symbology === 'CODE39' ? 'Code 39' : '2/5 int'}`,
    cycle: (s, fw) => {
      const f = barcodeField(s, fw)
      if (f) f.symbology = f.symbology === 'CODE39' ? 'ITF' : 'CODE39'
    },
    back: 'BC',
  },
  M20: {
    text: (s, fw) => `Control word: ${barcodeField(s, fw)?.check === false ? 'no' : 'yes'}`,
    cycle: (s, fw) => {
      const f = barcodeField(s, fw)
      if (f) f.check = f.check === false
    },
    back: 'BC',
  },
  M21: { text: () => 'Ratio: nb: 1 wb: 3 ns: 1 ws: 3', back: 'BC' },
  // ---------------- mantenimiento (F + ☹?)
  E1: { text: () => 'Status jet' },
  E2: {
    nav: 'jetStatus',
    text: (s) => `Jet: ${s.jetState === 'RUNNING' || s.jetState === 'STARTING' ? 'On' : 'Stop'}`,
    cycle: (s, fw, act) => {
      if (s.jetState === 'RUNNING' || s.jetState === 'STARTING') act({ type: 'JET_STOP' })
      else if (s.power === 'ON') act({ type: 'JET_START' })
    },
    back: 'E1',
  },
  E3: { text: (s, fw) => `Nozzle unblocking: ${fw.opt.E3 ? 'Y' : 'N'}`, toggle: 'E3', fn: 'DESOBTURACION', back: 'E1' },
  E4: { text: (s, fw) => `Intro. solution ${fw.opt.E4 ? 'Y' : 'N'}`, toggle: 'E4', fn: 'INTRO_DISOLVENTE', back: 'E1' },
  E5: { text: (s, fw) => `Stability ${fw.opt.E5 ? 'Y' : 'N'}`, toggle: 'E5', fn: 'ESTABILIDAD', back: 'E1' },
  E6: { text: (s, fw) => `Ink refresh ${fw.opt.E6 ? 'Y' : 'N'}`, toggle: 'E6', fn: 'REFRESCO', back: 'E1' },
  E7: {
    nav: 'faultInhibit',
    text: (s, fw) => {
      const fi = s.hw.faultInhibit
      return `Fault: Cover ${fi.cover ? 'No ' : 'Yes'} Vacuum: ${fi.recup ? 'No' : 'Yes'}`
    },
    fields: 2,
    cycleField: (s, fw, act) => {
      const key = fw.cur === 0 ? 'cover' : 'recup'
      act({ type: 'SET_HW', path: `faultInhibit.${key}`, value: !s.hw.faultInhibit[key] })
    },
  },
  E8: {
    text: (s) => `Jet 1: Dc ${s.live.velocity.toFixed(1).padStart(4, '0')} m/s`,
  },
  E9: {
    nav: 'jet',
    text: (s) => `Jet 1: ${s.jetState === 'RUNNING' ? s.live.phase : '00000000'}`,
    back: 'E8',
  },
  E10: { nav: 'visco', text: () => 'Visco: PS:OC Lhl:++ Ft:31s → 29s 07add' },
  E11: {
    nav: 'visco',
    text: (s) => {
      const L = s.live
      const vm = s.hw.motorSpeed || 1500
      return `Vm:${vm} P:${L.pressure.toFixed(2)}b µ:4.9 Vj:${L.velocity.toFixed(1)}m/s T:${Math.round(L.temp)}°C`
    },
  },
  E12: { text: (s, fw) => `Drain: ${fw.opt.E12 ? 'Yes' : 'No'}`, toggle: 'E12' },
  E13: { text: (s, fw) => (Math.floor(Date.now() / 2000) % 2 ? 'Time Vmot Pres Tr Ad Vjet T1 T2 Def' : `12 : 31 1500 ${s.live.pressure.toFixed(2)} 29 01 ${s.live.velocity.toFixed(1)} 35 21 00`) },
}

// Grupos de funciones hermanas que se recorren con ◄ ►
export const GROUPS = {
  DATE: ['I1', 'I2'],
  CODE: ['I4', 'I5'],
  SYS: ['V24', 'V24W', 'I6', 'I7', 'I8', 'I9'],
  MPARAM: ['M9', 'M10', 'M11', 'M12V', 'M12H', 'M13'],
  MCNT: ['M24', 'M25', 'M26', 'M27'],
  MDATE: ['M29', 'M30'],
  SERV: ['E1', 'E7', 'E8', 'E10', 'E11', 'E12', 'E13'],
  JET: ['E2', 'E3', 'E4', 'E5', 'E6'],
  BCP: ['M19', 'M20', 'M21'],
}
const groupOf = (scr) => Object.entries(GROUPS).find(([, l]) => l.includes(scr))?.[0]
// Pantalla de la que se viene al salir con ▲ (UP)
const PARENT = { MPARAM: 'HDR', MCNT: 'HDR', MDATE: 'HDR', JET: 'E1', BCP: 'BC' }

function barcodeField(s, fw) {
  if (!fw.bc || !s.editing) return null
  return s.editing.message.lines[fw.bc.line]?.find((f) => f.id === fw.bc.id) || null
}

// ------------------------------------------------------------------ fallos
export const FAULT_TEXT = {
  EHT: 'EHT',
  RECUP: 'Gutter fault',
  PRESSURE: 'Fault: pressure',
  COVER: 'Cover missing',
  PHASE: 'Jet 1: Phase detection',
  INK_LOW: 'Ink tank level low.',
  SEDIMENT: 'Ink pigment circuit',
  AIR: 'Fault: head pressure',
}

// ------------------------------------------------------------------ navegación
function go(s, fw, scr, act) {
  fw.scr = scr
  fw.mod = false
  fw.buf = ''
  fw.cur = 0
  fw.pre = null
  fw.opt.page2 = false
  const def = FUNCS[scr]
  if (def?.nav) act({ type: 'NAV', view: def.nav })
  if (scr === 'HDR') act({ type: 'NAV', view: 'select' })
  if (scr === 'TXT') act({ type: 'NAV', view: 'text' })
  if (scr === 'FAULTS') act({ type: 'NAV', view: 'faults' })
  if (scr === 'E1') act({ type: 'NAV', view: 'service' })
}

function goHome(s, fw, act) {
  if (s.editing) {
    commit(s, fw, act)
    act({ type: 'EDIT_CLOSE' })
  }
  go(s, fw, 'HOME', act)
}

function startMod(s, fw) {
  const def = FUNCS[fw.scr]
  if (def.read) {
    fw.mod = true
    fw.buf = def.read(s, fw)
    fw.cur = 0
  } else if (def.fields) {
    fw.mod = true
    fw.cur = 0
  }
}

function slotsOf(s, fw) {
  const tpl = FUNCS[fw.scr].tpl(s, fw)
  return [...tpl].filter((c) => c === '#').length
}

function finishMod(s, fw, act) {
  const def = FUNCS[fw.scr]
  if (def.write) {
    const e = def.write(s, fw.buf, act, fw)
    if (e) {
      error(fw, e)
      return
    }
  }
  fw.mod = false
  fw.cur = 0
}

// ------------------------------------------------------------------ texto del mensaje
function txtCells(s, fw) {
  return lineToCells(s.editing.message.lines[fw.line])
}

function setCells(s, fw, cells) {
  s.editing.message.lines[fw.line] = cellsToLine(cells)
  s.editing.dirty = true
}

function insertField(s, fw, field, act) {
  const cells = txtCells(s, fw)
  const f = { id: newId(), font: s.editing.message.lines.flat()[0]?.font || '7x5', bold: 1, ...field }
  cells.splice(fw.pos, 0, { f })
  setCells(s, fw, cells)
  fw.pos += 1
  act({ type: 'NAV', view: 'insert' })
  return f
}

const VAR_DATE = { H: ['clock', 'HH'], N: ['clock', 'MM'], S: ['clock', 'SS'], D: ['date', 'DD'], M: ['date', 'MM'], Y: ['date', 'YY'], W: ['date', 'WW'], X: ['date', 'D'], Z: ['date', 'Y'], J: ['date', 'JJJ'] }
const VAR_POST = { D: 'DD', M: 'MM', Y: 'YY', J: 'JJJ' }

function pressTxt(s, fw, key, act) {
  const m = s.editing.message
  // selección de variable pendiente
  if (fw.var === 'DATE' || fw.var === 'POST') {
    const was = fw.var
    fw.var = null
    if (was === 'DATE' && key === 'P') {
      fw.var = 'POST'
      return
    }
    if (was === 'POST' && VAR_POST[key]) {
      insertField(s, fw, { type: 'expiry', slot: 1, format: VAR_POST[key] }, act)
      return
    }
    if (was === 'DATE' && key === 'E') {
      insertField(s, fw, { type: 'shift' }, act)
      return
    }
    if (was === 'DATE' && VAR_DATE[key]) {
      const [type, format] = VAR_DATE[key]
      insertField(s, fw, { type, format }, act)
      return
    }
    return
  }
  if (fw.var === 'AA') {
    fw.var = null
    if (key === 'B') return go(s, fw, 'M14', act)
    if (key === 'M') return go(s, fw, 'M15', act)
    if (key === 'C') {
      const f = insertField(s, fw, { type: 'barcode', symbology: 'ITF', source: 'text', value: '', check: true, height: 14 }, act)
      fw.bc = { line: fw.line, id: f.id }
      fw.scr = 'BC'
      act({ type: 'NAV', view: 'barcode' })
      return
    }
    if (key === 'RIGHT') {
      error(fw, 'Tabulation: 000')
      return
    }
    return
  }
  const cells = txtCells(s, fw)
  switch (key) {
    case 'LEFT':
      fw.pos = Math.max(0, fw.pos - 1)
      return
    case 'RIGHT':
      fw.pos = Math.min(cells.length, fw.pos + 1)
      return
    case 'UP': // borrar el carácter de encima del cursor
      if (fw.pos < cells.length) {
        cells.splice(fw.pos, 1)
        setCells(s, fw, cells)
      } else if (fw.pos > 0 && fw.pos === cells.length) {
        cells.splice(fw.pos - 1, 1)
        fw.pos -= 1
        setCells(s, fw, cells)
      } else if (cells.length === 0 && m.lines.length > 1) {
        m.lines.splice(fw.line, 1)
        fw.line = 0
        fw.pos = 0
      }
      return
    case 'DOWN': // abrir una posición (insertar)
      cells.splice(fw.pos, 0, { c: ' ' })
      setCells(s, fw, cells)
      return
    case 'CYCLE': // modo doble línea / cambiar de línea
      if (m.lines.length < 2) m.lines.push([])
      fw.line = fw.line === 0 ? 1 : 0
      fw.pos = 0
      return
    case 'CAPS':
      fw.caps = !fw.caps
      return
    case 'ALT':
    case 'F':
      fw.pre = fw.pre === key ? null : key
      return
    case 'DATE':
      fw.var = 'DATE'
      return
    case 'AA':
      fw.var = 'AA'
      return
    case 'CNT':
      insertField(s, fw, { type: 'counter' }, act)
      return
    case 'EDIT': // salir del texto → cabecera (mensaje memorizado)
      commit(s, fw, act)
      go(s, fw, 'HDR', act)
      return
    default: {
      const ch = charFor(fw, key)
      fw.pre = null
      if (ch == null) return
      if (fw.pos < cells.length && !cells[fw.pos].f) cells[fw.pos] = { c: ch }
      else cells.splice(fw.pos, 0, { c: ch })
      fw.pos += 1
      setCells(s, fw, cells)
    }
  }
}

// Edición de los datos de un código de barras (entre delimitadores)
function pressBc(s, fw, key, act) {
  const f = barcodeField(s, fw)
  if (!f) {
    fw.scr = 'TXT'
    return
  }
  if (key === 'UP') {
    if (f.value) f.value = f.value.slice(0, -1)
    else {
      fw.bc = null
      fw.scr = 'TXT'
    }
    return
  }
  if (key === 'EDIT' || key === 'CYCLE') {
    fw.bc = null
    fw.scr = 'TXT'
    return
  }
  if (key === 'CNT') {
    f.source = 'counter'
    return
  }
  if (key === 'PARAM') return go(s, fw, 'M19', act)
  if (key === 'F' || key === 'ALT') {
    fw.pre = fw.pre === key ? null : key
    return
  }
  const ch = charFor({ ...fw, caps: true }, key)
  fw.pre = null
  if (ch == null) return
  const ok = f.symbology === 'CODE39' ? /^[A-Z0-9 \-.$/+%]$/.test(ch) : /^[0-9]$/.test(ch)
  if (!ok) {
    error(fw, f.symbology === 'CODE39' ? 'Code 39: A-Z 0-9 - . $ / + %' : '2/5 int: 0-9 only')
    return
  }
  if (f.value.length < 31) {
    f.source = 'text'
    f.value += ch
  }
}

// ------------------------------------------------------------------ tecla
export function press(s, key, act) {
  const fw = fwOf(s)
  fw.err = null

  // ON/OFF: marcha / paro de la impresora
  if (key === 'ONOFF') {
    if (s.power === 'OFF') {
      act({ type: 'POWER_ON' })
      goHome(s, fw, act)
    } else if (s.power === 'ON') {
      if (s.editing) act({ type: 'EDIT_CLOSE' })
      go(s, fw, 'STOPQ', act)
    }
    return
  }
  if (s.power === 'OFF' || s.power === 'BOOT') return
  if (s.power === 'STOPPING') return

  if (fw.scr === 'STOPQ') {
    if (key === 'Y') {
      act({ type: 'POWER_OFF' })
      fw.scr = 'WAIT'
    } else if (key === 'N' || key === 'UP') go(s, fw, 'HOME', act)
    return
  }

  // Prefijo F (funciones de sistema) en la pantalla de reposo
  if (fw.scr === 'HOME') {
    if (fw.pre === 'F') {
      fw.pre = null
      if (key === 'FAULT') return go(s, fw, 'E1', act)
      if (key === 'EDIT') return go(s, fw, 'I3', act)
      if (key === 'AA') return go(s, fw, 'I4', act)
      if (key === 'PARAM') return go(s, fw, 'V24', act)
      return
    }
    switch (key) {
      case 'F':
      case 'ALT':
        fw.pre = key
        return
      case 'DATE':
        return go(s, fw, 'I1', act)
      case 'CNT':
        return go(s, fw, 'I10', act)
      case 'FAULT':
        Object.keys(s.faults).forEach((c) => act({ type: 'FAULT_VIEW', code: c }))
        fw.cur = 0
        return go(s, fw, 'FAULTS', act)
      case 'EDIT':
        fw.msg = s.activeMessage && /^\d\d$/.test(s.activeMessage) ? s.activeMessage : '01'
        go(s, fw, 'HDR', act)
        openMsg(s, fw, act)
        return
      case 'SPACE':
        act({ type: 'MANUAL_PRINT' })
        return
      default:
        return
    }
  }

  if (fw.scr === 'FAULTS') {
    const codes = Object.keys(s.faults)
    if (key === 'FAULT') {
      act({ type: 'FAULT_ACK' })
      if (Object.keys(s.faults).length === 0) go(s, fw, 'HOME', act)
      fw.cur = 0
      return
    }
    if (key === 'LEFT' || key === 'RIGHT') {
      if (codes.length) {
        fw.cur = (fw.cur + (key === 'RIGHT' ? 1 : -1) + codes.length) % codes.length
        act({ type: 'FAULT_VIEW', code: codes[fw.cur] })
      }
      return
    }
    if (key === 'UP') return go(s, fw, 'HOME', act)
    return
  }

  if (fw.scr === 'HDR') {
    switch (key) {
      case 'LEFT':
      case 'RIGHT': {
        if (s.editing) {
          commit(s, fw, act)
          act({ type: 'EDIT_CLOSE' })
        }
        const n = +fw.msg + (key === 'RIGHT' ? 1 : -1)
        fw.msg = num(((n - 1 + LIB_SIZE) % LIB_SIZE) + 1)
        openMsg(s, fw, act)
        return
      }
      case 'DOWN': // seleccionar para imprimir
        if (!msgOf(s, fw.msg)) act({ type: 'EDIT_SAVE', quiet: true })
        act({ type: 'SELECT_MESSAGE', name: fw.msg, quiet: true })
        act({ type: 'EDIT_LOAD_PRINTER', quiet: true })
        return
      case 'CYCLE':
        fw.line = 0
        fw.pos = 0
        return go(s, fw, 'TXT', act)
      case 'PARAM':
        return go(s, fw, 'M9', act)
      case 'CNT':
        return go(s, fw, 'M24', act)
      case 'DATE':
        return go(s, fw, 'M29', act)
      case 'EDIT':
      case 'UP':
        return goHome(s, fw, act)
      default:
        return
    }
  }

  if (fw.scr === 'TXT') return pressTxt(s, fw, key, act)
  if (fw.scr === 'BC') return pressBc(s, fw, key, act)

  // ---------------- funciones con valores
  const def = FUNCS[fw.scr]
  if (!def) return go(s, fw, 'HOME', act)
  const grp = groupOf(fw.scr)

  if (fw.mod) {
    if (def.read) {
      const n = slotsOf(s, fw)
      if (isDigit(key)) {
        const b = fw.buf.split('')
        b[fw.cur] = key
        fw.buf = b.join('')
        fw.cur = Math.min(n - 1, fw.cur + 1)
        return
      }
      if (key === 'RIGHT') fw.cur = Math.min(n - 1, fw.cur + 1)
      else if (key === 'LEFT') fw.cur = Math.max(0, fw.cur - 1)
      else if (key === 'CYCLE' && def.cycle) def.cycle(s, fw, act)
      else if (key === 'UP' || key === 'DOWN') finishMod(s, fw, act)
      return
    }
    if (def.fields) {
      if (key === 'RIGHT' || key === 'LEFT') fw.cur = (fw.cur + 1) % def.fields
      else if (key === 'CYCLE') def.cycleField(s, fw, act)
      else if (key === 'UP') fw.mod = false
      return
    }
  }

  // E8 → [DOWN] [CYCLE] → E9 control de gotas
  if (fw.scr === 'E8') {
    if (key === 'DOWN') {
      fw.opt.e8armed = true
      return
    }
    if (key === 'CYCLE' && fw.opt.e8armed) {
      fw.opt.e8armed = false
      return go(s, fw, 'E9', act)
    }
  }
  if (fw.scr === 'E9' && key === 'UP') {
    act({ type: 'JET_VALIDATE' })
    return go(s, fw, 'E8', act)
  }
  if (fw.scr === 'E1' && key === 'DOWN') return go(s, fw, 'E2', act)

  switch (key) {
    case 'LEFT':
    case 'RIGHT': {
      if (def.arrows && fw.opt.armed) {
        def.arrows(s, key === 'RIGHT' ? 1 : -1)
        return
      }
      if (!grp) return
      const list = GROUPS[grp]
      const i = list.indexOf(fw.scr)
      return go(s, fw, list[(i + (key === 'RIGHT' ? 1 : -1) + list.length) % list.length], act)
    }
    case 'DOWN':
      if (def.read || def.fields) startMod(s, fw)
      else if (def.arrows) fw.opt.armed = true
      else if (def.cycle && fw.scr === 'I10') fw.opt.armed = true
      return
    case 'CYCLE':
      if (def.cycleView) fw.opt.page2 = !fw.opt.page2
      else if (def.toggle) {
        fw.opt[def.toggle] = !fw.opt[def.toggle]
        if (fw.opt[def.toggle] && def.fn) act({ type: 'JET_MAINT', fn: def.fn })
      } else if (def.cycle && (!def.read || fw.scr === 'I10')) {
        if (fw.scr === 'I10' && !fw.opt.armed) return
        def.cycle(s, fw, act)
        fw.opt.armed = false
      }
      return
    case 'AA':
      if (fw.scr === 'I10') {
        const m = s.messages[s.activeMessage]
        if (m) act({ type: 'SET_ACTIVE_MSG', path: 'counter.leadingZeros', value: m.counter.leadingZeros === false })
      }
      return
    case 'UP': {
      fw.opt.armed = false
      if (def.back) return def.back === 'TXT' || def.back === 'BC' ? (fw.scr = def.back === 'BC' && fw.bc ? 'BC' : 'TXT') : go(s, fw, def.back, act)
      const parent = PARENT[grp]
      if (parent === 'HDR') return go(s, fw, 'HDR', act)
      return goHome(s, fw, act)
    }
    case 'EDIT':
      if (PARENT[grp] === 'HDR') return go(s, fw, 'HDR', act)
      return
    default:
      return
  }
}

// ------------------------------------------------------------------ pantalla
// Devuelve { text (≤40), cursor (índice o -1), blink: [i0,i1] | null }
function fit(t) {
  return t.length > 40 ? t.slice(0, 40) : t
}

function tplRender(tpl, buf) {
  let k = 0
  const slots = []
  let out = ''
  for (const c of tpl) {
    if (c === '#') {
      slots.push(out.length)
      out += buf[k++] ?? '0'
    } else out += c
  }
  return { out, slots }
}

export function view(s) {
  const fw = fwOf(s)
  if (s.power === 'OFF') return { text: 'ON/OFF?', cursor: -1 }
  if (s.power === 'BOOT') return { text: '', cursor: -1 }
  if (s.power === 'STOPPING' || fw.scr === 'WAIT') return { text: s.power === 'STOPPING' ? 'Wait 2 mn' : 'ON/OFF?', cursor: -1 }
  if (fw.err && Date.now() - fw.errT < 1800) return { text: fit(fw.err), cursor: -1 }
  switch (fw.scr) {
    case 'HOME':
      return { text: 'Function?...', cursor: -1 }
    case 'STOPQ':
      return { text: 'Stop? Y-N', cursor: -1 }
    case 'FAULTS': {
      const codes = Object.keys(s.faults)
      if (!codes.length) return { text: 'No fault', cursor: -1 }
      const c = codes[Math.min(fw.cur, codes.length - 1)]
      return { text: fit(FAULT_TEXT[c] || c), cursor: -1 }
    }
    case 'HDR': {
      const m = curMsg(s, fw)
      const sel = s.activeMessage === fw.msg ? '*' : ' '
      const content = m ? lineText(m.lines[0], m) : ''
      const d = fw.caps ? '◆' : '⊞'
      return { text: fit(`${fw.msg}Head 1.1${sel} ${d} ${content} ${d}`), cursor: -1 }
    }
    case 'TXT':
    case 'BC': {
      const m = s.editing.message
      const two = m.lines.length > 1
      const d = fw.caps ? '◆' : '⊞'
      const cells = lineToCells(m.lines[fw.line])
      const prefix = (two ? `${fw.line + 1} ` : '') + `${d} `
      let txt = ''
      let cursorAt = -1
      cells.forEach((c, i) => {
        if (i === fw.pos) cursorAt = txt.length
        txt += cellText(c, m)
      })
      if (fw.pos >= cells.length) cursorAt = txt.length
      if (fw.scr === 'BC') {
        const f = barcodeField(s, fw)
        if (f) {
          const ph = placeholder(f, m)
          const at = txt.indexOf(ph)
          if (at >= 0) cursorAt = at + ph.length - 1
        }
      }
      if (fw.var === 'DATE') return { text: 'Variable: (H N S D M Y W X Z P J E)', cursor: -1 }
      if (fw.var === 'POST') return { text: 'Variable: P (D M Y J)', cursor: -1 }
      if (fw.var === 'AA') return { text: 'Variable: □ (B,M,C,L,→,dIN)', cursor: 10, blink: [10, 11] }
      // desplazamiento horizontal si el texto no cabe
      const full = `${prefix}${txt} ${d}`
      let cur = cursorAt + prefix.length
      let start = 0
      if (cur > 38) start = cur - 38
      return { text: full.slice(start, start + 40), cursor: cur - start }
    }
    default: {
      const def = FUNCS[fw.scr]
      if (!def) return { text: 'Function?...', cursor: -1 }
      if (def.tpl) {
        const buf = fw.mod ? fw.buf : def.read(s, fw)
        const { out, slots } = tplRender(def.tpl(s, fw), buf)
        if (fw.mod) return { text: fit(out), cursor: slots[fw.cur], blink: [slots[fw.cur], slots[fw.cur] + 1] }
        return { text: fit(out), cursor: -1 }
      }
      const t = fit(def.text(s, fw))
      if (def.fields && fw.mod) {
        const at = fw.cur === 0 ? t.indexOf('Cover') + 6 : t.indexOf('Vacuum') + 8
        return { text: t, cursor: at, blink: [at, at + 3] }
      }
      if ((def.arrows || fw.scr === 'I10') && fw.opt.armed) return { text: t, cursor: -1, blink: [0, t.length] }
      return { text: t, cursor: -1 }
    }
  }
}

// LEDs del panel
export function leds(s) {
  const fw = fwOf(s)
  const blocking = Object.keys(s.faults).filter((c) => ['EHT', 'RECUP', 'PRESSURE', 'COVER'].includes(c)).length > 0
  const alarms = Object.keys(s.faults).length > 0
  const jetOn = s.jetState === 'RUNNING'
  const readyBlink = s.jetState === 'STARTING' || (jetOn && (fw.scr === 'E9' || (alarms && !blocking)))
  return {
    power: true,
    ready: s.power === 'ON' && (jetOn || s.jetState === 'STARTING') && !blocking,
    readyBlink,
    fault: blocking,
    alarm: alarms && !blocking,
  }
}

// ------------------------------------------------------------------ ayudas del tutor
// Texto que el operador está escribiendo ahora (para el tutor)
export function input(s) {
  const fw = fwOf(s)
  if ((fw.scr === 'TXT' || fw.scr === 'BC') && s.editing) {
    if (fw.scr === 'BC') return barcodeField(s, fw)?.value ?? ''
    return lineText(s.editing.message.lines[fw.line], s.editing.message)
  }
  if (fw.mod && FUNCS[fw.scr]?.read) return fw.buf
  return null
}

// Siguiente tecla para escribir `target`
export function typingKey(s, target) {
  const fw = fwOf(s)
  if (fw.mod && FUNCS[fw.scr]?.read) {
    if (fw.buf === target) return 'UP'
    const i = fw.cur
    if (i < target.length && fw.buf[i] !== target[i]) return target[i]
    // buscar la primera diferencia
    const j = [...target].findIndex((c, k) => fw.buf[k] !== c)
    if (j < 0) return 'UP'
    return j > i ? 'RIGHT' : 'LEFT'
  }
  if (fw.scr === 'TXT' || fw.scr === 'BC') {
    const cur = input(s) ?? ''
    if (cur === target) return null
    // en el texto: el cursor está en celdas; asumimos texto sin variables al teclear
    let i = 0
    while (i < cur.length && i < target.length && cur[i] === target[i]) i++
    // índice de carácter → índice de celda (una variable ocupa varios caracteres pero es 1 celda)
    let pos = fw.pos
    if (fw.scr === 'BC') pos = i
    else {
      const cells = lineToCells(s.editing.message.lines[fw.line])
      let off = 0
      let ci = cells.length
      for (let k = 0; k < cells.length; k++) {
        if (off >= i) {
          ci = k
          break
        }
        off += cellText(cells[k], s.editing.message).length
      }
      // comparar posiciones en celdas
      if (fw.pos !== ci) return fw.pos < ci ? 'RIGHT' : 'LEFT'
      pos = i
    }
    if (i < cur.length) {
      // sobra texto: ir a la posición i y borrar
      if (pos < i) return 'RIGHT'
      if (pos > i) return 'LEFT'
      return 'UP'
    }
    if (pos < i) return 'RIGHT'
    if (pos > i) return 'LEFT'
    const k = keyForChar(target[i])
    if (!k) return null
    if (k.caps === true && !fw.caps) return 'CAPS'
    if (k.caps === false && fw.caps) return 'CAPS'
    if (k.pre && fw.pre !== k.pre) return k.pre
    return k.key
  }
  return null
}

// Rutas desde «Function?...» hasta cada pantalla: [firma de estado, tecla]
const ROUTES = {
  clock: [['HOME', 'DATE']],
  date: [['HOME', 'DATE'], ['I1', 'RIGHT']],
  select: [['HOME', 'EDIT']],
  text: [['HOME', 'EDIT'], ['HDR', 'CYCLE']],
  delay: [['HOME', 'EDIT'], ['HDR', 'PARAM']],
  encoder: [['HOME', 'EDIT'], ['HDR', 'PARAM'], ['M9', 'RIGHT']],
  mode: [['HOME', 'EDIT'], ['HDR', 'PARAM'], ['M9', 'LEFT']],
  counterParams: [['HOME', 'EDIT'], ['HDR', 'CNT']],
  start: [['HOME', 'EDIT'], ['HDR', 'CNT'], ['M24', 'RIGHT'], ['M25', 'RIGHT']],
  postdate: [['HOME', 'EDIT'], ['HDR', 'DATE']],
  shift: [['HOME', 'EDIT'], ['HDR', 'DATE'], ['M29', 'RIGHT']],
  counter: [['HOME', 'CNT']],
  faults: [['HOME', 'FAULT']],
  service: [['HOME', 'F'], ['HOME+F', 'FAULT']],
  jetStatus: [['HOME', 'F'], ['HOME+F', 'FAULT'], ['E1', 'DOWN']],
  stability: [['HOME', 'F'], ['HOME+F', 'FAULT'], ['E1', 'DOWN'], ['E2', 'RIGHT'], ['E3', 'RIGHT'], ['E4', 'RIGHT']],
  faultInhibit: [['HOME', 'F'], ['HOME+F', 'FAULT'], ['E1', 'RIGHT']],
  jet: [['HOME', 'F'], ['HOME+F', 'FAULT'], ['E1', 'RIGHT'], ['E7', 'RIGHT'], ['E8', 'DOWN'], ['E8+arm', 'CYCLE']],
  visco: [['HOME', 'F'], ['HOME+F', 'FAULT'], ['E1', 'LEFT'], ['E13', 'LEFT'], ['E12', 'LEFT']],
  startup: [['HOME', 'F'], ['HOME+F', 'PARAM'], ['V24', 'LEFT']],
}
export const routeTarget = (name) => ROUTES[name]?.at(-1)

function sig(fw) {
  if (fw.scr === 'HOME' && fw.pre) return `HOME+${fw.pre}`
  if (fw.scr === 'E8' && fw.opt.e8armed) return 'E8+arm'
  return fw.scr
}

const ROUTE_END = {
  clock: 'I1', date: 'I2', select: 'HDR', text: 'TXT', delay: 'M9', encoder: 'M10', mode: 'M13', counterParams: 'M24', start: 'M26',
  postdate: 'M29', shift: 'M30', counter: 'I10', faults: 'FAULTS', service: 'E1', jetStatus: 'E2', stability: 'E5', faultInhibit: 'E7', jet: 'E9', visco: 'E11', startup: 'I9',
}
export const routeEnd = (name) => ROUTE_END[name]

// Tecla para salir de la pantalla actual hacia «Function?...»
export function backKey(s) {
  const fw = fwOf(s)
  if (s.power === 'OFF') return 'ONOFF'
  if (fw.scr === 'STOPQ') return 'N'
  if (fw.scr === 'TXT') return fw.var ? 'EDIT' : 'EDIT'
  if (fw.scr === 'BC') return 'EDIT'
  if (fw.mod) return 'UP'
  if (fw.scr === 'HOME' && fw.pre) return fw.pre
  return 'UP'
}

// Siguiente tecla para llegar a la pantalla `name`
export function navKey(s, name) {
  const fw = fwOf(s)
  if (s.power === 'OFF') return 'ONOFF'
  if (fw.scr === ROUTE_END[name] && !fw.mod) return null
  const r = ROUTES[name]
  if (!r) return null
  const here = sig(fw)
  for (let i = r.length - 1; i >= 0; i--) if (r[i][0] === here) return r[i][1]
  if (fw.scr === 'HOME') return r[0][1]
  return backKey(s)
}

// Teclado del PC → teclas del panel
export function fromKeyboard(e) {
  const k = e.key
  if (k === 'ArrowLeft') return 'LEFT'
  if (k === 'ArrowRight') return 'RIGHT'
  if (k === 'ArrowUp' || k === 'Backspace' || k === 'Escape') return 'UP'
  if (k === 'ArrowDown' || k === 'Enter') return 'DOWN'
  if (k === ' ') return 'SPACE'
  if (/^[a-zA-Z]$/.test(k)) return k.toUpperCase() === 'F' ? 'F_KEY' : k.toUpperCase()
  if (/^[0-9]$/.test(k)) return k
  const m = { ':': 'COLON', '<': 'LT', '>': 'GT', '/': 'SLASH', '-': 'MINUS', '=': 'EQUAL', "'": 'QUOTE', '[': 'LBR' }
  return m[k] || null
}

export function screenId(s) {
  return fwOf(s).scr
}

export function curMessageNumber(s) {
  return fwOf(s).msg
}
