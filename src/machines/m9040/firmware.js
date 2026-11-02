// Firmware simulado del Markem-Imaje 9040 (1 cabezal; monochorro o bichorro según s.hw.head.jets).
// LCD gráfico 640×200: fila de estado, barra de menús, zona de edición, barra de iconos F1–F8.
// Menús, diálogos y textos según el Manual del Usuario A36952 (pantallas en castellano).
//
// Teclas: ONOFF, WRENCH (llave), INFO (i), F1…F8, UP, DOWN, LEFT, RIGHT, CENTER, ESC, ENTER, TAB,
// teclado: A–Z, D0–D9 (fila superior), N0–N9 / NDOT / NENTER / NUMLOCK (teclado numérico),
// GRAVE, MINUS, EQUAL, LBR, RBR, SEMI, QUOTE, YEN, COMMA, PERIOD, SLASH, BKSP, TABK, ENTERK,
// CAPS, SHIFT, SHIFTR, CTRL, CTRLR, ALT, ALTR, SPACE.
import { rtcNow, pad } from '../../engine/rtc.js'
import { newId } from '../../engine/defaults.js'
import { fieldText, printCtx } from '../../engine/render.js'
import { FAULTS } from '../../engine/faults.js'

// ------------------------------------------------------------------ teclado
const SHIFTED = { D1: '!', D2: '@', D3: '#', D4: '$', D5: '%', D6: '€', D7: '&', D8: '*', D9: '(', D0: ')', MINUS: '_', EQUAL: '+', LBR: '{', RBR: '}', SEMI: ':', QUOTE: '"', YEN: '|', COMMA: '<', PERIOD: '>', SLASH: '?', GRAVE: '~' }
const PLAIN = { MINUS: '-', EQUAL: '=', LBR: '[', RBR: ']', SEMI: ';', QUOTE: "'", YEN: '¥', COMMA: ',', PERIOD: '.', SLASH: '/', GRAVE: '`', SPACE: ' ' }

function charFor(fw, key) {
  const sh = fw.shift
  if (/^[A-Z]$/.test(key)) return fw.caps !== sh ? key : key.toLowerCase()
  if (/^D\d$/.test(key)) return sh ? SHIFTED[key] : key[1]
  if (/^N\d$/.test(key)) return fw.num && !sh ? key[1] : null
  if (key === 'NDOT') return fw.num && !sh ? '.' : null
  if (sh && SHIFTED[key]) return SHIFTED[key]
  return PLAIN[key] ?? null
}

export function keyForChar(ch) {
  if (/^[A-Z]$/.test(ch)) return { key: ch, upper: true }
  if (/^[a-z]$/.test(ch)) return { key: ch.toUpperCase(), upper: false }
  if (/^[0-9]$/.test(ch)) return { key: `D${ch}` }
  for (const [k, c] of Object.entries(PLAIN)) if (c === ch) return { key: k }
  for (const [k, c] of Object.entries(SHIFTED)) if (c === ch) return { key: k, shift: true }
  return null
}

const isCharKey = (k) => /^[A-Z]$/.test(k) || /^D\d$/.test(k) || /^N\d$/.test(k) || k === 'NDOT' || k in PLAIN || k in SHIFTED

// ------------------------------------------------------------------ menús
export const MENUS = {
  PROD: {
    title: 'MENU DE PRODUCCION',
    bar: [
      { label: 'Impresora', items: ['Arranque', 'Paro', 'Arranque chorro(s)', 'Paro chorro(s)', 'Modo de arranque'] },
      { label: 'Mensaje', items: ['Selección mensajes', 'Creación de la biblioteca', 'Visua / Inic. contador', 'Campo usuario'] },
      { label: 'Estado/Cabezal de impresión', items: ['Estado chorro', 'DEFECTOS', 'Velocidad motor'] },
      { label: 'Mantenimiento', items: ['Anulación defectos', 'Modificación estado ELV', 'Vaciado', 'SAV'] },
    ],
  },
  EDIT: {
    title: 'MENU DE EDICION DE MENSAJE',
    bar: [
      { label: 'Mensaje', items: ['Nuevo', 'Abrir', 'Guardar', 'Guardar como', 'Eliminar', 'Cargar impresora', 'Cerrar'] },
      { label: 'Fuente', items: ['Selección Fuente', 'Selección Símbolo de la fuente', 'Dilatación', 'Tabulación', 'Código de barras'] },
      { label: 'Variables', items: ['Contador', 'Contador 2', 'Reloj', 'Fecha', 'Caducidad', 'Caducidad 2', 'Tabla Fecha Auto', 'Turno de trabajo', 'Externa', 'Usuario'] },
      { label: 'Parametros', items: ['Mensaje', 'Contador', 'Contador 2', 'Caducidad', 'Caducidad 2', 'Turno de trabajo', 'Codigo de barras'] },
    ],
  },
  PREP: {
    title: 'MENU DE PREPARACION DE IMPRESORA',
    bar: [
      { label: 'Inicializacion', items: ['Idioma', 'Impresora', 'Reloj automático', 'Orientación chorros', 'Comunicación V24', 'Comunicación ETHERNET', 'Carga a Pcmcia/USB/SD', 'Carga de fuente(s)'] },
      { label: 'Parametros', items: ['Mensaje', 'Contador', 'Contador 2', 'Caducidad', 'Caducidad 2', 'Turno de trabajo', 'Tabla Fecha Auto', 'Código de barras', 'Selección Fuente'] },
      { label: 'Opciones', items: ['Versiones', 'Contador horario', 'Opciones equipo'] },
      { label: 'Codigos de acceso', items: ['Teclado', 'Seguridad'] },
    ],
  },
  LOGO: {
    title: 'MENU EDICION DE LOGOS',
    bar: [
      { label: 'Logo', items: ['Nuevo', 'Abrir', 'Guardar', 'Guardar como', 'Eliminar', 'Cerrar'] },
      { label: 'Formato', items: ['Formato logo'] },
    ],
  },
}

export const FONTS_9040 = [
  ['SIN05075', '5x5'],
  ['SIN07118', '7x5'],
  ['SIN09098', '9x7'],
  ['SIN11088', '11x9'],
  ['SIN16068', '16x10'],
  ['SIN24058', '24x16'],
]
const fontName = (f) => (FONTS_9040.find((x) => x[1] === f) || FONTS_9040[1])[0]

const MODOS = [
  ['MANUAL_OBJETO', 'MANUAL OBJECTO'],
  ['MANUAL_AUTO', 'MANUAL AUTO'],
  ['OBJETO', 'OBJECTO'],
  ['REPETITIVO', 'REPETITIVO'],
]
const LECTURA = [
  ['CONSTANTE', 'VELOCIDAD CONSTANTE'],
  ['ENCODER', 'TACO'],
  ['CELULAS', 'CELULAS'],
]
const JET_FUNCS = ['PARO CHORRO', 'ARRANQUE CHORRO', 'REFRESCO DE TINTA', 'ESTABILIDAD CHORRO', 'INTRO.DISOLVENTE', 'DESOBTURACION BUS', 'AJUSTE CHORRO']
const BC_TYPES = [
  ['ITF', '2/5 Entrelazado'],
  ['CODE39', 'CODIGO 39'],
  ['CODE128', 'EAN128 / CODE128'],
  ['DATAMATRIX', 'DATAMATRIX'],
]

// ------------------------------------------------------------------ estado
export function initFw() {
  return {
    mode: 'PROD',
    others: false,
    focus: 'bar',
    bar: 0,
    pull: 0,
    dlg: null,
    status: null,
    defects: null,
    confirm: null,
    info: null,
    line: 0,
    pos: 0,
    ins: true,
    caps: true,
    shift: false,
    alt: false,
    ctrl: false,
    num: true,
    font: '7x5',
  }
}

const fwOf = (s) => {
  const k = s.ui?.machine || 'M9040'
  if (!s.fw[k]) s.fw[k] = initFw()
  return s.fw[k]
}
const active = (s) => s.messages[s.activeMessage]
const edMsg = (s) => s.editing?.message

// ------------------------------------------------------------------ celdas del mensaje en edición
function lineCells(line) {
  const cells = []
  for (const f of line || []) {
    if (f.type === 'text') for (const c of [...f.value]) cells.push({ c, font: f.font, bold: f.bold })
    else cells.push({ f })
  }
  return cells
}
function cellsLine(cells) {
  const out = []
  for (const cell of cells) {
    if (cell.f) out.push(cell.f)
    else {
      const last = out.at(-1)
      if (last && last.type === 'text' && last.font === cell.font && last.bold === cell.bold) last.value += cell.c
      else out.push({ id: newId(), type: 'text', value: cell.c, font: cell.font || '7x5', bold: cell.bold || 1 })
    }
  }
  return out
}
const curCells = (s, fw) => lineCells(edMsg(s).lines[fw.line])
function setCells(s, fw, cells) {
  edMsg(s).lines[fw.line] = cellsLine(cells)
  s.editing.dirty = true
}
function insertCell(s, fw, cell, act) {
  const cells = curCells(s, fw)
  if (fw.ins || fw.pos >= cells.length) cells.splice(fw.pos, 0, cell)
  else cells[fw.pos] = cell
  fw.pos += 1
  setCells(s, fw, cells)
  if (cell.f) act({ type: 'EDIT_INSERT_EVT', fieldType: cell.f.type })
}
function insertField(s, fw, field, act) {
  insertCell(s, fw, { f: { id: newId(), font: fw.font, bold: 1, ...field } }, act)
}
export function cellLabel(cell, s) {
  if (!cell.f) return cell.c
  const ctx = { ...printCtx(s, rtcNow(s.rtcOffset)), message: edMsg(s) }
  return fieldText(cell.f, ctx)
}

