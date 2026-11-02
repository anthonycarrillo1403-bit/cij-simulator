// Módulo «Codificación» del 9040 (Equipo A monochorro y Equipo B bichorro):
// apariencia del código, código completo de producto, cambio de código (orden nueva),
// fecha pasada que sigue corriendo, lote juliano + turno y fecha que cambia a las 06:00.
import { prep } from '../../engine/scenario.js'
import { makeMessage, T, F } from '../../engine/defaults.js'
import { messageHasField, rasterMessage, printCtx, centeredDelay } from '../../engine/render.js'
import { printGeometry } from '../../engine/sim.js'
import { rtcNow, pad, dayOfYear, addDays } from '../../engine/rtc.js'
import * as M9 from './firmware.js'
import { m9, m9Nav, m9Choose, m9Type, m9Fill } from '../guide.js'

const info = (say, o = {}) => ({ say, next: true, ...o })
const fw = (s) => m9(s)
const ed = (s) => s.editing?.message
const act = (s) => s.messages[s.activeMessage]
const has = (m, pred) => Boolean(m && messageHasField(m, pred))
const ev = (ctx, type, pred = () => true) => ctx.ev.some((e) => e.type === type && pred(e))
const at = (name) => (s) => M9.atTarget(s, name)
const dlgV = (s, k) => fw(s).dlg?.v?.[k]
const inEdit = (s) => fw(s).mode === 'EDIT'
const loadKey = (s) => (fw(s).dlg ? 'ESC' : fw(s).focus === 'pull' ? 'ESC' : 'F7')
const editProd = (s) => (inEdit(s) ? null : M9.navKey(s, 'text'))
const lastPrint = (s) => s.prints[0]

// Desmarcar una casilla de un diálogo
function m9Uncheck(target, k) {
  return (s) => {
    const d = fw(s).dlg
    if (!M9.atTarget(s, target)) return M9.navKey(s, target)
    if (!d.v[k]) return null
    const i = M9.FORMS[d.form].fields.findIndex((f) => f.k === k)
    if (d.cur !== i) return d.cur < i ? 'DOWN' : 'UP'
    return 'TAB'
  }
}

// Escribir `str` al final de la línea en edición (sin tocar lo que ya hay delante)
function tail(str) {
  return (s) => {
    const cur = M9.input(s) ?? ''
    if (cur.endsWith(str)) return null
    for (let k = Math.min(str.length - 1, cur.length); k >= 0; k--) {
      if (!cur.endsWith(str.slice(0, k))) continue
      // siguiente carácter (las variables ocupan una sola celda: no se usa typingKey)
      const kk = M9.keyForChar(str[k])
      if (!kk) return null
      const f = fw(s)
      if (kk.upper === true && !f.caps && !f.shift) return 'CAPS'
      if (kk.upper === false && f.caps && !f.shift) return 'CAPS'
      if (kk.shift && !f.shift) return 'SHIFT'
      return kk.key
    }
    return null
  }
}

// Texto fijo (sin variables) de la línea `i` del mensaje en edición
const lineText = (s, i) => (ed(s)?.lines[i] || []).filter((f) => f.type === 'text').map((f) => f.value).join('')

// Retardo ida para centrar el mensaje en producción (con la velocidad actual)
function idealDelay(s) {
  const m = act(s)
  if (!m) return 50
  const r = rasterMessage(m, printCtx(s, rtcNow(s.rtcOffset)))
  return centeredDelay({ w: r.width, h: r.height, wf: printGeometry(s).wf, hf: 1 })
}

// Campo de usuario LOTE: abrir F6, escribir el valor y validar
function setLote(value) {
  return (s) => {
    const d = fw(s).dlg
    if (d?.list !== 'user') return m9Nav('userFields')(s)
    if (!d.edit) return d.items[d.cur] === 'LOTE' ? 'TAB' : 'DOWN'
    if (d.buf === value) return 'ENTER'
    return M9.typingKey(s, value)
  }
}
const loteIs = (v) => (s) => s.opvars.find((o) => o.name === 'LOTE')?.value === v

// Reanudar / pausar la impresión con F7
const pauseKey = (want) => (s) => {
  if (s.paused === want) return null
  if (fw(s).confirm) return 'ENTER'
  return M9.atTarget(s, 'prod') ? 'F7' : m9Nav('prod')(s)
}

