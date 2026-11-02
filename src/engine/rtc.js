// Reloj de tiempo real (RTC) de la impresora.
// La hora del equipo = hora del sistema + OFFSET. Al ajustar la hora manualmente
// sólo se recalcula el offset, por lo que el reloj sigue avanzando de forma
// continua a partir del nuevo valor de referencia.

export function rtcNow(offsetMs, systemNow = Date.now()) {
  return new Date(systemNow + offsetMs)
}

// Calcula el offset necesario para que el RTC muestre `target` en este instante.
export function offsetFor(target, systemNow = Date.now()) {
  return target.getTime() - systemNow
}

export const pad = (n, w = 2) => String(n).padStart(w, '0')

// «Hora cambio fecha» (hh:mm) en minutos: antes de esa hora las fechas siguen con el día anterior.
export function dateChangeMin(hhmm) {
  const m = /^(\d\d):(\d\d)$/.exec(hhmm || '')
  return m ? +m[1] * 60 + +m[2] : 0
}

export const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.floor((stripTime(d) - start) / 86400000) + 1
}

// Semana ISO-8601
export function weekOfYear(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t - y0) / 86400000 + 1) / 7)
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d, days) {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

export function addMonths(d, months) {
  const r = new Date(d)
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + months)
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, last))
  return r
}

// Formatos de fecha: tokens tipo Imaje
//  DD día del mes · JJJ día del año · WW semana · MM mes · MMM mes en letras
//  YYYY año · YY año 2 cifras · Y última cifra · D día de la semana (1=domingo)
export const DATE_FORMATS = ['DD/MM/YY', 'DD/MM/YYYY', 'DD-MMM-YY', 'MM/YY', 'YYMMDD', 'JJJY', 'YYJJJ', 'WW/YY', 'DD.MM.YYYY']

export function formatDate(d, fmt) {
  const tokens = {
    YYYY: String(d.getFullYear()),
    YY: pad(d.getFullYear() % 100),
    MMM: MONTHS_ES[d.getMonth()],
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    JJJ: pad(dayOfYear(d), 3),
    WW: pad(weekOfYear(d)),
    Y: String(d.getFullYear() % 10),
    D: String(d.getDay() + 1),
  }
  return fmt.replace(/YYYY|YY|MMM|MM|DD|JJJ|WW|Y|D/g, (t) => tokens[t])
}

export const CLOCK_FORMATS = ['HH:MM', 'HH:MM:SS', 'HHMM', 'HH']

export function formatClock(d, fmt) {
  const tokens = { HH: pad(d.getHours()), MM: pad(d.getMinutes()), SS: pad(d.getSeconds()) }
  return fmt.replace(/HH|MM|SS/g, (t) => tokens[t])
}

// Turno de trabajo según manual: hora de inicio + intervalo, códigos de una tabla.
// Devuelve el índice de turno (0..n-1) para la hora dada.
export function shiftIndex(d, shift) {
  const [sh, sm] = shift.start.split(':').map(Number)
  const [ih, im] = shift.interval.split(':').map(Number)
  const intervalMin = ih * 60 + im
  if (intervalMin <= 0) return 0
  const nowMin = d.getHours() * 60 + d.getMinutes()
  const startMin = sh * 60 + sm
  const elapsed = (nowMin - startMin + 1440) % 1440
  const count = Math.max(1, Math.ceil(1440 / intervalMin))
  return Math.floor(elapsed / intervalMin) % count
}

export function shiftCode(d, shift) {
  const idx = shiftIndex(d, shift)
  const codes = shift.codes || []
  if (codes[idx]) return codes[idx]
  if (shift.type === 'LETRAS') return String.fromCharCode(65 + (idx % 26))
  return pad(idx + 1)
}
