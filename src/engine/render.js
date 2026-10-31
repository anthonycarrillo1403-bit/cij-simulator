// Composición de mensajes: campos -> texto -> matriz de puntos (tramas).
import { rasterizeText, FONTS } from './font5x7.js'
import { code128Modules, dataMatrix } from './barcodes.js'
import { addDays, addMonths, formatDate, formatClock, shiftCode, pad } from './rtc.js'

export const FIELD_LABELS = {
  text: 'Texto',
  date: 'Fecha',
  clock: 'Reloj',
  expiry: 'Caducidad',
  shift: 'Turno',
  counter: 'Contador',
  opvar: 'Var. operador',
  external: 'Externa V24',
  barcode: 'Código barras',
}

export function expiryDate(now, exp) {
  if (!exp) return now
  return exp.unit === 'MESES' ? addMonths(now, exp.amount) : addDays(now, exp.amount)
}

export function counterText(counter) {
  const digits = String(Math.max(Math.abs(counter.start), Math.abs(counter.end))).length
  const v = String(counter.value)
  return counter.leadingZeros ? pad(counter.value, digits) : v.padStart(digits, ' ')
}

function externalText(field, ctx) {
  const data = (ctx.v24?.data || '').slice(0, field.len)
  return data.padEnd(field.len, field.symbol || '?')
}

function opvarText(name, ctx) {
  const v = (ctx.opvars || []).find((o) => o.name === name)
  if (!v) return `<${name}?>`
  return (v.value === '' ? v.def : v.value).slice(0, v.size)
}

// Texto "humano" de un campo con los datos actuales (RTC, contadores, V24…).
export function fieldText(field, ctx) {
  const m = ctx.message
  switch (field.type) {
    case 'text':
      return field.value
    case 'date':
      return formatDate(ctx.now, field.format)
    case 'clock':
      return formatClock(ctx.now, field.format)
    case 'expiry':
      return formatDate(expiryDate(ctx.now, field.slot === 2 ? m.expiry2 : m.expiry), field.format)
    case 'shift':
      return shiftCode(ctx.now, m.shift)
    case 'counter':
      return counterText(m.counter)
    case 'opvar':
      return opvarText(field.name, ctx)
    case 'external':
      return externalText(field, ctx)
    case 'barcode':
      return barcodeData(field, ctx)
    default:
      return ''
  }
}

export function barcodeData(field, ctx) {
  switch (field.source) {
    case 'external':
      return (ctx.v24?.data || '').trim() || '0000'
    case 'opvar':
      return opvarText(field.name, ctx)
    case 'counter':
      return counterText(ctx.message.counter).trim()
    case 'date':
      return formatDate(ctx.now, 'YYMMDD')
    default:
      return field.value || '0'
  }
}

// Rasteriza un campo: devuelve { cols, h } con columnas booleanas (índice 0 = abajo).
export function rasterField(field, ctx) {
  if (field.type === 'barcode') {
    const data = barcodeData(field, ctx)
    try {
      if (field.symbology === 'DATAMATRIX') {
        const { size, matrix } = dataMatrix(data)
        const cols = []
        for (let c = 0; c < size; c++) {
          const col = []
          for (let r = size - 1; r >= 0; r--) col.push(matrix[r][c])
          cols.push(col)
        }
        cols.push(new Array(size).fill(false))
        return { cols, h: size }
      }
      const h = field.height || 14
      const mods = code128Modules(data)
      const cols = mods.map((on) => new Array(h).fill(on))
      cols.push(new Array(h).fill(false))
      return { cols, h }
    } catch {
      return rasterizeText('ERR', '7x5', 1)
    }
  }
  return rasterizeText(fieldText(field, ctx), field.font || '7x5', field.bold || 1)
}

// Rasteriza el mensaje completo. Las líneas se apilan de arriba abajo.
// Devuelve { width, height, cols } — cols[x][y] con y=0 en la base.
export function rasterMessage(message, ctx) {
  const c = { ...ctx, message }
  const lines = message.lines
    .map((fields) => {
      const parts = fields.map((f) => rasterField(f, c))
      const h = parts.reduce((a, p) => Math.max(a, p.h), 0)
      const cols = []
      for (const p of parts) for (const col of p.cols) {
        const full = new Array(h).fill(false)
        for (let y = 0; y < p.h; y++) full[y] = col[y]
        cols.push(full)
      }
      return { cols, h }
    })
    .filter((l) => l.h > 0)
  const gap = 1
  const height = lines.reduce((a, l) => a + l.h, 0) + Math.max(0, lines.length - 1) * gap
  const width = lines.reduce((a, l) => Math.max(a, l.cols.length), 0)
  const cols = []
  for (let x = 0; x < width; x++) cols.push(new Array(height).fill(false))
  // primera línea arriba => mayor y
  let yTop = height
  for (const l of lines) {
    const yBase = yTop - l.h
    l.cols.forEach((col, x) => {
      for (let y = 0; y < l.h; y++) cols[x][yBase + y] = col[y]
    })
    yTop = yBase - gap
  }
  return { width, height, cols, lineCount: lines.length }
}

export function messageHasField(message, pred) {
  return message.lines.some((l) => l.some(pred))
}

export function messageFields(message) {
  return message.lines.flat()
}

export { FONTS }

// Altura máxima imprimible por chorro según el cabezal (puntos)
export const MAX_DOTS_PER_JET = 32