// ------------------------------------------------------------------ formularios (diálogos)
// Campo: { k, label, type: 'num'|'text'|'sel'|'chk'|'ro'|'btn', len, opts:[[val,label]], min, max, hide }
const n = (k, label, len, min, max, extra = {}) => ({ k, label, type: 'num', len, min, max, ...extra })
const t = (k, label, len, extra = {}) => ({ k, label, type: 'text', len, ...extra })
const sel = (k, label, opts, extra = {}) => ({ k, label, type: 'sel', opts, ...extra })
const chk = (k, label, extra = {}) => ({ k, label, type: 'chk', ...extra })

const timeOk = (v, sec) => (sec ? /^\d\d:\d\d:\d\d$/ : /^\d\d:\d\d$/).test(v) && v.split(':').every((x, i) => +x < (i === 0 ? 24 : 60))

export const FORMS = {
  msgParams: {
    title: (s, fw, d) => `MENSAJE: ${d.ctx === 'prod' ? s.activeMessage : edMsg(s)?.name || ''}`,
    nav: ['msgParams', 'encoder', 'mode', 'delay'],
    cols: 2,
    fields: [
      sel('sense', 'Sentido impresion', [['DIRECTO', 'F.D. →'], ['INVERSO', 'F.D. ←']]),
      chk('transp', 'Impresion transp.'),
      chk('inv', 'Impresion inversa'),
      chk('din', 'Caracteres DIN'),
      n('repeat', 'Repeticion de impresion', 3, 0, 255),
      n('printSpeed', 'Velocidad de impresion', 4, 1, 9999),
      n('division', 'Division taco', 3, 1, 255, { hide: (d) => d.v.lectura !== 'ENCODER' }),
      sel('algo', 'Algo', [['AUTO', 'AUTO']]),
      n('delayFwd', 'Retardo ida: (mm)', 4, 0, 9999),
      n('delayRev', 'Retardo vuelta: (mm)', 4, 0, 9999),
      n('interval', 'Intervalo: (mm)', 4, 0, 9999),
      n('dtopFilter', 'Filtro DTOP: (us)', 4, 0, 9999),
      sel('trigger', 'Modo de disparo', MODOS),
      sel('lectura', 'Lectura velocidad', LECTURA),
    ],
    load: (s, fw, d) => {
      const m = d.ctx === 'prod' ? active(s) : edMsg(s)
      const p = m.params
      return {
        sense: p.sense || 'DIRECTO', transp: !!p.transp, inv: !!p.inv, din: !!p.din, repeat: p.repeat ?? 1, printSpeed: p.printSpeed, division: s.hw.encoder.division,
        algo: 'AUTO', delayFwd: p.delayFwd, delayRev: p.delayRev, interval: p.interval ?? 3, dtopFilter: p.dtopFilter ?? 100, trigger: p.trigger, lectura: s.hw.encoder.source,
      }
    },
    save: (s, fw, d, act) => {
      const v = d.v
      const params = { sense: v.sense, transp: v.transp, inv: v.inv, din: v.din, repeat: v.repeat, printSpeed: v.printSpeed, delayFwd: v.delayFwd, delayRev: v.delayRev, interval: v.interval, dtopFilter: v.dtopFilter, trigger: v.trigger }
      if (d.ctx === 'prod') {
        for (const [k, val] of Object.entries(params)) act({ type: 'SET_ACTIVE_MSG', path: `params.${k}`, value: val })
      } else Object.assign(edMsg(s).params, params)
      act({ type: 'SET_HW', path: 'encoder.source', value: v.lectura })
      if (v.lectura === 'ENCODER') act({ type: 'SET_HW', path: 'encoder.division', value: v.division })
    },
  },
  counters: {
    title: () => 'CONTADORES',
    fields: [
      { k: 'c11', label: 'Contador 1.1', type: 'ro' },
      chk('reset1', 'Reset'),
      { k: 'c12', label: 'Contador 1.2', type: 'ro' },
      chk('reset2', 'Reset'),
    ],
    cols: 2,
    load: (s) => {
      const m = active(s)
      return { c11: m ? pad(m.counter.value, 9) : '---------', reset1: false, c12: '---------', reset2: false }
    },
    save: (s, fw, d, act) => {
      if (d.v.reset1) act({ type: 'COUNTER_RESET' })
    },
    nav: ['counter'],
  },
  cntParams: {
    title: () => 'CONTADOR',
    nav: ['counterParams'],
    cols: 2,
    fields: [
      n('start', 'Valor inicial', 9, 0, 999999999),
      n('end', 'Valor final', 9, 0, 999999999),
      n('step', 'Paso contador', 2, 0, 99),
      n('batch', 'Contador lotes', 6, 1, 999999),
      sel('incType', 'Tipo incremento', [['OBJETOS', 'OBJECTO'], ['MENSAJES', 'MENSAJE'], ['EXT', 'EXT']]),
      chk('leadingZeros', 'Ceros a la izquierda'),
      chk('cyclic', 'Contador ciclico'),
    ],
    load: (s) => ({ ...edMsg(s).counter }),
    save: (s, fw, d) => {
      const c = edMsg(s).counter
      const changed = c.start !== d.v.start || c.end !== d.v.end
      Object.assign(c, { start: d.v.start, end: d.v.end, step: d.v.step, batch: d.v.batch, incType: d.v.incType, leadingZeros: d.v.leadingZeros, cyclic: d.v.cyclic })
      if (changed) c.value = c.start
      s.editing.dirty = true
    },
  },
  expParams: {
    title: (s, fw, d) => (d.slot === 2 ? 'CADUCIDAD 2' : 'CADUCIDAD'),
    nav: ['postdate'],
    fields: [sel('unit', 'Unidad', [['DIAS', 'DIA'], ['MESES', 'MES']]), n('amount', 'Caducidad', 4, 0, 9999)],
    load: (s, fw, d) => ({ ...(d.slot === 2 ? edMsg(s).expiry2 : edMsg(s).expiry) }),
    save: (s, fw, d) => {
      edMsg(s)[d.slot === 2 ? 'expiry2' : 'expiry'] = { amount: d.v.amount, unit: d.v.unit }
      s.editing.dirty = true
    },
  },
  shiftParams: {
    title: () => 'TURNO DE TRABAJO',
    nav: ['shift'],
    fields: [t('start', 'Hora inicio: (hh:mn)', 5, { time: true }), t('interval', 'Intervalo: (hh:mn)', 5, { time: true }), sel('type', 'Tipo', [['01', 'CIFRAS'], ['LETRAS', 'LETRAS'], ['A-O-I', 'LETRAS (-I -O)']])],
    load: (s) => {
      const sh = edMsg(s).shift
      return { start: sh.start, interval: sh.interval, type: sh.type === 'LETRAS' ? 'LETRAS' : sh.type === 'A-O-I' ? 'A-O-I' : '01' }
    },
    check: (v) => (timeOk(v.start) && timeOk(v.interval) && v.interval !== '00:00' ? null : 'Hora incorrecta (hh:mn)'),
    save: (s, fw, d) => {
      edMsg(s).shift = { start: d.v.start, interval: d.v.interval, type: d.v.type, codes: [] }
      s.editing.dirty = true
    },
  },
  bcParams: {
    title: () => 'CODIGO DE BARRAS',
    nav: ['bcParams'],
    cols: 2,
    fields: [
      sel('symbology', 'Tipo', BC_TYPES),
      n('nb', 'Barras estrechas', 1, 1, 4),
      n('ns', 'Espacios estrechos', 1, 1, 4),
      n('wb', 'Barras anchas', 1, 2, 9),
      n('ws', 'Espacios anchos', 1, 2, 9),
      sel('hr', 'Lectura humana', [['NINGUNO', 'NINGUNO'], ['DEBAJO', 'DEBAJO']]),
      n('height', 'Altura', 2, 5, 32),
      chk('inv', 'Impresion inversa'),
      chk('check', 'Digito comprobacion'),
    ],
    load: (s) => ({ symbology: 'CODE128', nb: 1, ns: 1, wb: 3, ws: 3, hr: 'NINGUNO', height: 14, inv: false, check: false, ...(edMsg(s).barcode || {}) }),
    save: (s, fw, d) => {
      edMsg(s).barcode = { ...d.v }
      s.editing.dirty = true
    },
  },
  varDate: {
    title: () => 'FECHA',
    compose: true,
    fields: [
      chk('X', 'Dia semana', { code: 'X' }), chk('WW', 'Semana del año', { code: 'WW' }),
      chk('DD', 'Dia del mes', { code: 'DD' }), chk('MM', 'Mes del año (Cifra)', { code: 'MM' }),
      chk('JJJ', 'Dia del año', { code: 'JJJ' }), chk('MMM', 'Mes del año (Letra)', { code: 'MMM' }),
      chk('Y', 'Ultimo dig. año', { code: 'Y' }), chk('YY', 'Año', { code: 'YY' }),
      t('comp', 'Composicion', 20),
    ],
    cols: 2,
    load: () => ({ comp: '' }),
    save: (s, fw, d, act) => {
      if (!d.v.comp.trim()) return 'Composición vacía'
      fw.dlg = null
      insertField(s, fw, { type: 'date', format: d.v.comp.replace(/X/g, 'D') }, act)
      return null
    },
  },
  varClock: {
    title: () => 'HORA',
    compose: true,
    fields: [chk('HH', 'Horas', { code: 'HH' }), chk('NN', 'Minutos', { code: 'NN' }), chk('SS', 'Segundos', { code: 'SS' }), t('comp', 'Composicion', 12)],
    load: () => ({ comp: '' }),
    save: (s, fw, d, act) => {
      if (!d.v.comp.trim()) return 'Composición vacía'
      fw.dlg = null
      insertField(s, fw, { type: 'clock', format: d.v.comp.replace(/NN/g, 'MM') }, act)
      return null
    },
  },
  varExpiry: {
    title: (s, fw, d) => (d.slot === 2 ? 'CADUCIDAD 2' : 'CADUCIDAD'),
    compose: true,
    cols: 2,
    fields: [
      chk('dd', 'Dia de mes de caducidad', { code: 'dd' }), chk('mm', 'Mes año caduc. (Cifra)', { code: 'mm' }),
      chk('jjj', 'Año de caducidad', { code: 'jjj' }), chk('mmm', 'Mes año caduc. (Letra)', { code: 'mmm' }),
      chk('ww', 'Semana año caducidad', { code: 'ww' }), chk('yy', 'Año de caducidad', { code: 'yy' }),
      t('comp', 'Composicion', 20),
    ],
    load: () => ({ comp: '' }),
    save: (s, fw, d, act) => {
      if (!d.v.comp.trim()) return 'Composición vacía'
      fw.dlg = null
      insertField(s, fw, { type: 'expiry', slot: d.slot || 1, format: d.v.comp.toUpperCase().replace(/WW/g, 'WW') }, act)
      return null
    },
  },
  varExternal: {
    title: () => 'EXTERNA',
    fields: [n('len', 'Formato (nº de caracteres)', 2, 1, 99), t('symbol', 'Visualizacion del logo', 1)],
    load: () => ({ len: 8, symbol: '*' }),
    save: (s, fw, d, act) => {
      fw.dlg = null
      insertField(s, fw, { type: 'external', len: d.v.len, symbol: d.v.symbol || '*' }, act)
      return null
    },
  },
  varUser: {
    title: () => 'USUARIO',
    fields: [n('size', 'Tamano (#. de caracteres)', 2, 1, 99), t('name', 'Elemento de identificacion', 10), t('def', 'Valor por defecto', 10)],
    load: () => ({ size: 5, name: 'LOTE', def: 'A0001' }),
    check: (v) => (v.name.trim() ? null : 'Falta el elemento de identificación'),
    save: (s, fw, d, act) => {
      const name = d.v.name.trim().toUpperCase()
      act({ type: 'OPVAR_ENSURE', name, size: d.v.size, def: d.v.def })
      fw.dlg = null
      insertField(s, fw, { type: 'opvar', name }, act)
      return null
    },
  },
  bcCompose: {
    title: (s) => (BC_TYPES.find((b) => b[0] === (edMsg(s).barcode?.symbology || 'CODE128')) || BC_TYPES[2])[1],
    fields: [
      chk('counter', 'Contador'),
      chk('clock', 'Reloj'),
      chk('date', 'Fecha'),
      chk('external', 'Elemento externo'),
      t('comp', 'Composicion', 24),
    ],
    load: () => ({ comp: '' }),
    save: (s, fw, d, act) => {
      const v = d.v
      const bc = edMsg(s).barcode || { symbology: 'CODE128', height: 14 }
      const source = v.external ? 'external' : v.counter ? 'counter' : v.date ? 'date' : 'text'
      if (source === 'text' && !v.comp.trim()) return 'Composición vacía'
      fw.dlg = null
      insertField(s, fw, { type: 'barcode', symbology: bc.symbology, source, value: v.comp.trim(), height: bc.height || 14 }, act)
      return null
    },
  },
  dilat: {
    title: () => 'DILATACION',
    fields: [n('bold', 'Dilatación', 1, 1, 9)],
    load: (s, fw) => ({ bold: edMsg(s).lines[fw.line]?.[0]?.bold || 1 }),
    save: (s, fw, d) => {
      ;(edMsg(s).lines[fw.line] || []).forEach((f) => (f.bold = d.v.bold))
      s.editing.dirty = true
    },
  },
  clock: {
    title: () => 'RELOJ AUTOMATICO',
    nav: ['clock'],
    cols: 2,
    fields: [
      t('time', 'Hora  (hh:mm:ss)', 8, { time: true }),
      chk('frozen', 'Paro/Marcha fecha aut'),
      t('date', 'Fecha (dd/mm/aa)', 8, { date: true }),
      sel('fmt', 'Formato fecha', [['dd/mm/aa', 'dd/mm/aa'], ['mm/dd/aa', 'mm/dd/aa'], ['aa/mm/dd', 'aa/mm/dd']]),
      t('change', 'Hora cambio fecha (hh:mm)', 5, { time: true }),
    ],
    load: (s) => {
      const d = rtcNow(s.rtcOffset)
      return { time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, frozen: !!s.hw.clockStop, date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear() % 100)}`, fmt: 'dd/mm/aa', change: s.hw.dateChange || '00:00' }
    },
    check: (v) => {
      if (!timeOk(v.time, true)) return 'Hora incorrecta (hh:mm:ss)'
      const [dd, mo, yy] = v.date.split('/').map(Number)
      const test = new Date(2000 + yy, mo - 1, dd)
      if (!/^\d\d\/\d\d\/\d\d$/.test(v.date) || test.getDate() !== dd || mo < 1 || mo > 12) return 'Fecha incorrecta (dd/mm/aa)'
      if (!timeOk(v.change)) return 'Hora cambio fecha incorrecta (hh:mm)'
      return null
    },
    save: (s, fw, d, act) => {
      const [h, m, sec] = d.v.time.split(':').map(Number)
      const [dd, mo, yy] = d.v.date.split('/').map(Number)
      const before = rtcNow(s.rtcOffset)
      const timeChanged = h !== before.getHours() || m !== before.getMinutes() || Math.abs(sec - before.getSeconds()) > 2
      const dateChanged = dd !== before.getDate() || mo !== before.getMonth() + 1 || yy !== before.getFullYear() % 100
      if (timeChanged || dateChanged) act({ type: 'RTC_SET', y: 2000 + yy, mo, d: dd, h, m, sec })
      s.hw.clockStop = d.v.frozen
      if ((s.hw.dateChange || '00:00') !== d.v.change) act({ type: 'SET_HW', path: 'dateChange', value: d.v.change })
    },
  },
  orient: {
    title: () => 'ORIENTACION CHORROS',
    nav: ['head'],
    fields: [sel('jet', 'Numero de chorro', [['j1', '1.1'], ['j2', '1.2']]), n('val', 'Orientacion', 2, 0, 99)],
    load: (s) => ({ jet: 'j1', val: s.hw.head.orient?.j1 ?? 0, all: { ...(s.hw.head.orient || { j1: 0, j2: 0 }) } }),
    onChange: (s, d, k) => {
      if (k === 'jet') d.v.val = d.v.all[d.v.jet] ?? 0
      if (k === 'val') d.v.all[d.v.jet] = d.v.val
    },
    save: (s, fw, d, act) => {
      d.v.all[d.v.jet] = d.v.val
      act({ type: 'SET_HW', path: 'head.orient', value: { ...d.v.all } })
    },
  },
  v24: {
    title: () => 'COMUNICACION V24',
    nav: ['v24'],
    fields: [
      sel('baud', 'Velocidad (bauds)', [[4800, '4800'], [9600, '9600'], [19200, '19200'], [38400, '38400'], [115200, '115200']]),
      sel('parity', 'Paridad', [['NINGUNA', 'NO'], ['PAR', 'PAR'], ['IMPAR', 'IMPAR']]),
      sel('stop', 'Stop bit(s)', [[1, '1'], [2, '2']]),
      n('watchdog', 'Watchdog (s)', 2, 1, 99),
      { k: 'bits', label: 'Formato de 8 bits', type: 'ro' },
      sel('mode', 'Comunicacion RS232', [['ESTANDAR', 'ESTANDAR'], ['DIRECTA', 'DIRECTA'], ['TEST', 'TEST']]),
      sel('protocol', 'Protocolo Simple', [['NO', 'NO'], ['SELECCION', 'SELECCION MENSAJE'], ['EXTERNAS', 'VARIABLES EXTERNAS']]),
    ],
    load: (s) => ({ baud: s.hw.v24.baud, parity: s.hw.v24.parity, stop: s.hw.v24.stop, watchdog: s.hw.v24.watchdog ?? 3, bits: '', mode: s.hw.v24.mode || 'ESTANDAR', protocol: s.hw.v24.simple || 'NO' }),
    save: (s, fw, d, act) => {
      act({ type: 'SET_HW', path: 'v24.baud', value: d.v.baud })
      act({ type: 'SET_HW', path: 'v24.parity', value: d.v.parity })
      act({ type: 'SET_HW', path: 'v24.stop', value: d.v.stop })
      act({ type: 'SET_HW', path: 'v24.bits', value: 8 })
      act({ type: 'SET_HW', path: 'v24.watchdog', value: d.v.watchdog })
      act({ type: 'SET_HW', path: 'v24.mode', value: d.v.mode })
      act({ type: 'SET_HW', path: 'v24.simple', value: d.v.protocol })
    },
  },
  startMode: {
    title: () => 'MODO DE ARRANQUE',
    fields: [sel('mode', 'Modo de arranque', [['AUTO', 'AUTOMATICO'], ['MANUAL', 'MANUAL']])],
    load: (s) => ({ mode: s.hw.startMode }),
    save: (s, fw, d, act) => act({ type: 'SET_START_MODE', mode: d.v.mode }),
    nav: ['startup'],
  },
  faultInhibit: {
    title: () => 'ANULACION DEFECTOS',
    nav: ['faultInhibit'],
    fields: [chk('cover', 'Defecto tapa abierta'), chk('recup', 'Recuperacion defecto')],
    load: (s) => ({ ...s.hw.faultInhibit }),
    save: (s, fw, d, act) => {
      act({ type: 'SET_HW', path: 'faultInhibit.cover', value: d.v.cover })
      act({ type: 'SET_HW', path: 'faultInhibit.recup', value: d.v.recup })
    },
  },
  newmsg: {
    title: () => 'NUEVO MENSAJE',
    fields: [t('name', 'Nombre mensaje', 8, { upper: true })],
    load: () => ({ name: '' }),
    check: (v, s) => (!v.name.trim() ? 'Escriba un nombre' : s.messages[v.name.trim().toUpperCase()] ? 'Ese mensaje ya existe' : null),
    save: (s, fw, d, act) => {
      act({ type: 'EDIT_NEW', name: d.v.name.trim().toUpperCase(), quiet: true })
      fw.dlg = null
      enterEdit(s, fw, act)
      return null
    },
  },
  saveas: {
    title: () => 'GUARDAR COMO',
    fields: [t('name', 'Nombre mensaje', 8, { upper: true })],
    load: (s) => ({ name: edMsg(s)?.name || '' }),
    check: (v) => (!v.name.trim() ? 'Escriba un nombre' : null),
    save: (s, fw, d, act) => act({ type: 'EDIT_SAVE_AS', name: d.v.name.trim().toUpperCase(), quiet: true }),
  },
}

// Listas (selección de mensaje, abrir, fuentes, campos usuario, defectos)
function openList(s, fw, id, act) {
  const names = Object.keys(s.messages).sort()
  if (id === 'select' || id === 'open') {
    const cur = Math.max(0, names.indexOf(id === 'select' ? s.activeMessage : edMsg(s)?.name))
    fw.dlg = { list: id, items: names, cur, typed: '' }
    act({ type: 'NAV', view: id === 'select' ? 'select' : 'open' })
  } else if (id === 'font') {
    fw.dlg = { list: 'font', items: FONTS_9040.map((f) => f[0]), cur: Math.max(0, FONTS_9040.findIndex((f) => f[1] === fw.font)) }
  } else if (id === 'user') {
    const m = id === 'user' && fw.mode === 'EDIT' ? edMsg(s) : active(s)
    const used = [...new Set((m?.lines.flat() || []).filter((f) => f.type === 'opvar').map((f) => f.name))]
    if (!used.length) {
      info(fw, ['El mensaje no tiene campos de usuario.'])
      return
    }
    fw.dlg = { list: 'user', items: used, cur: 0, edit: false, buf: '' }
    act({ type: 'NAV', view: 'userFields' })
  } else if (id === 'bctype') {
    fw.dlg = { list: 'bctype', items: BC_TYPES.map((b) => b[1]), cur: 2 }
  }
}

function openForm(s, fw, id, act, extra = {}) {
  const F = FORMS[id]
  const d = { form: id, cur: 0, edit: false, buf: '', listOpen: null, err: null, ...extra }
  d.v = F.load(s, fw, d)
  // el foco empieza en el primer campo modificable
  if (F.fields[d.cur]?.type === 'ro') moveField(d, 1)
  fw.dlg = d
  for (const v of F.nav || []) act({ type: 'NAV', view: v })
  skipHidden(d, 1)
}

const visibleFields = (d) => FORMS[d.form].fields.filter((f) => !f.hide?.(d))
function skipHidden(d, dir) {
  const fs = FORMS[d.form].fields
  let guard = 0
  while (fs[d.cur]?.hide?.(d) && guard++ < fs.length) d.cur = (d.cur + dir + fs.length) % fs.length
}

function info(fw, lines) {
  fw.info = { lines }
}

// ------------------------------------------------------------------ cambio de modo
function enterEdit(s, fw, act) {
  fw.mode = 'EDIT'
  fw.others = false
  fw.focus = 'main'
  fw.bar = 0
  fw.line = 0
  fw.pos = lineCells(edMsg(s)?.lines[0]).length
  act({ type: 'NAV', view: 'text' })
}

function toProd(s, fw, act) {
  if (s.editing) act({ type: 'EDIT_CLOSE' })
  fw.mode = 'PROD'
  fw.others = false
  fw.focus = 'bar'
  fw.bar = 0
  fw.dlg = null
  act({ type: 'NAV', view: 'prod' })
}

function leaveEdit(s, fw, act) {
  if (s.editing?.dirty) {
    fw.confirm = { lines: ['¿Guardar las modificaciones del mensaje?'], sel: 1, yes: 'SAVE_EXIT', no: 'EXIT' }
    return
  }
  toProd(s, fw, act)
}

// ------------------------------------------------------------------ acciones de menú
function menuAction(s, fw, mode, bar, item, act) {
  const label = MENUS[mode].bar[bar].items[item]
  fw.focus = mode === 'EDIT' ? 'main' : 'bar'
  if (mode === 'PROD') {
    switch (label) {
      case 'Arranque':
        if (s.power === 'OFF') act({ type: 'POWER_ON' })
        return
      case 'Paro':
        askStop(fw)
        return
      case 'Arranque chorro(s)':
        act({ type: 'JET_START' })
        return
      case 'Paro chorro(s)':
        act({ type: 'JET_STOP' })
        return
      case 'Modo de arranque':
        return openForm(s, fw, 'startMode', act)
      case 'Selección mensajes':
        return openList(s, fw, 'select', act)
      case 'Visua / Inic. contador':
        return openForm(s, fw, 'counters', act)
      case 'Campo usuario':
        return openList(s, fw, 'user', act)
      case 'Estado chorro':
        return openStatus(s, fw, act)
      case 'DEFECTOS':
        return openDefects(s, fw, act)
      case 'Anulación defectos':
        return openForm(s, fw, 'faultInhibit', act)
      case 'Velocidad motor':
        return info(fw, ['Veloc. motor: 2000 t/mn', 'Ajuste reservado al técnico (by-pass).'])
      case 'SAV':
        return info(fw, [`Date : ${dateStr(s)}   Page 01/48`, 'Ttra Pres  Tr  Ad Vchorro T1 T2 Def', `2000 ${s.live.pressure.toFixed(2)} 29 04 ${s.live.velocity.toFixed(2)} 31 37 00`])
      default:
        return info(fw, [`${label}:`, 'Función de técnico no incluida en el simulador.'])
    }
  }
  if (mode === 'EDIT') {
    switch (`${bar}:${label}`) {
      case '0:Nuevo':
        return openForm(s, fw, 'newmsg', act)
      case '0:Abrir':
        return openList(s, fw, 'open', act)
      case '0:Guardar':
        act({ type: 'EDIT_SAVE' })
        return
      case '0:Guardar como':
        return openForm(s, fw, 'saveas', act)
      case '0:Eliminar':
        fw.confirm = { lines: [`¿Eliminar el mensaje ${edMsg(s)?.name}?`], sel: 0, yes: 'DELETE' }
        return
      case '0:Cargar impresora':
        act({ type: 'EDIT_LOAD_PRINTER' })
        return
      case '0:Cerrar':
        return leaveEdit(s, fw, act)
      case '1:Selección Fuente':
        return openList(s, fw, 'font', act)
      case '1:Dilatación':
        return openForm(s, fw, 'dilat', act)
      case '1:Código de barras':
        return openForm(s, fw, 'bcCompose', act)
      case '2:Contador':
      case '2:Contador 2':
        insertField(s, fw, { type: 'counter' }, act)
        return
      case '2:Reloj':
        return openForm(s, fw, 'varClock', act)
      case '2:Fecha':
        return openForm(s, fw, 'varDate', act)
      case '2:Caducidad':
        return openForm(s, fw, 'varExpiry', act, { slot: 1 })
      case '2:Caducidad 2':
        return openForm(s, fw, 'varExpiry', act, { slot: 2 })
      case '2:Turno de trabajo':
        insertField(s, fw, { type: 'shift' }, act)
        return
      case '2:Externa':
        return openForm(s, fw, 'varExternal', act)
      case '2:Usuario':
        return openForm(s, fw, 'varUser', act)
      case '3:Mensaje':
        return openForm(s, fw, 'msgParams', act, { ctx: 'edit' })
      case '3:Contador':
      case '3:Contador 2':
        return openForm(s, fw, 'cntParams', act)
      case '3:Caducidad':
        return openForm(s, fw, 'expParams', act, { slot: 1 })
      case '3:Caducidad 2':
        return openForm(s, fw, 'expParams', act, { slot: 2 })
      case '3:Turno de trabajo':
        return openForm(s, fw, 'shiftParams', act)
      case '3:Codigo de barras':
        return openForm(s, fw, 'bcParams', act)
      default:
        return info(fw, [`${label}:`, 'Función no incluida en el simulador.'])
    }
  }
  if (mode === 'PREP') {
    switch (label) {
      case 'Reloj automático':
        return openForm(s, fw, 'clock', act)
      case 'Orientación chorros':
        if (s.hw.head.jets < 2) return info(fw, ['Orientación chorros:', 'Impresora monochorro: un solo chorro (1.1), no hay que alinear.'])
        return openForm(s, fw, 'orient', act)
      case 'Comunicación V24':
        return openForm(s, fw, 'v24', act)
      case 'Versiones':
        return info(fw, ['9040  Versión simulador CIJ Trainer', 'N° de serie: SIM-9040-0001'])
      case 'Contador horario':
        return info(fw, ['Horas de trabajo: 5', `Contador de marcas: ${s.stats.prints}`])
      default:
        return info(fw, [`${label}:`, 'Ajuste de fábrica / técnico no incluido en el simulador.'])
    }
  }
  return info(fw, [`${label}:`, 'Edición de logos no incluida en el simulador.'])
}

function dateStr(s) {
  const d = rtcNow(s.rtcOffset)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear() % 100)}`
}

function askStop(fw) {
  fw.confirm = { lines: ['Selección del tipo de paro: ?', 'Paro largo (SÍ)', 'Paro corto (NO)'], sel: 1, yes: 'STOP', no: 'STOP' }
}

function openStatus(s, fw, act) {
  fw.status = { cur: 0, listOpen: null }
  act({ type: 'NAV', view: 'status' })
  act({ type: 'NAV', view: 'jet' })
  act({ type: 'NAV', view: 'visco' })
}

function openDefects(s, fw, act) {
  fw.defects = { cur: 0 }
  Object.keys(s.faults).forEach((c) => act({ type: 'FAULT_VIEW', code: c }))
  act({ type: 'NAV', view: 'faults' })
}

export const DEFECT_TEXT = {
  EHT: ['THT', 'Limpiar y secar con cuidado el cabezal.'],
  RECUP: ['Chorro 1: Recuperación', 'Centrar el chorro en el recuperador (AJUSTE CHORRO).'],
  PRESSURE: ['Presión', 'Comprobar el circuito de tinta y la presión.'],
  COVER: ['Falta de tapa', 'Colocar la tapa del cabezal.'],
  PHASE: ['Chorro 1: Detección de fase', 'Limpiar electrodos; ajustar el punto de quiebra.'],
  INK_LOW: ['Nivel de tinta bajo', 'Añadir tinta.'],
  SEDIMENT: ['Agitación tinta', 'Comprobar el agitador.'],
  AIR: ['Ventilador / aire comprimido', 'Comprobar la presurización del cabezal.'],
}

// ------------------------------------------------------------------ teclas en formularios
function formKey(s, fw, key, act) {
  const d = fw.dlg
  const F = FORMS[d.form]
  const fields = F.fields
  const f = fields[d.cur]
  const done = () => {
    const err = F.check?.(d.v, s)
    if (err) {
      d.err = err
      return
    }
    const r = F.save(s, fw, d, act)
    if (typeof r === 'string') {
      d.err = r
      return
    }
    if (fw.dlg === d) fw.dlg = null
  }
  d.err = null
  // lista desplegable abierta
  if (d.listOpen != null) {
    if (key === 'UP') d.listOpen = Math.max(0, d.listOpen - 1)
    else if (key === 'DOWN') d.listOpen = Math.min(f.opts.length - 1, d.listOpen + 1)
    else if (key === 'ENTER' || key === 'ENTERK' || key === 'NENTER' || key === 'TAB') {
      d.v[f.k] = f.opts[d.listOpen][0]
      d.listOpen = null
      F.onChange?.(s, d, f.k)
    } else if (key === 'ESC') d.listOpen = null
    return
  }
  // edición de un dato
  if (d.edit) {
    if (key === 'ENTER' || key === 'ENTERK' || key === 'NENTER' || key === 'TAB' || key === 'UP' || key === 'DOWN') {
      commitField(d, f, F, s)
      if (key === 'ENTER' || key === 'ENTERK' || key === 'NENTER') return done()
      if (key === 'UP' || key === 'DOWN') moveField(d, key === 'DOWN' ? 1 : -1)
      return
    }
    if (key === 'ESC') {
      d.edit = false
      d.buf = ''
      return
    }
    if (key === 'BKSP') {
      d.buf = d.buf.slice(0, -1)
      return
    }
    const ch = charFor(fw, key)
    fw.shift = false
    if (ch != null && d.buf.length < (f.len || 20)) {
      if (f.type === 'num' && !/\d/.test(ch)) return
      d.buf += f.upper ? ch.toUpperCase() : ch
    }
    return
  }
  switch (key) {
    case 'UP':
    case 'DOWN':
      return moveField(d, key === 'DOWN' ? 1 : -1)
    case 'LEFT':
    case 'RIGHT':
      if (F.cols === 2) return moveField(d, key === 'RIGHT' ? 1 : -1)
      if (f.type === 'sel') {
        const i = f.opts.findIndex((o) => o[0] === d.v[f.k])
        d.v[f.k] = f.opts[(i + (key === 'RIGHT' ? 1 : -1) + f.opts.length) % f.opts.length][0]
        F.onChange?.(s, d, f.k)
      }
      return
    case 'TAB':
      if (f.type === 'chk') {
        d.v[f.k] = !d.v[f.k]
        if (F.compose && f.code && d.v[f.k]) d.v.comp = (d.v.comp + f.code).slice(0, 24)
        if (F.compose && f.code && !d.v[f.k]) d.v.comp = d.v.comp.replace(f.code, '')
      } else if (f.type === 'sel') d.listOpen = Math.max(0, f.opts.findIndex((o) => o[0] === d.v[f.k]))
      else if (f.type === 'num' || f.type === 'text') {
        d.edit = true
        d.buf = ''
      }
      return
    case 'ENTER':
    case 'ENTERK':
    case 'NENTER':
      return done()
    case 'ESC':
      fw.dlg = null
      return
    case 'SPACE':
      if (f.type === 'chk') {
        d.v[f.k] = !d.v[f.k]
        if (F.compose && f.code && d.v[f.k]) d.v.comp = (d.v.comp + f.code).slice(0, 24)
        return
      }
      if (f.type === 'text') {
        d.edit = true
        d.buf = ' '
      }
      return
    default: {
      // escribir directamente en un campo numérico o de texto (empieza la edición)
      const ch = charFor(fw, key)
      fw.shift = false
      if (ch != null && (f.type === 'num' || f.type === 'text')) {
        if (f.type === 'num' && !/\d/.test(ch)) return
        d.edit = true
        d.buf = f.upper ? ch.toUpperCase() : ch
      }
    }
  }
}

function moveField(d, dir) {
  const fs = FORMS[d.form].fields
  let i = d.cur
  for (let k = 0; k < fs.length; k++) {
    i = (i + dir + fs.length) % fs.length
    if (!fs[i].hide?.(d) && fs[i].type !== 'ro') break
  }
  d.cur = i
}

function commitField(d, f, F, s) {
  d.edit = false
  if (f.type === 'num') {
    if (d.buf === '') return
    const v = Math.max(f.min ?? 0, Math.min(f.max ?? 999999999, parseInt(d.buf, 10)))
    d.v[f.k] = v
  } else {
    let v = d.buf
    if (f.time && /^\d{4}$/.test(v)) v = `${v.slice(0, 2)}:${v.slice(2)}`
    if (f.time && /^\d{6}$/.test(v)) v = `${v.slice(0, 2)}:${v.slice(2, 4)}:${v.slice(4)}`
    if (f.date && /^\d{6}$/.test(v)) v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`
    d.v[f.k] = v
  }
  d.buf = ''
  F.onChange?.(s, d, f.k)
}

// ------------------------------------------------------------------ teclas en listas
function listKey(s, fw, key, act) {
  const d = fw.dlg
  if (d.list === 'user' && d.edit) {
    if (key === 'ENTER' || key === 'ENTERK' || key === 'NENTER' || key === 'TAB') {
      act({ type: 'OPVAR_SET', name: d.items[d.cur], value: d.buf })
      d.edit = false
      d.buf = ''
      return
    }
    if (key === 'ESC') {
      d.edit = false
      return
    }
    if (key === 'BKSP') {
      d.buf = d.buf.slice(0, -1)
      return
    }
    const ch = charFor(fw, key)
    fw.shift = false
    if (ch != null) d.buf = (d.buf + ch).slice(0, 12)
    return
  }
  if (key === 'UP') d.cur = Math.max(0, d.cur - 1)
  else if (key === 'DOWN') d.cur = Math.min(d.items.length - 1, d.cur + 1)
  else if (key === 'ESC') fw.dlg = null
  else if (key === 'TAB') {
    if (d.list === 'user') {
      d.edit = true
      d.buf = ''
    } else d.typing = !d.typing
  } else if (key === 'ENTER' || key === 'ENTERK' || key === 'NENTER') {
    const item = d.items[d.cur]
    fw.dlg = null
    if (d.list === 'select') act({ type: 'SELECT_MESSAGE', name: item })
    else if (d.list === 'open') {
      if (s.editing) act({ type: 'EDIT_CLOSE' })
      act({ type: 'EDIT_OPEN', name: item })
      enterEdit(s, fw, act)
    } else if (d.list === 'font') {
      fw.font = FONTS_9040[d.cur][1]
      const line = edMsg(s)?.lines[fw.line] || []
      line.forEach((f) => (f.font = fw.font))
      if (s.editing) s.editing.dirty = true
    }
  } else if (key === 'BKSP' && d.typed) {
    d.typed = d.typed.slice(0, -1)
  } else {
    // escribir el nombre: salta al primer mensaje que empieza así
    const ch = charFor(fw, key)
    fw.shift = false
    if (ch != null && (d.list === 'select' || d.list === 'open')) {
      d.typed = ((d.typed || '') + ch.toUpperCase()).slice(0, 8)
      const i = d.items.findIndex((x) => x.startsWith(d.typed))
      if (i >= 0) d.cur = i
    }
  }
}

// ------------------------------------------------------------------ pantalla de estado (llave)
function statusKey(s, fw, key, act) {
  const st = fw.status
  if (st.listOpen != null) {
    if (key === 'UP') st.listOpen = Math.max(0, st.listOpen - 1)
    else if (key === 'DOWN') st.listOpen = Math.min(JET_FUNCS.length - 1, st.listOpen + 1)
    else if (key === 'ESC') st.listOpen = null
    else if (key === 'ENTER' || key === 'ENTERK' || key === 'NENTER' || key === 'TAB') {
      const fn = JET_FUNCS[st.listOpen]
      st.listOpen = null
      runJetFunc(s, fn, act)
    }
    return
  }
  if (key === 'UP' || key === 'DOWN') st.cur = st.cur === 0 ? 1 : 0
  else if (key === 'TAB' && st.cur === 0) st.listOpen = 0
  else if ((key === 'SPACE' || key === 'TAB' || key === 'ENTER') && st.cur === 1) openDefects(s, fw, act)
  else if (key === 'ESC' || key === 'WRENCH') {
    fw.status = null
    act({ type: 'JET_VALIDATE', quiet: true })
  }
}

function runJetFunc(s, fn, act) {
  switch (fn) {
    case 'PARO CHORRO':
      act({ type: 'JET_STOP' })
      break
    case 'ARRANQUE CHORRO':
      if (s.adjustMode) act({ type: 'ADJUST_EXIT' })
      if (s.jetState !== 'RUNNING' && s.jetState !== 'STARTING') act({ type: 'JET_START' })
      break
    case 'AJUSTE CHORRO':
      act({ type: 'ADJUST_ENTER' })
      break
    case 'REFRESCO DE TINTA':
      act({ type: 'JET_MAINT', fn: 'REFRESCO' })
      break
    case 'ESTABILIDAD CHORRO':
      act({ type: 'JET_MAINT', fn: 'ESTABILIDAD' })
      break
    case 'INTRO.DISOLVENTE':
      act({ type: 'JET_MAINT', fn: 'INTRO_DISOLVENTE' })
      break
    case 'DESOBTURACION BUS':
      act({ type: 'JET_MAINT', fn: 'DESOBTURACION' })
      break
    default:
  }
}

export function jetStateLabel(s) {
  if (s.power !== 'ON') return 'PARO'
  if (s.adjustMode) return 'AJUSTE CHORRO'
  switch (s.jetState) {
    case 'RUNNING':
      return 'EN MARCHA'
    case 'STARTING':
      return 'ARRANQUE'
    case 'STOPPING':
      return 'PARO EN CURSO'
    default:
      return 'PARO'
  }
}

// ------------------------------------------------------------------ edición del mensaje
function editKey(s, fw, key, act) {
  const m = edMsg(s)
  const cells = curCells(s, fw)
  // atajos Alt + letra / Ctrl + letra
  if (fw.alt) {
    fw.alt = false
    const i = MENUS.EDIT.bar.findIndex((b) => b.label[0] === key)
    if (i >= 0) {
      fw.focus = 'pull'
      fw.bar = i
      fw.pull = 0
    }
    return
  }
  if (fw.ctrl) {
    fw.ctrl = false
    if (key === 'Q') toProd(s, fw, act)
    return
  }
  switch (key) {
    case 'LEFT':
      fw.pos = Math.max(0, fw.pos - 1)
      return
    case 'RIGHT':
      fw.pos = Math.min(cells.length, fw.pos + 1)
      return
    case 'UP':
    case 'DOWN': {
      const nl = fw.line + (key === 'DOWN' ? 1 : -1)
      if (nl < 0) return
      if (nl >= m.lines.length) {
        if (m.lines.length >= 4 || cells.length === 0) return
        m.lines.push([])
      }
      fw.line = nl
      fw.pos = Math.min(fw.pos, lineCells(m.lines[nl]).length)
      return
    }
    case 'BKSP':
      if (fw.pos > 0) {
        cells.splice(fw.pos - 1, 1)
        fw.pos -= 1
        setCells(s, fw, cells)
      } else if (cells.length === 0 && fw.line > 0) {
        m.lines.splice(fw.line, 1)
        fw.line -= 1
        fw.pos = lineCells(m.lines[fw.line]).length
      }
      return
    case 'NDOT':
      if (!fw.num || fw.shift) {
        fw.shift = false
        if (fw.pos < cells.length) {
          cells.splice(fw.pos, 1)
          setCells(s, fw, cells)
        }
        return
      }
      break
    case 'N0':
      if (!fw.num || fw.shift) {
        fw.shift = false
        fw.ins = !fw.ins
        return
      }
      break
    case 'N7':
      if (!fw.num || fw.shift) {
        fw.shift = false
        fw.pos = 0
        return
      }
      break
    case 'N1':
      if (!fw.num || fw.shift) {
        fw.shift = false
        fw.pos = cells.length
        return
      }
      break
    case 'ESC':
      fw.focus = 'bar'
      return
    case 'F1':
      return openList(s, fw, 'open', act)
    case 'F2':
      return openList(s, fw, 'font', act)
    case 'F3': {
      const c = cells[fw.pos]
      if (!c?.f) return
      const map = { date: 'varDate', clock: 'varClock', expiry: 'varExpiry', external: 'varExternal', opvar: 'varUser', barcode: 'bcCompose' }
      if (map[c.f.type]) {
        cells.splice(fw.pos, 1)
        setCells(s, fw, cells)
        openForm(s, fw, map[c.f.type], act, { slot: c.f.slot })
      }
      return
    }
    case 'F4': {
      const c = cells[fw.pos]
      if (!c?.f) return
      const map = { counter: 'cntParams', expiry: 'expParams', shift: 'shiftParams', barcode: 'bcParams' }
      if (map[c.f.type]) openForm(s, fw, map[c.f.type], act, { slot: c.f.slot })
      return
    }
    case 'F5':
      return openForm(s, fw, 'msgParams', act, { ctx: 'edit' })
    case 'F6':
      return openList(s, fw, 'user', act)
    case 'F7':
      act({ type: 'EDIT_LOAD_PRINTER' })
      return
    case 'F8':
      return leaveEdit(s, fw, act)
    default:
      break
  }
  const ch = charFor(fw, key)
  fw.shift = false
  if (ch != null) insertCell(s, fw, { c: ch, font: fw.font, bold: cells[fw.pos - 1]?.bold || 1 }, act)
}

// ------------------------------------------------------------------ tecla
export function press(s, key, act) {
  const fw = fwOf(s)
  if (key === 'ENTERK') key = 'ENTER'
  // modificadores (en pantalla táctil funcionan como «pegajosos»: se aplican a la siguiente tecla)
  if (key === 'SHIFT' || key === 'SHIFTR') {
    fw.shift = !fw.shift
    return
  }
  if (key === 'CAPS') {
    fw.caps = !fw.caps
    return
  }
  if (key === 'NUMLOCK') {
    fw.num = !fw.num
    return
  }
  if (key === 'ALT' || key === 'ALTR') {
    fw.alt = !fw.alt
    return
  }
  if (key === 'CTRL' || key === 'CTRLR') {
    fw.ctrl = !fw.ctrl
    return
  }
  if (key === 'NENTER') key = 'ENTER'

  // Marcha / paro
  if (key === 'ONOFF') {
    if (s.power === 'OFF') {
      act({ type: 'POWER_ON' })
      toProd(s, fw, act)
    } else if (s.power === 'ON') askStop(fw)
    return
  }
  if (s.power !== 'ON') {
    act({ type: 'TOAST', text: s.power === 'OFF' ? 'Impresora apagada: presione ON/OFF (tecla naranja)' : s.power === 'BOOT' ? 'Arrancando… espere unos segundos' : 'Parando… espere', kind: 'warn' })
    return
  }

  // Ctrl + flechas = contraste; Ctrl + P = impresión manual
  if (fw.ctrl && (key === 'P')) {
    fw.ctrl = false
    act({ type: 'MANUAL_PRINT' })
    return
  }

  if (fw.confirm) {
    const c = fw.confirm
    if (key === 'LEFT') c.sel = 0
    else if (key === 'RIGHT') c.sel = 1
    else if (key === 'ESC') fw.confirm = null
    else if (key === 'ENTER') {
      fw.confirm = null
      const what = c.sel === 1 ? c.yes : c.no
      if (what === 'STOP') act({ type: 'POWER_OFF' })
      else if (what === 'PAUSE') act({ type: 'PAUSE_TOGGLE' })
      else if (what === 'SAVE_EXIT') {
        act({ type: s.editing?.original === s.activeMessage ? 'EDIT_LOAD_PRINTER' : 'EDIT_SAVE' })
        toProd(s, fw, act)
      } else if (what === 'EXIT') toProd(s, fw, act)
      else if (what === 'DELETE') {
        const name = edMsg(s)?.name
        act({ type: 'EDIT_CLOSE' })
        if (name) act({ type: 'MSG_DELETE', name })
        toProd(s, fw, act)
      }
    }
    return
  }
  if (fw.info) {
    if (key === 'ENTER' || key === 'ESC') fw.info = null
    return
  }
  if (fw.defects) {
    if (key === 'INFO' || key === 'ENTER') {
      act({ type: 'FAULT_ACK' })
      if (!Object.keys(s.faults).length) fw.defects = null
    } else if (key === 'UP') fw.defects.cur = Math.max(0, fw.defects.cur - 1)
    else if (key === 'DOWN') fw.defects.cur = Math.min(Math.max(0, Object.keys(s.faults).length - 1), fw.defects.cur + 1)
    else if (key === 'ESC') fw.defects = null
    return
  }
  if (fw.dlg) {
    if (fw.dlg.form) return formKey(s, fw, key, act)
    return listKey(s, fw, key, act)
  }
  if (fw.status) return statusKey(s, fw, key, act)

  if (key === 'INFO') return openDefects(s, fw, act)
  if (key === 'WRENCH') return openStatus(s, fw, act)

  // menú desplegable abierto
  if (fw.focus === 'pull') {
    const items = MENUS[fw.mode].bar[fw.bar].items
    if (key === 'UP') fw.pull = (fw.pull - 1 + items.length) % items.length
    else if (key === 'DOWN') fw.pull = (fw.pull + 1) % items.length
    else if (key === 'LEFT' || key === 'RIGHT') {
      const nb = MENUS[fw.mode].bar.length
      fw.bar = (fw.bar + (key === 'RIGHT' ? 1 : -1) + nb) % nb
      fw.pull = 0
    } else if (key === 'ESC') fw.focus = 'bar'
    else if (key === 'ENTER') menuAction(s, fw, fw.mode, fw.bar, fw.pull, act)
    return
  }

  if (fw.mode === 'EDIT' && fw.focus === 'main') return editKey(s, fw, key, act)

  // barra de menús (Producción, Preparación, Logos, o Edición con ESC)
  if (fw.alt) {
    fw.alt = false
    const i = MENUS[fw.mode].bar.findIndex((b) => b.label[0] === key)
    if (i >= 0) {
      fw.focus = 'pull'
      fw.bar = i
      fw.pull = 0
    }
    return
  }
  const nb = MENUS[fw.mode].bar.length
  switch (key) {
    case 'LEFT':
    case 'RIGHT':
      fw.bar = (fw.bar + (key === 'RIGHT' ? 1 : -1) + nb) % nb
      return
    case 'DOWN':
    case 'ENTER':
      fw.focus = 'pull'
      fw.pull = 0
      return
    case 'ESC':
      if (fw.mode === 'EDIT') fw.focus = 'main'
      else if (fw.others) fw.others = false
      return
    default:
      break
  }
  // teclas de función según la barra de iconos
  if (fw.mode === 'PROD' && !fw.others) {
    switch (key) {
      case 'F1':
        return openList(s, fw, 'select', act)
      case 'F2':
        return openForm(s, fw, 'newmsg', act)
      case 'F3':
        if (s.editing) act({ type: 'EDIT_CLOSE' })
        act({ type: 'EDIT_OPEN', name: s.activeMessage })
        return enterEdit(s, fw, act)
      case 'F4':
        return openForm(s, fw, 'msgParams', act, { ctx: 'prod' })
      case 'F5':
        return openForm(s, fw, 'counters', act)
      case 'F6':
        return openList(s, fw, 'user', act)
      case 'F7':
        fw.confirm = { lines: [s.paused ? '¿Reanudar la impresión?' : '¿Detener la impresión en curso?'], sel: 1, yes: 'PAUSE' }
        return
      case 'F8':
        fw.others = true
        return
      default:
        return
    }
  }
  if (fw.mode === 'PROD' && fw.others) {
    if (key === 'F1') {
      fw.mode = 'PREP'
      fw.others = false
      fw.bar = 0
      fw.focus = 'bar'
      act({ type: 'NAV', view: 'prep' })
    } else if (key === 'F2') {
      fw.mode = 'LOGO'
      fw.others = false
      fw.bar = 0
      fw.focus = 'bar'
    } else if (key === 'F8') fw.others = false
    return
  }
  if (fw.mode === 'EDIT') {
    if (key === 'F1' || key === 'F2' || key === 'F3' || key === 'F4') {
      fw.bar = +key[1] - 1
      fw.focus = 'pull'
      fw.pull = 0
    } else if (key === 'F7') act({ type: 'EDIT_LOAD_PRINTER' })
    else if (key === 'F8') leaveEdit(s, fw, act)
    return
  }
  if ((fw.mode === 'PREP' || fw.mode === 'LOGO') && key === 'F8') toProd(s, fw, act)
}

// ------------------------------------------------------------------ modelo de pantalla
export function iconsFor(s, fw) {
  if (fw.mode === 'PROD' && fw.others) return ['gears', 'logo', null, null, null, null, null, 'house']
  if (fw.mode === 'PROD') {
    const m = active(s)
    const hasUser = m?.lines.flat().some((f) => f.type === 'opvar')
    return ['select', 'new', 'modify', 'params', 'counter', hasUser ? 'user' : null, s.paused ? 'play' : 'pause', 'others']
  }
  if (fw.mode === 'EDIT') {
    if (fw.focus !== 'main') return ['wmsg', 'wfont', 'wvar', 'wparam', null, null, 'load', 'house']
    const cells = s.editing ? curCells(s, fw) : []
    const v = cells[fw.pos]?.f
    return ['open', 'font', v ? 'varpen' : null, v && ['counter', 'expiry', 'shift', 'barcode'].includes(v.type) ? 'vargear' : null, 'params', 'user', 'load', 'house']
  }
  return [null, null, null, null, null, null, null, 'house']
}

export function view(s) {
  const fw = fwOf(s)
  return { fw, power: s.power, icons: iconsFor(s, fw) }
}

export function leds(s) {
  const fw = fwOf(s)
  const codes = Object.keys(s.faults)
  const blocking = codes.some((c) => FAULTS[c]?.severity === 'DEFECTO')
  const jetOn = s.jetState === 'RUNNING'
  return {
    power: true,
    head1: s.power === 'ON' && (jetOn || s.jetState === 'STARTING'),
    head1Blink: blocking || s.jetState === 'STARTING' || s.adjustMode,
    head2: false,
    alarm: codes.length > 0,
    ink: Boolean(s.faults.INK_LOW),
    additive: false,
    num: fw.num,
  }
}

// ------------------------------------------------------------------ ayudas del tutor
export function input(s) {
  const fw = fwOf(s)
  const d = fw.dlg
  if (d?.form) {
    if (d.edit) return d.buf
    const f = FORMS[d.form].fields[d.cur]
    if (f && (f.type === 'num' || f.type === 'text')) return ''
    return null
  }
  if (d?.list === 'user' && d.edit) return d.buf
  if (d?.list === 'select' || d?.list === 'open') return d.typed || ''
  if (fw.mode === 'EDIT' && fw.focus === 'main' && s.editing) return curCells(s, fw).map((c) => cellLabel(c, s)).join('')
  return null
}

export function typingKey(s, target) {
  const fw = fwOf(s)
  const cur = input(s) ?? ''
  if (cur === target) return null
  const d = fw.dlg
  let i = 0
  while (i < cur.length && i < target.length && cur[i] === target[i]) i++
  if (i < cur.length) {
    // sobra texto
    if (fw.mode === 'EDIT' && !d && fw.pos !== i + (cur.length - i)) return fw.pos < cur.length ? 'RIGHT' : 'BKSP'
    return 'BKSP'
  }
  if (fw.mode === 'EDIT' && !d && fw.pos < cur.length) return 'RIGHT'
  const k = keyForChar(target[i])
  if (!k) return null
  if (k.upper === true && !fw.caps && !fw.shift) return 'CAPS'
  if (k.upper === false && fw.caps && !fw.shift) return 'CAPS'
  if (k.shift && !fw.shift) return 'SHIFT'
  return k.key
}

// Navegación guiada hacia una pantalla: { mode, bar, item } (menú) | { key } (tecla de función) | { status } | { defects }
const TARGETS = {
  select: { mode: 'PROD', key: 'F1', dlgList: 'select' },
  newmsg: { mode: 'PROD', key: 'F2', dlgForm: 'newmsg' },
  text: { mode: 'EDIT' },
  prodParams: { mode: 'PROD', key: 'F4', dlgForm: 'msgParams' },
  msgParams: { mode: 'EDIT', bar: 3, item: 0, dlgForm: 'msgParams' },
  counters: { mode: 'PROD', key: 'F5', dlgForm: 'counters' },
  userFields: { mode: 'PROD', key: 'F6', dlgList: 'user' },
  status: { mode: 'PROD', status: true },
  faults: { mode: 'PROD', defects: true },
  clock: { mode: 'PREP', bar: 0, item: 2, dlgForm: 'clock' },
  head: { mode: 'PREP', bar: 0, item: 3, dlgForm: 'orient' },
  v24: { mode: 'PREP', bar: 0, item: 4, dlgForm: 'v24' },
  faultInhibit: { mode: 'PROD', bar: 3, item: 0, dlgForm: 'faultInhibit' },
  startup: { mode: 'PROD', bar: 0, item: 4, dlgForm: 'startMode' },
  counterParams: { mode: 'EDIT', bar: 3, item: 1, dlgForm: 'cntParams' },
  postdate: { mode: 'EDIT', bar: 3, item: 3, dlgForm: 'expParams' },
  shift: { mode: 'EDIT', bar: 3, item: 5, dlgForm: 'shiftParams' },
  bcParams: { mode: 'EDIT', bar: 3, item: 6, dlgForm: 'bcParams' },
  varDate: { mode: 'EDIT', bar: 2, item: 3, dlgForm: 'varDate' },
  varClock: { mode: 'EDIT', bar: 2, item: 2, dlgForm: 'varClock' },
  varExpiry: { mode: 'EDIT', bar: 2, item: 4, dlgForm: 'varExpiry' },
  varUser: { mode: 'EDIT', bar: 2, item: 9, dlgForm: 'varUser' },
  varCounter: { mode: 'EDIT', bar: 2, item: 0 },
  varShift: { mode: 'EDIT', bar: 2, item: 7 },
  bcCompose: { mode: 'EDIT', bar: 1, item: 4, dlgForm: 'bcCompose' },
  saveas: { mode: 'EDIT', bar: 0, item: 3, dlgForm: 'saveas' },
  prod: { mode: 'PROD' },
}
export const targetDef = (name) => TARGETS[name]

export function atTarget(s, name) {
  const fw = fwOf(s)
  const T = TARGETS[name]
  if (!T) return false
  if (T.status) return Boolean(fw.status)
  if (T.defects) return Boolean(fw.defects)
  if (T.dlgForm) return fw.dlg?.form === T.dlgForm
  if (T.dlgList) return fw.dlg?.list === T.dlgList
  if (T.bar != null) return false // opción de menú que actúa directamente (insertar variable)
  if (name === 'text') return fw.mode === 'EDIT' && fw.focus === 'main' && !fw.dlg
  if (name === 'prod') return fw.mode === 'PROD' && !fw.dlg && !fw.status && !fw.defects && !fw.others && fw.focus === 'bar'
  return fw.mode === T.mode && !fw.dlg
}

export function navKey(s, name) {
  const fw = fwOf(s)
  const T = TARGETS[name]
  if (!T) return null
  if (s.power === 'OFF') return 'ONOFF'
  if (atTarget(s, name)) return null
  if (fw.confirm) return 'ESC'
  if (fw.info) return 'ENTER'
  if (fw.defects && !T.defects) return 'ESC'
  if (fw.status && !T.status) return 'ESC'
  if (fw.dlg) return 'ESC'
  if (fw.alt) return 'ALT'
  if (fw.ctrl) return 'CTRL'
  if (T.mode !== fw.mode) {
    if (fw.mode === 'EDIT') return fw.focus === 'pull' ? 'ESC' : 'F8'
    if (fw.mode === 'PREP' || fw.mode === 'LOGO') return fw.focus === 'pull' ? 'ESC' : 'F8'
    if (T.mode === 'PREP') return fw.others ? 'F1' : fw.focus === 'pull' ? 'ESC' : 'F8'
    if (T.mode === 'EDIT') return fw.others ? 'F8' : fw.focus === 'pull' ? 'ESC' : 'F3'
    return 'ESC'
  }
  if (fw.others) return 'F8'
  if (T.status) return fw.focus === 'pull' ? 'ESC' : 'WRENCH'
  if (T.defects) return fw.focus === 'pull' ? 'ESC' : 'INFO'
  if (T.key) return fw.focus === 'pull' ? 'ESC' : T.key
  if (T.bar != null) {
    if (fw.focus === 'main') return 'ESC'
    if (fw.focus === 'bar') return fw.bar === T.bar ? 'DOWN' : fw.bar < T.bar ? 'RIGHT' : 'LEFT'
    if (fw.focus === 'pull') {
      if (fw.bar !== T.bar) return fw.bar < T.bar ? 'RIGHT' : 'LEFT'
      if (fw.pull !== T.item) return fw.pull < T.item ? 'DOWN' : 'UP'
      return 'ENTER'
    }
  }
  if (name === 'text') return fw.focus === 'pull' ? 'ESC' : 'ESC'
  return null
}

export function fromKeyboard(e) {
  const k = e.key
  const map = {
    ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN', Enter: 'ENTER', Escape: 'ESC', Tab: 'TAB', Backspace: 'BKSP', ' ': 'SPACE',
    F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6', F7: 'F7', F8: 'F8', Delete: 'NDOT',
    '-': 'MINUS', '=': 'EQUAL', '[': 'LBR', ']': 'RBR', ';': 'SEMI', "'": 'QUOTE', ',': 'COMMA', '.': 'PERIOD', '/': 'SLASH', '`': 'GRAVE',
  }
  if (map[k]) return map[k]
  if (/^[a-zA-Z]$/.test(k)) return k.toUpperCase()
  if (/^[0-9]$/.test(k)) return `D${k}`
  return null
}

export function screenId(s) {
  const fw = fwOf(s)
  if (fw.dlg) return fw.dlg.form || fw.dlg.list
  if (fw.status) return 'status'
  if (fw.defects) return 'defects'
  return `${fw.mode}:${fw.focus}`
}