// Fecha pasada de ejemplo: hace 17 días a las 08:00
function pastDate() {
  const d = addDays(rtcNow(0), -17)
  const dd = pad(d.getDate())
  const mm = pad(d.getMonth() + 1)
  const yy = pad(d.getFullYear() % 100)
  return { d: d.getDate(), mo: d.getMonth() + 1, dd, mm, yy, typed: `${dd}${mm}${yy}`, shown: `${dd}/${mm}/${yy}` }
}

function msgPRD4521(s) {
  s.messages.PRD4521 = makeMessage(
    'PRD4521',
    [
      [T('PRD-4521 L'), F('opvar', { name: 'LOTE' })],
      [T('FAB '), F('date', { format: 'DD/MM/YY' }), T(' VEN '), F('expiry', { slot: 1, format: 'DD/MM/YY' })],
    ],
    { expiry: { amount: 365, unit: 'DIAS' } },
  )
}
function ensureLote(s, value) {
  const v = s.opvars.find((o) => o.name === 'LOTE')
  if (v) Object.assign(v, { size: 5, def: 'A0001', value })
  else s.opvars.push({ name: 'LOTE', size: 5, def: 'A0001', value })
}

export function codifLessons9040(jets) {
  const twin = jets === 2
  return [
    // ------------------------------------------------------------ 1. apariencia
    {
      id: 'c_apariencia',
      group: 'codif',
      title: 'Apariencia del código: tamaño, espejo, invertido y centrado',
      goal: 'Corregir un código mal impreso en el producto',
      summary: 'Espejo → Sentido impresion · Cabeza abajo → Impresion inversa · Estirado/apretado → Velocidad de impresion (o Division taco) · Alto → Fuente · Grosor → Dilatación · A lo largo → Retardo ida · Altura → soporte del cabezal.',
      setup: (s) => {
        prep(s)
        s.messages.CODIGO = makeMessage('CODIGO', [[T('PRD-4521 L2611A', { font: '5x5' })]])
        Object.assign(s.messages.CODIGO.params, { sense: 'INVERSO', inv: true, delayFwd: 4, printSpeed: 250, trigger: 'OBJETO' })
        s.activeMessage = 'CODIGO'
        s.line.headY = 9
      },
      steps: [
        info('Qué controla cada cosa del aspecto del código en el 9040:\n• **Sale en espejo (al revés)** → «Sentido impresion» F.D.→ / F.D.← ([F4]).\n• **Sale cabeza abajo (invertido)** → «Impresion inversa» ([F4]).\n• **Estirado o apretado a lo largo** → «Velocidad de impresion» (debe igualar la de la línea) o «Division taco» si hay encoder.\n• **Muy pequeño o muy grande en altura** → la **Fuente** (5, 7, 9, 11, 16 o 24 gotas de alto).\n• **Muy fino o muy grueso** → **Dilatación** (1-9).\n• **Descentrado a lo largo** → «Retardo ida» (mm desde la fotocélula).\n• **Descentrado en altura** → se mueve el **soporte del cabezal** (no es un ajuste de pantalla).'),
        { say: 'Abre **▤ Línea** y mira el producto: la cinta pasa productos solos.', drawer: 'product', done: (s) => lastPrint(s)?.msg === 'CODIGO' },
        info('El código tiene **todos** los defectos: en espejo, cabeza abajo, estirado, muy pequeño, pegado al inicio del producto y muy arriba. Lo arreglaremos uno por uno, como en planta.'),
        { say: 'Presiona [F4]: parámetros del mensaje en producción.', key: m9Nav('prodParams'), done: at('prodParams') },
        { say: '«Sentido impresion» está en **F.D. ←** (el código sale en espejo). F.D.→ es para producto que avanza de izquierda a derecha visto de frente al cabezal. Presiona [TAB], elige **F.D. →** y [TAB]. (Si en tu línea el producto va al revés, se usa F.D.←).', key: m9Choose('prodParams', 'sense', 'DIRECTO'), done: (s) => dlgV(s, 'sense') === 'DIRECTO' && fw(s).dlg?.listOpen == null },
        { say: '«Impresion inversa» está marcada (código cabeza abajo; solo se usa si el cabezal está montado al revés). Ve a esa casilla y desmárcala con [TAB].', key: m9Uncheck('prodParams', 'inv'), done: (s) => dlgV(s, 'inv') === false },
        { say: '«Velocidad de impresion» está en 250 mm/s, pero la línea va a 30 m/min = **500 mm/s**: por eso sale **estirado** (si fuera mayor, saldría apretado). Ve al campo, [TAB], escribe **500** y [DOWN].', key: m9Type('prodParams', 'printSpeed', '500'), done: (s) => dlgV(s, 'printSpeed') === 500 },
        { say: 'Presiona [ENTER] para validar el cuadro.', key: 'ENTER', done: (s) => !fw(s).dlg && act(s).params.sense === 'DIRECTO' && !act(s).params.inv && act(s).params.printSpeed === 500 },
        { say: 'Mira **▤ Línea**: ya se lee derecho y sin estirar. Sigue pequeño, pegado al inicio y alto.', drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => e.msg === 'CODIGO' && !e.flipX && !e.flipY) },
        { say: 'El tamaño de letra está en el mensaje: presiona [F3] para modificarlo.', key: editProd, done: inEdit },
        { say: 'Con el cursor en la línea presiona [F2]: lista de **fuentes**.', key: (s) => (fw(s).dlg ? null : fw(s).focus !== 'main' ? 'ESC' : 'F2'), done: (s) => fw(s).dlg?.list === 'font' },
        { say: `El número de la fuente es la **altura en gotas**: SIN05… = 5, SIN07… = 7, SIN09… = 9, SIN11… = 11, SIN16… = 16, SIN24… = 24. Más gotas = código más alto${twin ? ' (en bichorro, con 2 líneas cada chorro imprime una)' : ''}. Baja a **SIN11088** y presiona [ENTER].`, key: (s) => { const d = fw(s).dlg; if (d?.list !== 'font') return null; const i = d.items.indexOf('SIN11088'); return d.cur === i ? 'ENTER' : d.cur < i ? 'DOWN' : 'UP' }, done: (s) => (ed(s)?.lines[0] || []).length > 0 && ed(s).lines[0].every((f) => f.font === '11x9') },
        info('Si el código queda **muy fino o débil**, **Fuente › Dilatación** (1-9) repite cada columna: más grueso y más largo. Si queda **muy grande**, se baja la fuente (o la dilatación).'),
        { say: 'Presiona [F7] para cargar la impresora con la nueva fuente.', key: loadKey, done: (s, c) => ev(c, 'LOAD_PRINTER') && (act(s).lines[0] || []).every((f) => f.font === '11x9') },
        { say: (s) => `Ahora el **centrado a lo largo**: «Retardo ida» = mm desde que la fotocélula ve el producto hasta que empieza el código. Para centrar: (largo del producto − largo del código) ÷ 2 ≈ **${idealDelay(s)} mm**. Abre [F4], ve a «Retardo ida», [TAB], escribe **${idealDelay(s)}** y [DOWN].`, key: (s) => m9Type('prodParams', 'delayFwd', String(idealDelay(s)))(s), done: (s) => Math.abs((dlgV(s, 'delayFwd') ?? -99) - idealDelay(s)) <= 2 },
        { say: 'Presiona [ENTER] para validar.', key: 'ENTER', done: (s) => !fw(s).dlg && Math.abs(act(s).params.delayFwd - idealDelay(s)) <= 2 },
        { say: 'Falta la **altura**: el código está 9 mm por encima del centro. Eso es mecánico: se afloja el soporte y se sube/baja el cabezal. En **▤ Línea** usa **▼ Bajar** hasta **0 mm**.', drawer: 'product', done: (s) => (s.line.headY || 0) === 0 },
        { say: 'Mira el siguiente producto en **▤ Línea**: código derecho, del tamaño correcto y centrado.', drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => e.msg === 'CODIGO' && !e.flipX && !e.flipY && Math.abs(e.delay - idealDelay(s)) <= 2) && (lastPrint(s)?.headY || 0) === 0 },
        info('En planta, además: el cabezal debe quedar **perpendicular** al producto (si no, el código sale inclinado o con gotas abiertas) y a **5-15 mm** de distancia (más lejos = gotas dispersas y código borroso). Revisa siempre el primer producto después de cualquier cambio.'),
      ],
    },

    // ------------------------------------------------------------ 2. código completo
    {
      id: 'c_completo',
      group: 'codif',
      title: 'Configurar un código de producto completo',
      goal: 'Código de producto, lote, fabricación y vencimiento',
      summary: 'Fijo = texto (código de producto). Cambia por orden = campo de usuario (LOTE, F6). Automático = variables Fecha, Caducidad (+días/meses), Reloj, Turno, Contador.',
      setup: (s) => {
        prep(s)
        delete s.messages.PRD4521
        ensureLote(s, 'L0001')
      },
      steps: [
        info('Un código de planta tiene partes **fijas** y **variables**:\n• **Código de producto** (ej. PRD-4521): texto fijo, cambia solo si cambia el producto.\n• **Lote / batch**: cambia con cada orden → se pone como **campo de usuario** (LOTE) para cambiarlo con [F6] sin editar el mensaje.\n• **Fecha de fabricación**: variable **Fecha** (sale del reloj).\n• **Vencimiento**: variable **Caducidad** = fecha + días o meses.\n• Opcionales: **hora** (Reloj), **turno**, **contador**.\nVamos a crear: «PRD-4521 L(lote)» / «FAB dd/mm/aa VEN dd/mm/aa».'),
        { say: 'Presiona [F2] para crear un mensaje nuevo.', key: m9Nav('newmsg'), done: (s) => fw(s).dlg?.form === 'newmsg' },
        { say: 'Escribe el nombre **PRD4521** (usa el código del producto, máx. 8 caracteres).', type: 'PRD4521', done: (s) => fw(s).dlg?.buf === 'PRD4521' },
        { say: 'Presiona [ENTER].', key: 'ENTER', done: (s) => inEdit(s) && ed(s)?.name === 'PRD4521' },
        { say: 'Escribe el código de producto y la L de lote: **PRD-4521 L** (el guion está a la derecha del 0).', type: 'PRD-4521 L', done: (s) => M9.input(s) === 'PRD-4521 L' },
        { say: 'Inserta el lote como campo de usuario: **Variables › Usuario** ([ESC] › Variables › baja a Usuario › [ENTER]).', key: m9Nav('varUser'), done: at('varUser') },
        { say: '«Tamano» 5 caracteres, «Elemento de identificacion» **LOTE**, «Valor por defecto» A0001. Presiona [ENTER] para insertarlo.', key: 'ENTER', done: (s) => has(ed(s), (f) => f.type === 'opvar') },
        { say: 'Presiona [DOWN] para pasar a la segunda línea.', key: 'DOWN', done: (s) => fw(s).line === 1 },
        { say: 'Escribe **FAB** y un espacio.', key: tail('FAB '), done: (s) => (M9.input(s) || '').endsWith('FAB ') },
        { say: 'Inserta la fecha: **Variables › Fecha**, en «Composicion» [TAB], escribe **DD/MM/YY** y [ENTER].', key: m9Type('varDate', 'comp', 'DD/MM/YY', 'ENTER'), done: (s) => has(ed(s), (f) => f.type === 'date') && !fw(s).dlg },
        { say: 'Escribe un espacio, **VEN** y otro espacio.', key: tail(' VEN '), done: (s) => (M9.input(s) || '').endsWith(' VEN ') },
        { say: 'La vida útil se define en **Parametros › Caducidad**: Unidad DIA, «Caducidad» [TAB] **365** y [ENTER].', key: m9Type('postdate', 'amount', '365', 'ENTER'), done: (s) => ed(s)?.expiry.amount === 365 && ed(s).expiry.unit === 'DIAS' && !fw(s).dlg },
        { say: 'Inserta el vencimiento: **Variables › Caducidad**, «Composicion» [TAB] **DD/MM/YY** y [ENTER].', key: m9Type('varExpiry', 'comp', 'DD/MM/YY', 'ENTER'), done: (s) => has(ed(s), (f) => f.type === 'expiry') && !fw(s).dlg },
        { say: 'Presiona [F7]: guarda y carga la impresora.', key: loadKey, done: (s) => s.activeMessage === 'PRD4521' && has(act(s), (f) => f.type === 'expiry') },
        { say: 'Ahora pon el lote de la orden: [F8] para volver, [F6], con LOTE resaltado [TAB], escribe **2611A** y [ENTER].', key: setLote('2611A'), done: loteIs('2611A') },
        { say: 'Cierra con [ESC] y revisa el producto en **▤ Línea**: producto, lote, fabricación y vencimiento.', key: (s) => (fw(s).dlg ? 'ESC' : null), drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => e.msg === 'PRD4521') && !fw(s).dlg },
        info('Comprueba siempre contra la orden: **código de producto, lote, fecha de fabricación, vencimiento** (cuenta: hoy + 365 días), legibilidad y posición. Si el cliente pide el mes en letras usa **MMM** (ej. 01NOV26); solo mes/año: **MM/YY**.'),
      ],
    },

    // ------------------------------------------------------------ 3. cambio de código
    {
      id: 'c_cambio',
      group: 'codif',
      title: 'Cambio de código (orden nueva)',
      goal: 'Pausar, cambiar producto, vencimiento y lote, verificar',
      summary: 'Pausa [F7] › [F3] corregir código › Parametros › Caducidad › Guardar como › [F7] cargar › [F6] lote › reanudar › verificar el primer producto.',
      setup: (s) => {
        prep(s)
        msgPRD4521(s)
        delete s.messages.PRD7788
        ensureLote(s, '2611A')
        s.activeMessage = 'PRD4521'
      },
      steps: [
        info('Llega la **orden nueva**: producto **PRD-7788**, lote **2611C**, vida útil **180 días**. Ahora se imprime PRD4521.\nOrden correcto en planta: 1) **pausar** la impresión, 2) cambiar los datos, 3) cargar, 4) **verificar el primer producto** antes de liberar.'),
        { say: 'Pausa la impresión: [F7] y confirma con [ENTER] (SÍ).', key: pauseKey(true), done: (s) => s.paused },
        { say: 'Presiona [F3] para modificar el mensaje en producción.', key: editProd, done: inEdit },
        { say: 'El cursor está al final de la primera línea. Llévalo con [LEFT] justo **detrás de 4521**.', key: (s) => (fw(s).line !== 0 ? 'UP' : fw(s).pos > 8 ? 'LEFT' : fw(s).pos < 8 ? 'RIGHT' : null), done: (s) => fw(s).line === 0 && fw(s).pos === 8 && lineText(s, 0) === 'PRD-4521 L' },
        { say: 'Borra **4521** con [BKSP] (cuatro veces).', key: (s) => (lineText(s, 0).length > 'PRD- L'.length ? 'BKSP' : null), done: (s) => lineText(s, 0) === 'PRD- L' },
        { say: 'Escribe el código nuevo **7788**.', key: (s) => { const t = lineText(s, 0); const typed = t.slice(4, t.length - 2); if (typed === '7788') return null; if (!'7788'.startsWith(typed)) return 'BKSP'; return `D${'7788'[typed.length]}` }, done: (s) => lineText(s, 0) === 'PRD-7788 L' },
        { say: 'Vida útil nueva: **Parametros › Caducidad**, «Caducidad» [TAB] **180** y [ENTER].', key: m9Type('postdate', 'amount', '180', 'ENTER'), done: (s) => ed(s)?.expiry.amount === 180 && !fw(s).dlg },
        { say: 'Guárdalo con nombre nuevo para no perder el del producto anterior: **Mensaje › Guardar como**, «Nombre» [TAB] **PRD7788** y [ENTER].', key: m9Type('saveas', 'name', 'PRD7788', 'ENTER'), done: (s) => Boolean(s.messages.PRD7788) },
        { say: 'Presiona [F7] para cargar PRD7788 en la impresora.', key: loadKey, done: (s) => s.activeMessage === 'PRD7788' },
        { say: 'Cambia el lote: [F8] › [F6] › LOTE [TAB] › **2611C** › [ENTER]. (El lote es un dato de la impresora: sirve para cualquier mensaje que lo use).', key: setLote('2611C'), done: loteIs('2611C') },
        { say: 'Cierra con [ESC] y reanuda la impresión: [F7] › [ENTER].', key: (s) => (fw(s).dlg ? 'ESC' : pauseKey(false)(s)), done: (s) => !s.paused && !fw(s).dlg },
        { say: 'Verifica el **primer producto** en **▤ Línea**: PRD-7788, L2611C, fabricación hoy, vencimiento hoy + 180 días.', drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => e.msg === 'PRD7788') },
        info('Lista de liberación del cambio: ✔ mensaje correcto en producción (abajo «Cabezal 1: PRD7788») ✔ código de producto ✔ lote ✔ fechas ✔ legible y centrado ✔ firma/registro según tu planta. Si solo cambia el lote, basta con [F6].'),
      ],
    },

    // ------------------------------------------------------------ 4. fecha pasada
    {
      id: 'c_fecha_pasada',
      group: 'codif',
      title: 'Poner una fecha pasada que siga corriendo',
      goal: 'Reloj automático: fecha y hora indicadas',
      summary: '[F8] › [F1] Preparación › Inicializacion › Reloj automático › Hora + Fecha › [ENTER]. El reloj sigue avanzando desde ahí; «Paro/Marcha fecha aut» sin marcar.',
      setup: (s) => {
        prep(s)
        s.rtcOffset = 0
        s.messages.FECHAS = makeMessage('FECHAS', [[T('FAB '), F('date', { format: 'DD/MM/YY' }), T(' '), F('clock', { format: 'HH:MM' })]])
        s.activeMessage = 'FECHAS'
      },
      steps: [
        info(() => `Te piden codificar con fecha **${pastDate().shown}** a las **08:00** y que desde ahí **siga corriendo** sola.\nEn el 9040 todas las fechas, horas, caducidades y turnos salen del **reloj de la impresora**. Se ajusta el reloj a esa fecha y hora, y sigue avanzando como un reloj normal.\n⚠ Afecta a **todos** los mensajes: confírmalo con tu supervisor.`),
        { say: 'Abre **▤ Línea**: hoy sale la fecha actual.', drawer: 'product', done: (s) => lastPrint(s)?.msg === 'FECHAS' },
        { say: 'Abre **Preparación › Inicializacion › Reloj automático** ([F8] › [F1] › [DOWN] › baja › [ENTER]).', key: m9Nav('clock'), done: at('clock') },
        { say: 'En «Hora» presiona [TAB], escribe **080000** y [DOWN].', key: m9Type('clock', 'time', '080000'), done: (s) => dlgV(s, 'time') === '08:00:00' },
        info('«Paro/Marcha fecha aut» debe quedar **SIN marcar**: si se marca, la fecha se queda congelada y NO avanza.', { region: 'screen' }),
        { say: () => `En «Fecha (dd/mm/aa)» [TAB], escribe **${pastDate().typed}** y [DOWN].`, key: (s) => m9Type('clock', 'date', pastDate().typed)(s), done: (s) => dlgV(s, 'date') === pastDate().shown },
        { say: 'Presiona [ENTER] para validar.', key: 'ENTER', done: (s, c) => ev(c, 'RTC_SET', (e) => e.d === pastDate().d && e.mo === pastDate().mo && e.h === 8) },
        { say: 'Vuelve a Producción ([F8]): arriba a la derecha la hora ya corre desde 08:00.', key: m9Nav('prod'), done: at('prod') },
        { say: () => `Mira **▤ Línea**: «FAB ${pastDate().shown} 08:0x». Si esperas, los minutos avanzan solos.`, drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => e.msg === 'FECHAS') },
        info('Para volver a la fecha real: la misma pantalla, con la fecha y hora actuales. La **caducidad** se calcula desde la fecha del reloj, así que también se ajusta sola. Si solo pusieras la fecha como **texto**, no avanzaría nunca.'),
      ],
    },

    // ------------------------------------------------------------ 5. lote juliano + turno
    {
      id: 'c_juliano',
      group: 'codif',
      title: 'Lote con fecha juliana y turno',
      goal: 'Variables › Fecha YYJJJ + Turno de trabajo',
      summary: 'Fecha juliana = año + día del año (YYJJJ, ej. 26305). Turno: Hora inicio, Intervalo y Tipo (LETRAS A/B/C).',
      setup: (s) => {
        prep(s)
        s.messages.LOTEJ = makeMessage('LOTEJ', [[T('L')]])
        s.activeMessage = 'LOTEJ'
      },
      steps: [
        info(() => { const d = rtcNow(0); return `Muchas plantas forman el **lote** con la **fecha juliana**: año + día del año (001 a 365). Hoy es el día **${pad(dayOfYear(d), 3)}**, así que YYJJJ = **${pad(d.getFullYear() % 100)}${pad(dayOfYear(d), 3)}**. Detrás va la **letra del turno**: L${pad(d.getFullYear() % 100)}${pad(dayOfYear(d), 3)}A.` }),
        { say: 'Presiona [F3] para modificar el mensaje LOTEJ.', key: editProd, done: inEdit },
        { say: '**Variables › Fecha**: en «Composicion» [TAB], escribe **YYJJJ** y [ENTER]. (Códigos: YY año, JJJ día del año, Y último dígito del año, WW semana).', key: m9Type('varDate', 'comp', 'YYJJJ', 'ENTER'), done: (s) => has(ed(s), (f) => f.type === 'date' && f.format === 'YYJJJ') && !fw(s).dlg },
        { say: '**Parametros › Turno de trabajo**: «Hora inicio» **0600**, «Intervalo» **0800**, «Tipo» **LETRAS** y [ENTER] (turnos A 06-14, B 14-22, C 22-06).', key: m9Fill('shift', [['start', 'type', '0600'], ['interval', 'type', '0800'], ['type', 'choose', 'LETRAS']]), done: (s) => ed(s)?.shift.start === '06:00' && ed(s).shift.interval === '08:00' && ed(s).shift.type === 'LETRAS' && !fw(s).dlg },
        { say: 'Inserta la letra: **Variables › Turno de trabajo** › [ENTER].', key: m9Nav('varShift'), done: (s) => has(ed(s), (f) => f.type === 'shift') },
        { say: '[F7] para cargar la impresora.', key: loadKey, done: (s) => s.activeMessage === 'LOTEJ' && has(act(s), (f) => f.type === 'shift') && has(act(s), (f) => f.type === 'date') },
        { say: 'Mira **▤ Línea**: lote juliano con la letra del turno actual.', drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => e.msg === 'LOTEJ') },
        info('La letra cambia sola al pasar las 14:00 y las 22:00. Si tu planta usa números de turno, «Tipo» = CIFRAS (01, 02, 03).'),
      ],
    },

    // ------------------------------------------------------------ 6. cambio de fecha 06:00
    {
      id: 'c_cambio_fecha',
      group: 'codif',
      title: 'Fecha que cambia a las 06:00 (turno de noche)',
      goal: 'Reloj automático › Hora cambio fecha',
      summary: '«Hora cambio fecha» = hora a la que el código pasa al día siguiente. Con 06:00, lo producido de 00:00 a 05:59 lleva la fecha del día anterior.',
      setup: (s) => {
        prep(s)
        s.rtcOffset = 0
        s.messages.FECHA6 = makeMessage('FECHA6', [[T('FAB '), F('date', { format: 'DD/MM/YY' }), T(' '), F('clock', { format: 'HH:MM' })]])
        s.activeMessage = 'FECHA6'
      },
      steps: [
        info('Situación frecuente: el turno de noche trabaja de 22:00 a 06:00 y calidad pide que **todo el turno lleve la misma fecha** (la del día en que empezó). Por defecto el 9040 cambia la fecha a las 00:00. Se configura **«Hora cambio fecha»**.'),
        { say: 'Abre **Preparación › Inicializacion › Reloj automático**.', key: m9Nav('clock'), done: at('clock') },
        { say: 'Para probarlo simularemos las 2 de la mañana: en «Hora» [TAB], escribe **020000** y [DOWN].', key: m9Type('clock', 'time', '020000'), done: (s) => dlgV(s, 'time') === '02:00:00' },
        { say: 'Ve a «Hora cambio fecha (hh:mm)», [TAB], escribe **0600** y [DOWN].', key: m9Type('clock', 'change', '0600'), done: (s) => dlgV(s, 'change') === '06:00' },
        { say: 'Presiona [ENTER] para validar.', key: 'ENTER', done: (s) => s.hw.dateChange === '06:00' && !fw(s).dlg },
        { say: 'Vuelve a Producción ([F8]).', key: m9Nav('prod'), done: at('prod') },
        { say: () => { const y = addDays(rtcNow(0), -1); return `Mira **▤ Línea**: son las 02:xx de hoy pero el código dice **FAB ${pad(y.getDate())}/${pad(y.getMonth() + 1)}/${pad(y.getFullYear() % 100)}** (ayer), porque aún no son las 06:00.` }, drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => e.msg === 'FECHA6') },
        info('A partir de las 06:00 la fecha pasa al día nuevo. La **caducidad** se calcula desde esa misma fecha. Para volver a la normal, «Hora cambio fecha» = 00:00. Recuerda poner el reloj en la hora real después de practicar (lección «fecha pasada»).'),
      ],
    },
  ]
}
