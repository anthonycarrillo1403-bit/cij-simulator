// 15 misiones de planta. Cada misión tiene una variante por equipo (S8 Classic chorro simple y
// 9040 bichorro): mismo objetivo de planta, pasos y teclas propios de cada máquina.
// step: { text, hint, check(s, ev, prev), key?(s) → tecla a señalar, nav? → pantalla destino }
import { canPrint, pushEvent } from './sim.js'
import { rtcNow, shiftCode } from './rtc.js'
import { messageHasField } from './render.js'
import { prep } from './scenario.js'
import { trainingStatus } from './training.js'
import { FIRMWARE } from '../machines/firmware.js'
import * as S8 from '../machines/s8classic/firmware.js'
import * as M9 from '../machines/m9040/firmware.js'
import { s8, s8Select, s8Open, s8MsgFunc, s8Nav, s8SlotsAt, s8Compose, s8Counter, m9, m9Nav, m9Select, m9JetFunc, m9Edit, m9Fill, m9Choose } from '../machines/guide.js'

const hasEv = (ev, type, pred = () => true) => ev.some((e) => e.type === type && pred(e))
const countEv = (ev, type, pred = () => true) => ev.filter((e) => e.type === type && pred(e)).length
const nav = (ev, view) => hasEv(ev, 'NAV', (e) => e.view === view)
const active = (s) => s.messages[s.activeMessage]
const editMsg = (s) => s.editing?.message
const inRange = (v, a, b) => v >= a && v <= b
const fields = (m) => (m ? m.lines.flat() : [])
const has = (m, pred) => Boolean(m && messageHasField(m, pred))
// mensaje 04 del S8 (la copia en edición si está abierta)
const m04 = (s) => (editMsg(s)?.name === '04' ? editMsg(s) : s.messages['04'])

// ---------------------------------------------------------------- misiones
export const MISSIONS = [
  {
    id: 1,
    title: 'Selección y carga rápida de mensaje',
    area: 'Producción',
    lesson: 'seleccion',
    S8_CLASSIC: {
      brief: 'El jefe de línea pide arrancar la orden LOTE A1 (mensaje 02 de la biblioteca). Arranque la impresora, seleccione el mensaje y déjela lista para imprimir.',
      setup(s) {
        prep(s, { power: 'OFF' })
        s.activeMessage = '01'
      },
      steps: [
        { text: 'Arrancar la impresora con [ONOFF]', hint: 'La pantalla dice ON/OFF?: la impresora está parada. Presiona [ONOFF].', check: (s) => s.power !== 'OFF', key: (s) => (s.power === 'OFF' ? 'ONOFF' : null) },
        { text: 'Abrir la biblioteca de mensajes con [EDIT]', hint: 'Presiona [EDIT]: aparece «01Head 1.1* ◆ … ◆».', check: (s, ev) => nav(ev, 'select'), key: s8Nav('select') },
        { text: 'Buscar el mensaje 02 (LOTE A1) con [RIGHT] y seleccionarlo con [DOWN]', hint: 'Con [RIGHT] pasa a 02. Con [DOWN] aparece el asterisco * después de «Head 1.1»: ese es el mensaje que se imprime.', check: (s) => s.activeMessage === '02', key: s8Select('02') },
        { text: 'Esperar READY verde fijo (chorro en marcha)', hint: 'El chorro arranca solo (Head start-up: Auto). Mientras READY parpadea, se está estabilizando.', check: (s) => s.jetState === 'RUNNING' },
        { text: 'Impresora LISTA imprimiendo el mensaje 02', hint: 'Sal a «Function?...» con [EDIT]. Abre ▤ Línea para ver el producto marcado.', check: (s) => s.activeMessage === '02' && canPrint(s), key: (s) => (s8(s).scr === 'HDR' ? 'EDIT' : null) },
      ],
    },
    M9040: {
      brief: 'El jefe de línea pide arrancar la orden LOTE_A1. Seleccione el mensaje, arranque los chorros y deje la impresora lista para imprimir.',
      setup(s) {
        prep(s, { power: 'ON', jet: 'STOPPED' })
        s.activeMessage = 'PRUEBA'
      },
      steps: [
        { text: 'Abrir Selección mensajes con [F1]', hint: 'En la pantalla de Producción, [F1] es el icono de las tres hojas: «Seleccionar y enviar un mensaje en producción».', check: (s, ev) => nav(ev, 'select'), key: m9Nav('select') },
        { text: 'Elegir LOTE_A1 con [DOWN] y validar con [ENTER]', hint: 'Mueve la barra negra con [DOWN] hasta LOTE_A1 y valida con [ENTER]. Abajo verás «Cabezal 1: LOTE_A1».', check: (s) => s.activeMessage === 'LOTE_A1', key: m9Select('LOTE_A1') },
        { text: 'Arrancar los chorros: [WRENCH] › Estado chorros [TAB] › ARRANQUE CHORRO › [ENTER]', hint: 'La llave abre el estado del cabezal. En «Estado chorros» pulsa [TAB], baja a ARRANQUE CHORRO y valida con [ENTER]. Sal con [ESC].', check: (s) => s.jetState === 'RUNNING' || s.jetState === 'STARTING', key: m9JetFunc('ARRANQUE CHORRO') },
        { text: 'LED HEAD 1 verde fijo: impresora LISTA con LOTE_A1', hint: 'Espera unos segundos a que el chorro se estabilice. Sal con [ESC] a Producción.', check: (s) => s.activeMessage === 'LOTE_A1' && canPrint(s), key: (s) => (m9(s).status ? 'ESC' : null) },
      ],
    },
  },
  {
    id: 2,
    title: 'Fecha de caducidad automática (+365 días)',
    area: 'Edición',
    lesson: 'caducidad',
    S8_CLASSIC: {
      brief: 'El producto del mensaje 04 tiene vida útil de un año. Programe una caducidad de 365 días e insértela en el texto (pd/pm/py). El mensaje 04 debe quedar seleccionado.',
      setup(s) {
        prep(s)
        s.activeMessage = '01'
      },
      steps: [
        { text: 'Abrir el mensaje 04: [EDIT] y [RIGHT] hasta 04', hint: '[EDIT] abre la biblioteca; con [RIGHT] llega al 04.', check: (s) => s8(s).msg === '04' && ['HDR', 'TXT', 'M29', 'M30'].includes(s8(s).scr), key: s8Open('04') },
        { text: 'Duración: [DATE] › [DOWN] › escribir 0365 › [UP]', hint: 'Con la cabecera del 04 en pantalla, [DATE] abre «Duration: 0000P (DMY)». [DOWN] para modificar, teclea 0 3 6 5 y confirma con [UP].', check: (s) => m04(s)?.name === '04' && m04(s).expiry.amount === 365 && m04(s).expiry.unit === 'DIAS', key: s8SlotsAt('04', 'DATE', 'M29', '0365') },
        { text: 'En el texto ([CYCLE]) insertar la caducidad: [DATE] [P] [D] / [DATE] [P] [M] / [DATE] [P] [Y]', hint: 'Vuelve a la cabecera con [UP], entra al texto con [CYCLE], ve al final con [RIGHT] y pulsa [DATE] y luego P y D (pd = día de caducidad). Repite con P M (mes) y P Y (año), separando con /.', check: (s) => has(m04(s), (f) => f.type === 'expiry' && f.format === 'DD') && has(m04(s), (f) => f.type === 'expiry' && f.format === 'MM') && has(m04(s), (f) => f.type === 'expiry' && f.format === 'YY'), key: s8Compose('04', 'FAB dd/mm/yy hh:nn pd/pm/py') },
        { text: 'Salir con [EDIT] y seleccionar el 04 con [DOWN] (*)', hint: '[EDIT] guarda el texto y vuelve a la cabecera; [DOWN] lo selecciona para imprimir.', check: (s) => s.activeMessage === '04' && has(active(s), (f) => f.type === 'expiry') && active(s).expiry.amount === 365, key: (s) => (s8(s).scr === 'TXT' ? 'EDIT' : s8Select('04')(s)) },
      ],
    },
    M9040: {
      brief: 'El producto de LOTE_A1 tiene vida útil de un año. Inserte una fecha de caducidad calculada con +365 días desde el reloj y cargue la impresora.',
      setup(s) {
        prep(s)
        s.activeMessage = 'LOTE_A1'
      },
      steps: [
        { text: 'Modificar el mensaje en producción con [F3]', hint: '[F3] (hoja con lápiz) abre la edición del mensaje en producción.', check: (s, ev) => hasEv(ev, 'EDIT_OPEN'), key: m9Edit },
        { text: 'Parametros › Caducidad: Unidad DIA, Caducidad 365 › [ENTER]', hint: '[ESC] activa la barra de menús. Ve a «Parametros» con [RIGHT], ábrela con [DOWN], elige «Caducidad» y [ENTER]. En «Caducidad:» pulsa [TAB], escribe 365 y valida con [ENTER].', check: (s) => editMsg(s)?.expiry.amount === 365 && editMsg(s).expiry.unit === 'DIAS', key: m9Fill('postdate', [['amount', 'type', '365']]) },
        { text: 'Variables › Caducidad: marcar dd, mm, yy y componer dd/mm/yy › [ENTER]', hint: 'Menú Variables › Caducidad. Marca con [TAB] las casillas de día, mes (cifra) y año; en «Composicion» puedes añadir / entre ellos. [ENTER] inserta la fecha en el cursor.', check: (s) => has(editMsg(s), (f) => f.type === 'expiry'), key: m9Fill('varExpiry', [['comp', 'type', 'DD/MM/YY']]) },
        { text: 'Cargar la impresora con [F7]', hint: '[F7] (icono «Cargar impresora») guarda el mensaje y lo pone en producción.', check: (s, ev) => hasEv(ev, 'LOAD_PRINTER') && has(active(s), (f) => f.type === 'expiry') && active(s).expiry.amount === 365, key: (s) => (m9(s).dlg ? 'ESC' : m9(s).mode === 'EDIT' ? (m9(s).focus === 'pull' ? 'ESC' : 'F7') : null) },
      ],
    },
  },
  {
    id: 3,
    title: 'Ajuste manual de hora (RTC)',
    area: 'Reloj',
    lesson: 'reloj',
    S8_CLASSIC: {
      brief: 'Tras un corte de energía el reloj quedó desfasado. Ponga la hora a las 06:00:00 y compruebe que sigue avanzando.',
      setup(s) {
        prep(s)
      },
      steps: [
        { text: 'Abrir la hora con [DATE] (Time (HMS))', hint: 'Desde «Function?...» la tecla [DATE] muestra «Time (HMS) : hh.mm.ss RUN».', check: (s, ev) => nav(ev, 'clock'), key: s8Nav('clock') },
        { text: '[DOWN], escribir 060000 y confirmar con [UP]', hint: '[DOWN] entra en modificación (parpadea la cifra). Teclea 0 6 0 0 0 0 con el teclado numérico y confirma con [UP].', check: (s, ev) => hasEv(ev, 'RTC_SET', (e) => e.h === 6 && e.m === 0), key: (s) => (s8(s).scr === 'I1' && !s8(s).mod ? 'DOWN' : s8(s).mod ? S8.typingKey(s, '060000') : s8Nav('clock')(s)) },
        { text: 'Verificar que el reloj sigue corriendo (10 s)', hint: 'Mira la pantalla: los segundos avanzan (RUN). Espera 10 segundos.', check: (s) => s.rtcLastSet && Date.now() - s.rtcLastSet.sys >= 10000 && rtcNow(s.rtcOffset).getHours() === 6 && rtcNow(s.rtcOffset).getMinutes() < 10 && !s.hw.clockStop },
      ],
    },
    M9040: {
      brief: 'Tras un corte de energía el reloj quedó desfasado. Ponga la hora a las 06:00:00 y compruebe que sigue avanzando.',
      setup(s) {
        prep(s)
      },
      steps: [
        { text: 'Abrir Preparación de impresora › Inicializacion › Reloj automático', hint: '[F8] (otros menús) › [F1] (engranajes) abre Preparación. En la barra «Inicializacion» pulsa [DOWN], baja a «Reloj automático» y [ENTER].', check: (s, ev) => nav(ev, 'clock'), key: m9Nav('clock') },
        { text: 'Hora (hh:mm:ss): escribir 06:00:00 y validar con [ENTER]', hint: 'Con «Hora» resaltada pulsa [TAB], escribe 060000 (los dos puntos se ponen solos) y valida con [ENTER].', check: (s, ev) => hasEv(ev, 'RTC_SET', (e) => e.h === 6 && e.m === 0), key: (s) => {
          const fw = m9(s)
          if (fw.dlg?.form !== 'clock') return M9.navKey(s, 'clock')
          if (!fw.dlg.edit) return fw.dlg.cur === 0 ? 'TAB' : 'UP'
          if (fw.dlg.buf === '060000') return 'ENTER'
          return M9.typingKey(s, '060000')
        } },
        { text: 'Verificar que el reloj sigue corriendo (10 s)', hint: 'Arriba a la derecha de Producción se ve la hora en marcha. Espera 10 s.', check: (s) => s.rtcLastSet && Date.now() - s.rtcLastSet.sys >= 10000 && rtcNow(s.rtcOffset).getHours() === 6 && rtcNow(s.rtcOffset).getMinutes() < 10 && !s.hw.clockStop },
      ],
    },
  },
  {
    id: 4,
    title: 'Turnos automáticos T1 / T2 / T3',
    area: 'Edición',
    lesson: 'turno',
    S8_CLASSIC: {
      brief: 'La planta trabaja 3 turnos: 07:00-15:00, 15:00-23:00 y 23:00-07:00. En el mensaje 04 programe el código de turno (S 07:00, I 08:00, tipo 01) e imprima «T» + código.',
      setup(s) {
        prep(s)
        s.activeMessage = '04'
      },
      steps: [
        { text: 'Mensaje 04: [EDIT] [RIGHT]… › [DATE] › [RIGHT] → «S: … I: …»', hint: 'En la cabecera del 04, [DATE] abre la duración; [RIGHT] pasa al código de tiempo (turno).', check: (s, ev) => nav(ev, 'shift'), key: s8MsgFunc('04', 'DATE', 'M30') },
        { text: '[DOWN], escribir 0700 0800, tipo 01 con [CYCLE], [UP]', hint: 'S = inicio del primer turno (07:00), I = duración de cada turno (08:00). En modificación, [CYCLE] cambia el tipo (01 = números). Confirma con [UP].', check: (s) => m04(s)?.shift.start === '07:00' && m04(s).shift.interval === '08:00', key: s8SlotsAt('04', 'DATE', 'M30', '07000800') },
        { text: 'En el texto ([CYCLE]) escribir T e insertar [DATE] [E]', hint: 'Vuelve a la cabecera ([UP]), [CYCLE] entra al texto. Al final escribe T y pulsa [DATE] y E: aparece «ee».', check: (s) => has(m04(s), (f) => f.type === 'shift'), key: s8Compose('04', (s) => `FAB dd/mm/yy hh:nn T${m04(s)?.shift.type === '01' ? 'ee' : 'e'}`) },
        { text: 'Salir con [EDIT] y seleccionar el 04 con [DOWN]', hint: '[EDIT] vuelve a la cabecera; [DOWN] lo selecciona (*).', check: (s) => s.activeMessage === '04' && has(active(s), (f) => f.type === 'shift') && active(s).shift.start === '07:00' && active(s).shift.interval === '08:00', key: (s) => (s8(s).scr === 'TXT' ? 'EDIT' : s8Select('04')(s)) },
        { text: 'Prueba: poner el reloj entre 15:00 y 22:59 y ver el turno 02', hint: '[EDIT] dos veces a «Function?...», [DATE], [DOWN], escribe por ejemplo 153000 y [UP]. El mensaje imprimirá T02.', check: (s) => ['02', 'B'].includes(shiftCode(rtcNow(s.rtcOffset), active(s).shift)), key: (s) => { const f = s8(s); if (f.scr !== 'I1') return s8Nav('clock')(s); if (!f.mod) return 'DOWN'; return f.buf.startsWith('1530') ? 'UP' : S8.typingKey(s, '153000') } },
      ],
    },
    M9040: {
      brief: 'La planta trabaja 3 turnos: 07:00-15:00, 15:00-23:00 y 23:00-07:00. El código de turno debe cambiar solo (01/02/03) en LOTE_A1.',
      setup(s) {
        prep(s)
        s.activeMessage = 'LOTE_A1'
      },
      steps: [
        { text: 'Modificar el mensaje en producción con [F3]', hint: '[F3] abre la edición de LOTE_A1.', check: (s, ev) => hasEv(ev, 'EDIT_OPEN'), key: m9Edit },
        { text: 'Parametros › Turno de trabajo: 07:00, 08:00, CIFRAS › [ENTER]', hint: '[ESC] › Parametros › «Turno de trabajo». «Hora inicio» = 07:00 (escribe 0700), «Intervalo» = 08:00, «Tipo» CIFRAS. [ENTER] valida.', check: (s) => editMsg(s)?.shift.start === '07:00' && editMsg(s).shift.interval === '08:00', key: m9Fill('shift', [['start', 'type', '0700'], ['interval', 'type', '0800']]) },
        { text: 'Escribir T e insertar Variables › Turno de trabajo', hint: 'En la zona de edición escribe T; luego [ESC] › Variables › «Turno de trabajo» › [ENTER].', check: (s) => has(editMsg(s), (f) => f.type === 'shift'), key: (s) => (m9(s).mode === 'EDIT' && m9(s).focus === 'main' && !m9(s).dlg && !(M9.input(s) || '').endsWith('T') ? 'T' : m9Nav('varShift')(s)) },
        { text: 'Cargar la impresora con [F7]', hint: '[F7] guarda y pone el mensaje en producción.', check: (s, ev, prev) => hasEv(prev, 'LOAD_PRINTER') && has(active(s), (f) => f.type === 'shift') && active(s).shift.start === '07:00', key: (s) => (m9(s).focus === 'pull' ? 'ESC' : 'F7') },
        { text: 'Prueba: poner el reloj entre 15:00 y 22:59 y ver el turno 02', hint: 'Preparación › Inicializacion › Reloj automático: Hora 15:30:00 › [ENTER].', check: (s) => ['02', 'B'].includes(shiftCode(rtcNow(s.rtcOffset), active(s).shift)), key: m9Fill('clock', [['time', 'type', '153000']]) },
      ],
    },
  },
  {
    id: 5,
    title: 'Contador ascendente + lote dinámico',
    area: 'Edición',
    lesson: 'contador',
    S8_CLASSIC: {
      brief: 'Cada caja del mensaje 04 lleva un número 1 → 9999 que sube con cada producto, más el lote = día juliano (jjj).',
      setup(s) {
        prep(s)
        s.activeMessage = '04'
        s.messages['04'] = structuredClone(s.messages['04'])
        Object.assign(s.messages['04'].counter, { end: 999999, step: 2, value: 1 })
      },
      steps: [
        { text: 'Mensaje 04 › [CNT]: batch 000001, step 01, start 000000001, final 000009999', hint: 'En la cabecera del 04 pulsa [CNT]. Con [RIGHT] recorres Counter batch, Step, Start value y Final value; en cada uno [DOWN], teclea el valor y [UP].', check: (s) => { const c = m04(s)?.counter; return Boolean(c && c.start === 1 && c.end === 9999 && c.step === 1 && c.batch === 1) }, key: s8Counter('04', { batch: 1, step: 1, start: 1, end: 9999 }) },
        { text: 'En el texto insertar el contador [CNT] y el lote juliano [DATE] [J]', hint: 'Cabecera › [CYCLE] al texto › al final [CNT] (ccccccccc) y [DATE] J (jjj).', check: (s) => has(m04(s), (f) => f.type === 'counter') && has(m04(s), (f) => f.type === 'date' && f.format.includes('JJJ')), key: s8Compose('04', 'FAB dd/mm/yy hh:nn ccccccccc jjj') },
        { text: 'Salir con [EDIT] y seleccionar el 04 con [DOWN]', hint: '[EDIT] y luego [DOWN].', check: (s) => s.activeMessage === '04' && has(active(s), (f) => f.type === 'counter') && active(s).counter.end === 9999, key: (s) => (s8(s).scr === 'TXT' ? 'EDIT' : s8Select('04')(s)) },
        { text: 'Pasar 3 productos y ver el contador +1 cada vez', hint: 'Abre ▤ Línea: la cinta lleva productos a la fotocélula (o usa «Pasar 1 producto»). El chorro debe estar en marcha.', check: (s, ev, prev) => countEv(prev, 'PRINT', (e) => e.cause === 'PHOTOCELL' && (e.counterAfter === e.counterBefore + 1 || (e.counterBefore === 9999 && e.counterAfter === 1))) >= 3 },
      ],
    },
    M9040: {
      brief: 'Cada caja lleva un número 1 → 9999 que sube con cada producto (fotocélula) y un lote que el operador cambia (campo de usuario LOTE).',
      setup(s) {
        prep(s)
        s.activeMessage = 'LOTE_A1'
        s.messages.LOTE_A1 = structuredClone(s.messages.LOTE_A1)
        Object.assign(s.messages.LOTE_A1.counter, { end: 999999, step: 2, incType: 'MENSAJES' })
      },
      steps: [
        { text: 'Modificar el mensaje en producción con [F3]', hint: '[F3].', check: (s, ev) => hasEv(ev, 'EDIT_OPEN'), key: m9Edit },
        { text: 'Parametros › Contador: 1 → 9999, paso 01, lotes 1, OBJECTO', hint: '[ESC] › Parametros › Contador. Valor inicial 1, Valor final 9999, Paso 01, Contador lotes 1, Tipo incremento OBJECTO. [ENTER].', check: (s) => { const c = editMsg(s)?.counter; return Boolean(c && c.start === 1 && c.end === 9999 && c.step === 1 && c.batch === 1 && c.incType === 'OBJETOS') }, key: m9Fill('counterParams', [['start', 'type', '1'], ['end', 'type', '9999'], ['step', 'type', '1'], ['batch', 'type', '1'], ['incType', 'choose', 'OBJETOS']]) },
        { text: 'Insertar Variables › Contador y Variables › Usuario (LOTE)', hint: 'Variables › Contador lo inserta en el cursor. Variables › Usuario: Elemento de identificacion LOTE, valor por defecto A0001.', check: (s) => has(editMsg(s), (f) => f.type === 'counter') && has(editMsg(s), (f) => f.type === 'opvar' && f.name === 'LOTE'), key: (s) => (!has(editMsg(s), (f) => f.type === 'counter') ? m9Nav('varCounter')(s) : M9.atTarget(s, 'varUser') ? 'ENTER' : m9Nav('varUser')(s)) },
        { text: 'Cargar la impresora con [F7]', hint: '[F7].', check: (s, ev, prev) => hasEv(prev, 'LOAD_PRINTER') && has(active(s), (f) => f.type === 'counter') && active(s).counter.end === 9999, key: (s) => (m9(s).focus === 'pull' ? 'ESC' : 'F7') },
        { text: 'Pasar 3 productos y ver el contador +1 cada vez', hint: '▤ Línea › la cinta pasa productos por la fotocélula.', check: (s, ev, prev) => countEv(prev, 'PRINT', (e) => e.cause === 'PHOTOCELL' && (e.counterAfter === e.counterBefore + 1 || (e.counterBefore === 9999 && e.counterAfter === 1))) >= 3 },
      ],
    },
  },
  {
    id: 6,
    title: 'Calibración del punto de quiebra',
    area: 'Chorro',
    lesson: 'quiebra',
    S8_CLASSIC: {
      brief: 'La fase sale «01010011»: el punto de quiebra no está en el electrodo de carga. Visualice el control de gotas y ajuste el potenciómetro del cabezal hasta 3-4 «1» seguidos.',
      setup(s) {
        prep(s)
        s.hw.jet.modulation = 95
      },
      steps: [
        { text: 'Control de gotas: [F] [FAULT] [RIGHT] [RIGHT] [DOWN] [CYCLE]', hint: '[F] + [FAULT] abre «Status jet». [RIGHT] dos veces llega a «Jet 1: Dc 20.0 m/s». [DOWN] y [CYCLE] muestran «Jet 1: xxxxxxxx».', check: (s, ev) => nav(ev, 'jet'), key: s8Nav('jet') },
        { text: 'Potenciómetro (▤ Línea) hasta punto de quiebra 8-10 gotas', hint: 'Abre ▤ Línea › «Potenciómetro de quiebra». Gíralo poco a poco y mira la pantalla: buscas 3 ó 4 unos seguidos (00111100).', check: (s) => inRange(s.live.breakoff, 8, 10) },
        { text: 'Fase correcta estable 5 s', hint: 'Deja el potenciómetro quieto y espera 5 segundos con 00111100.', check: (s) => s.live.phaseStableMs >= 5000 },
        { text: 'Validar saliendo con [UP]', hint: '[UP] sale del control de gotas y valida.', check: (s, ev, prev) => hasEv(prev, 'JET_VALIDATE', (e) => e.ok), key: (s) => (s8(s).scr === 'E9' ? 'UP' : s8Nav('jet')(s)) },
      ],
    },
    M9040: {
      brief: 'La fase sale incorrecta en los chorros: el punto de quiebra no está en el electrodo de carga. Visualice la fase y ajuste el potenciómetro hasta 3-4 «1» seguidos.',
      setup(s) {
        prep(s)
        s.hw.jet.modulation = 95
      },
      steps: [
        { text: 'Pantalla de estado con la [WRENCH]: Fase chorro1 / Fase chorro2', hint: 'La llave muestra «Fase chorro1» y «Fase chorro2».', check: (s, ev) => nav(ev, 'jet'), key: m9Nav('status') },
        { text: 'Potenciómetro (▤ Línea) hasta punto de quiebra 8-10 gotas', hint: '▤ Línea › «Potenciómetro de quiebra». Busca 3 ó 4 unos seguidos (00111100).', check: (s) => inRange(s.live.breakoff, 8, 10) },
        { text: 'Fase correcta estable 5 s', hint: 'Espera 5 s sin tocar.', check: (s) => s.live.phaseStableMs >= 5000 },
        { text: 'Salir de la pantalla de estado con [ESC] (validar)', hint: '[ESC].', check: (s, ev, prev) => hasEv(prev, 'JET_VALIDATE', (e) => e.ok), key: (s) => (m9(s).status ? 'ESC' : m9Nav('status')(s)) },
      ],
    },
  },
  {
    id: 7,
    title: 'Centrado del chorro en el canal',
    area: 'Chorro',
    lesson: 'centrado',
    S8_CLASSIC: {
      brief: 'Tras desmontar el cabezal, el chorro no entra en el recuperador. Inhiba el defecto de recuperación, centre el chorro con las levas y vuelva a activar la vigilancia.',
      setup(s) {
        prep(s, { power: 'ON', jet: 'STOPPED' })
        s.hidden.biasX = 85
        s.hidden.biasY = -50
      },
      steps: [
        { text: 'Inhibir el defecto: [F][FAULT][RIGHT] › [DOWN] › [RIGHT] › [CYCLE] → Vacuum: No › [UP]', hint: 'E7 «Fault: Cover Yes Vacuum: Yes». [DOWN] para modificar, [RIGHT] al campo Vacuum, [CYCLE] cambia a No, [UP] confirma.', check: (s) => s.hw.faultInhibit.recup, key: (s) => { const fw = s8(s); if (fw.scr !== 'E7') return s8Nav('faultInhibit')(s); if (!fw.mod) return 'DOWN'; if (fw.cur !== 1) return 'RIGHT'; return 'CYCLE' } },
        { text: 'Arrancar el chorro: [F][FAULT] [DOWN] → Jet: Stop › [CYCLE] → Jet: On', hint: 'Si hay un defecto memorizado, primero anúlalo con [FAULT] [FAULT].', check: (s) => s.jetState === 'RUNNING', key: (s) => (s.jetState === 'STARTING' ? null : Object.keys(s.faults).length ? (s8(s).scr === 'FAULTS' ? 'FAULT' : s8Nav('faults')(s)) : s8(s).scr === 'E2' ? 'CYCLE' : s8Nav('jetStatus')(s)) },
        { text: 'Centrar con las levas del cañón (▤ Línea) hasta Canal OK', hint: '▤ Línea › «Levas del cañón»: mueve horizontal y vertical hasta que «Canal» diga OK.', check: (s) => s.live.gutterOk && s.jetState === 'RUNNING' },
        { text: 'Reactivar Vacuum: Yes y quedar en marcha sin defecto', hint: 'Vuelve a E7 y pon Vacuum: Yes. Si ves FAULT rojo, [FAULT] [FAULT] anula.', check: (s) => !s.hw.faultInhibit.recup && s.jetState === 'RUNNING' && !s.faults.RECUP && s.live.gutterOk, key: (s) => { const fw = s8(s); if (fw.scr !== 'E7') return s8Nav('faultInhibit')(s); if (!fw.mod) return 'DOWN'; if (fw.cur !== 1) return 'RIGHT'; return 'CYCLE' } },
      ],
    },
    M9040: {
      brief: 'Tras desmontar el cabezal, el chorro no entra en el recuperador. Use AJUSTE CHORRO (defectos de chorro inhibidos), centre con las excéntricas y vuelva a ARRANQUE CHORRO.',
      setup(s) {
        prep(s, { power: 'ON', jet: 'STOPPED' })
        s.hidden.biasX = 85
        s.hidden.biasY = -50
      },
      steps: [
        { text: '[WRENCH] › Estado chorros [TAB] › AJUSTE CHORRO › [ENTER]', hint: 'AJUSTE arranca los chorros ignorando los defectos de chorro para poder ajustarlos.', check: (s, ev) => hasEv(ev, 'ADJUST_ENTER'), key: m9JetFunc('AJUSTE CHORRO') },
        { text: 'Centrar con las excéntricas (▤ Línea) hasta Canal OK', hint: '▤ Línea › «Excéntricas del cañón»: horizontal y vertical hasta «Canal OK».', check: (s) => s.live.gutterOk && s.jetState === 'RUNNING' },
        { text: 'Estado chorros › ARRANQUE CHORRO: en marcha sin defecto', hint: 'Sal de AJUSTE con ARRANQUE CHORRO.', check: (s, ev, prev) => hasEv(prev, 'ADJUST_EXIT') && s.jetState === 'RUNNING' && !s.faults.RECUP && s.live.gutterOk, key: m9JetFunc('ARRANQUE CHORRO') },
      ],
    },
  },
  {
    id: 8,
    title: 'Sincronización con el tacómetro (encoder)',
    area: 'Parámetros',
    lesson: 'velocidad',
    S8_CLASSIC: {
      brief: 'La línea cambia de velocidad y el marcaje sale deformado. Pase el mensaje seleccionado a tacómetro con división 0015.',
      setup(s) {
        prep(s)
        s.activeMessage = '02'
        s.line.speed = 45
        s.hw.encoder.division = 10
      },
      steps: [
        { text: 'Mensaje 02 › [PARAM] › [RIGHT] → Printing speed (mm/s)', hint: '[EDIT] (abre en el 02, el seleccionado) › [PARAM] (Printing delay) › [RIGHT].', check: (s, ev) => nav(ev, 'encoder'), key: s8MsgFunc('02', 'PARAM', 'M10') },
        { text: '[DOWN] y [CYCLE] → Tachy', hint: 'En modificación, [CYCLE] cambia entre velocidad fija y tacómetro.', check: (s) => s.hw.encoder.source === 'ENCODER', key: (s) => (s8(s).scr === 'M10' ? (s8(s).mod ? 'CYCLE' : 'DOWN') : null) },
        { text: 'Tachy: 0015 y [UP]', hint: 'Teclea 0 0 1 5 y confirma con [UP].', check: (s) => s.hw.encoder.division === 15 && !s8(s).mod, key: s8SlotsAt('02', 'PARAM', 'M10', '0015') },
        { text: 'Imprimir con la longitud correcta', hint: 'Mira ▤ Línea: el siguiente producto sale con proporciones correctas.', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => inRange(e.wf, 0.95, 1.05)) },
      ],
    },
    M9040: {
      brief: 'La línea cambia de velocidad y el marcaje sale deformado. Pase la lectura de velocidad a TACO con división 12.',
      setup(s) {
        prep(s)
        s.activeMessage = 'LOTE_A1'
        s.line.speed = 45
        s.hw.encoder.division = 8
      },
      steps: [
        { text: 'Parámetros del mensaje en producción: [F4]', hint: '[F4] (bloque de texto con flechas).', check: (s, ev) => nav(ev, 'msgParams'), key: m9Nav('prodParams') },
        { text: 'Lectura velocidad: TACO', hint: 'Baja a «Lectura velocidad», [TAB] abre la lista, elige TACO y [ENTER].', check: (s) => m9(s).dlg?.v?.lectura === 'ENCODER' || s.hw.encoder.source === 'ENCODER', key: m9Choose('prodParams', 'lectura', 'ENCODER') },
        { text: 'Division taco: 12 y validar con [ENTER]', hint: 'Sube a «Division taco», escribe 12 y [ENTER] valida el cuadro.', check: (s) => s.hw.encoder.source === 'ENCODER' && s.hw.encoder.division === 12 && !m9(s).dlg, key: m9Fill('prodParams', [['lectura', 'choose', 'ENCODER'], ['division', 'type', '12']]) },
        { text: 'Imprimir con la longitud correcta', hint: '▤ Línea.', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => inRange(e.wf, 0.95, 1.05)) },
      ],
    },
  },
  {
    id: 9,
    title: 'Código de barras',
    area: 'Edición',
    lesson: 'barras',
    S8_CLASSIC: {
      brief: 'Etiquete las cajas con un código de barras Code 39 que lleve el número del contador (el S8 Classic no tiene Code 128). Use el mensaje 05.',
      setup(s) {
        prep(s)
        delete s.messages['05']
      },
      steps: [
        { text: 'Mensaje 05: [EDIT] [RIGHT]… › [CYCLE] (texto)', hint: '[EDIT], [RIGHT] hasta 05 y [CYCLE] para entrar al texto (vacío).', check: (s) => s8(s).msg === '05' && ['TXT', 'BC'].includes(s8(s).scr), key: (s) => (s8(s).scr === 'HDR' && s8(s).msg === '05' ? 'CYCLE' : s8Open('05', 'CYCLE')(s)) },
        { text: 'Insertar código de barras: [AA] y luego [C]', hint: '[AA] muestra «Variable: (B,M,C,L,→,dIN)»; la letra C inserta el código (⇕⇕).', check: (s) => has(editMsg(s), (f) => f.type === 'barcode'), key: (s) => (s8(s).scr === 'TXT' ? (s8(s).var === 'AA' ? 'C' : 'AA') : null) },
        { text: 'Tipo: [PARAM] → Bar code type › [CYCLE] → Code 39 › [UP]', hint: 'Dentro del código, [PARAM] abre «Bar code type: 2/5 int». [CYCLE] cambia a Code 39. [UP] vuelve.', check: (s) => has(editMsg(s), (f) => f.type === 'barcode' && f.symbology === 'CODE39'), key: (s) => (s8(s).scr === 'BC' ? 'PARAM' : s8(s).scr === 'M19' ? 'CYCLE' : null) },
        { text: 'Datos del código: el contador [CNT]', hint: 'Dentro del código pulsa [CNT].', check: (s) => has(editMsg(s), (f) => f.type === 'barcode' && f.source === 'counter'), key: (s) => (['M19', 'M20', 'M21'].includes(s8(s).scr) ? 'UP' : s8(s).scr === 'BC' ? 'CNT' : null) },
        { text: 'Salir con [EDIT], seleccionar el 05 con [DOWN] e imprimir', hint: '[EDIT] (sales del código), [EDIT] (cabecera), [DOWN] (*). Mira ▤ Línea.', check: (s, ev, prev) => s.activeMessage === '05' && has(active(s), (f) => f.type === 'barcode' && f.symbology === 'CODE39') && hasEv(prev, 'PRINT', (e) => e.msg === '05'), key: (s) => (['TXT', 'BC'].includes(s8(s).scr) ? 'EDIT' : s.activeMessage !== '05' ? s8Select('05')(s) : null) },
      ],
    },
    M9040: {
      brief: 'El ERP envía el código de pedido por el puerto serie. Cree un CODE 128 cuyo contenido llegue por V24 (Elemento externo).',
      setup(s) {
        prep(s)
        s.activeMessage = 'LOTE_A1'
        s.hw.v24.data = ''
        s.hw.v24.baud = 38400
      },
      steps: [
        { text: 'Preparación › Inicializacion › Comunicación V24: 9600, NO, 1 › [ENTER]', hint: '[F8] › [F1] › Inicializacion › «Comunicación V24». Velocidad 9600 (lista con [TAB]), Paridad NO, Stop bit 1. [ENTER].', check: (s, ev) => hasEv(ev, 'V24_CONFIG') && s.hw.v24.baud === 9600 && s.hw.v24.parity === 'NINGUNA' && s.hw.v24.stop === 1, key: m9Fill('v24', [['baud', 'choose', 9600], ['parity', 'choose', 'NINGUNA'], ['stop', 'choose', 1]]) },
        { text: 'Edición: Parametros › Codigo de barras › Tipo EAN128 / CODE128', hint: 'Vuelve con [F8], [F3] para editar; [ESC] › Parametros › «Codigo de barras».', check: (s) => editMsg(s)?.barcode?.symbology === 'CODE128', key: m9Fill('bcParams', [['symbology', 'choose', 'CODE128']]) },
        { text: 'Fuente › Código de barras: marcar «Elemento externo» › [ENTER]', hint: '[ESC] › Fuente › «Código de barras». Baja a «Elemento externo», márcalo con [TAB] y [ENTER] inserta el código.', check: (s) => has(editMsg(s) || active(s), (f) => f.type === 'barcode' && f.symbology === 'CODE128' && f.source === 'external'), key: m9Fill('bcCompose', [['external', 'check']]) },
        { text: 'Cargar la impresora con [F7]', hint: '[F7].', check: (s) => has(active(s), (f) => f.type === 'barcode' && f.symbology === 'CODE128' && f.source === 'external'), key: (s) => (m9(s).focus === 'pull' ? 'ESC' : 'F7') },
        { text: 'Enviar una trama por V24 (▤ Línea › Terminal V24)', hint: '▤ Línea › Terminal V24: escribe un código y «Enviar».', check: (s, ev, prev) => hasEv(prev, 'V24_FRAME', (e) => e.data.length > 0) },
        { text: 'Imprimir el código con los datos recibidos', hint: 'Pasa un producto.', check: (s, ev, prev) => hasEv(prev, 'PRINT') },
      ],
    },
  },
  {
    id: 10,
    title: 'Alarma de tinta: reponer y anular',
    area: 'Consumibles',
    lesson: 'defectos',
    S8_CLASSIC: {
      brief: 'El LED ALARM está encendido. Identifique la alarma, reponga tinta (máx. ½ depósito), anúlela y verifique la presión y velocidad del chorro.',
      setup(s) {
        prep(s)
        s.hidden.inkLevel = 6
      },
      steps: [
        { text: 'Ver la alarma con [FAULT]', hint: '[FAULT] muestra «Ink tank level low.».', check: (s, ev) => s8(s).scr === 'FAULTS' && Boolean(s.faults.INK_LOW), key: s8Nav('faults') },
        { text: 'Rellenar tinta (▤ Línea › Rellenar tinta)', hint: 'Abre ▤ Línea y pulsa «Rellenar tinta».', check: (s) => s.hidden.inkLevel > 10 },
        { text: 'Anular con [FAULT] (sin defectos)', hint: 'Con la lista de defectos en pantalla, [FAULT] anula lo memorizado.', check: (s, ev, prev) => hasEv(prev, 'FAULT_ACK') && Object.keys(s.faults).length === 0, key: (s) => (s8(s).scr === 'FAULTS' ? 'FAULT' : s8Nav('faults')(s)) },
        { text: 'Verificar presión y chorro: [F][FAULT] … E11 (Vm P µ Vj)', hint: '[F] [FAULT] abre Status jet; [LEFT] tres veces llega a «Vm:1500 P:2.90b …».', check: (s, ev) => nav(ev, 'visco'), key: s8Nav('visco') },
      ],
    },
    M9040: {
      brief: 'El LED de tinta y el de alarma están encendidos. Identifique la alarma, reponga tinta, resuélvala con (i) y verifique el estado del circuito.',
      setup(s) {
        prep(s)
        s.hidden.inkLevel = 6
      },
      steps: [
        { text: 'Ver la alarma con [INFO]', hint: 'La tecla (i) muestra la lista: «Nivel de tinta bajo».', check: (s) => Boolean(m9(s).defects) && Boolean(s.faults.INK_LOW), key: m9Nav('faults') },
        { text: 'Rellenar tinta (▤ Línea › Rellenar tinta)', hint: '▤ Línea › «Rellenar tinta».', check: (s) => s.hidden.inkLevel > 10 },
        { text: 'Resolver con [INFO] (sin defectos)', hint: 'Con la lista abierta, (i) anula.', check: (s, ev, prev) => hasEv(prev, 'FAULT_ACK') && Object.keys(s.faults).length === 0, key: (s) => (m9(s).defects ? 'INFO' : m9Nav('faults')(s)) },
        { text: 'Verificar presión y viscosidad: [WRENCH]', hint: 'La llave muestra Presion, Viscosidad y Temperatura.', check: (s, ev, prev) => nav(prev, 'visco'), key: m9Nav('status') },
      ],
    },
  },
  {
    id: 11,
    title: 'Posición del marcaje y retardo',
    area: 'Parámetros',
    lesson: 'velocidad',
    S8_CLASSIC: {
      brief: 'Calidad pide el marcaje a 80 mm del borde delantero de la caja. Ajuste el retardo de impresión (A) del mensaje seleccionado (02).',
      setup(s) {
        prep(s)
        s.activeMessage = '02'
      },
      steps: [
        { text: 'Mensaje 02 › [PARAM] → Printing delay', hint: '[EDIT] (en 02) › [PARAM].', check: (s, ev) => nav(ev, 'delay'), key: s8MsgFunc('02', 'PARAM', 'M9') },
        { text: '[DOWN], A = 0080, [UP]', hint: 'Teclea 0 0 8 0 y confirma con [UP] (R e I se dejan igual).', check: (s) => active(s).params.delayFwd === 80, key: s8SlotsAt('02', 'PARAM', 'M9', (s) => `0080${s8(s).buf.slice(4)}`) },
        { text: 'Imprimir un producto con el nuevo retardo', hint: '▤ Línea.', check: (s, ev, prev) => active(s).params.delayFwd === 80 && hasEv(prev, 'PRINT') },
      ],
    },
    M9040: {
      brief: 'Cabezal bichorro: el chorro 1.2 imprime 8 tramas más tarde que el 1.1 y las dos líneas salen desfasadas. Corrija la Orientación de chorros.',
      setup(s) {
        prep(s)
        s.activeMessage = 'LOTE_A1'
        s.hw.head.skew = 8
      },
      steps: [
        { text: 'Preparación › Inicializacion › Orientación chorros', hint: '[F8] › [F1] › Inicializacion › «Orientación chorros».', check: (s, ev) => nav(ev, 'head'), key: m9Nav('head') },
        { text: 'Chorro 1.1: Orientación 8 › [ENTER]', hint: 'El 1.2 es el más retrasado (referencia, 0). Al 1.1 dale 8 tramas: «Orientacion» [TAB], escribe 8, [ENTER].', check: (s) => Math.abs(((s.hw.head.skew || 0) + (s.hw.head.orient?.j2 || 0) - (s.hw.head.orient?.j1 || 0)) / 2.8) <= 0.5 && !m9(s).dlg, key: m9Fill('head', [['val', 'type', '8']]) },
        { text: 'Imprimir y comprobar las dos líneas alineadas', hint: '▤ Línea: el desfase debe ser ≈ 0 mm.', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => Math.abs(e.twinOffset) <= 0.5) },
      ],
    },
  },
  {
    id: 12,
    title: 'Modo de disparo y fotocélula',
    area: 'Parámetros',
    lesson: 'velocidad',
    S8_CLASSIC: {
      brief: 'Los productos pasan pero no se marcan: el mensaje 02 quedó en «Manual object». Póngalo en «Object» para imprimir con la fotocélula.',
      setup(s) {
        prep(s)
        s.activeMessage = '02'
        s.messages['02'].params.trigger = 'MANUAL_OBJETO'
      },
      steps: [
        { text: 'Mensaje 02 › [PARAM] › [LEFT] → Mode', hint: '[EDIT] › [PARAM] › [LEFT] (va al último: «Mode: Manual object»).', check: (s, ev) => nav(ev, 'mode'), key: s8MsgFunc('02', 'PARAM', 'M13') },
        { text: '[CYCLE] hasta «Mode: Object»', hint: '[CYCLE] recorre Manual object → Manual auto → Object → Auto.', check: (s) => active(s).params.trigger === 'OBJETO', key: (s) => (s8(s).scr === 'M13' ? 'CYCLE' : null) },
        { text: 'Imprimir un producto por fotocélula', hint: '▤ Línea.', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => e.cause === 'PHOTOCELL') },
      ],
    },
    M9040: {
      brief: 'Los productos pasan pero no se marcan: el mensaje quedó en «MANUAL OBJECTO». Póngalo en «OBJECTO» para imprimir con la fotocélula.',
      setup(s) {
        prep(s)
        s.activeMessage = 'LOTE_A1'
        s.messages.LOTE_A1.params.trigger = 'MANUAL_OBJETO'
      },
      steps: [
        { text: 'Parámetros del mensaje en producción: [F4]', hint: '[F4].', check: (s, ev) => nav(ev, 'mode'), key: m9Nav('prodParams') },
        { text: 'Modo de disparo: OBJECTO › [ENTER]', hint: '«Modo de disparo» › [TAB] › OBJECTO › [ENTER] y [ENTER] para validar el cuadro.', check: (s) => active(s).params.trigger === 'OBJETO', key: m9Fill('prodParams', [['trigger', 'choose', 'OBJETO']]) },
        { text: 'Imprimir un producto por fotocélula', hint: '▤ Línea.', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => e.cause === 'PHOTOCELL') },
      ],
    },
  },
  {
    id: 13,
    title: 'Defecto THT (EHT): limpieza de placas',
    area: 'Defectos',
    lesson: 'eht',
    S8_CLASSIC: {
      brief: 'La impresora se detuvo con FAULT rojo. Identifique el defecto, pare, limpie y seque las placas de deflexión y vuelva a arrancar.',
      setup(s) {
        prep(s)
        s.hidden.platesDirt = 0.9
      },
      steps: [
        { text: 'Ver el defecto con [FAULT] → «EHT»', hint: '[FAULT].', check: (s, ev) => s8(s).scr === 'FAULTS' && Boolean(s.faults.EHT), key: s8Nav('faults') },
        { text: 'Parar la impresora: [ONOFF] › [Y]', hint: 'Sal con [UP], [ONOFF] pregunta «Stop? Y-N», responde [Y]. Espera «ON/OFF?».', check: (s) => s.power === 'OFF', key: (s) => (s8(s).scr === 'STOPQ' ? 'Y' : s8(s).scr === 'FAULTS' ? 'UP' : s.power === 'ON' ? 'ONOFF' : null) },
        { text: 'Limpiar las placas de deflexión (▤ Línea)', hint: '▤ Línea › «Limpiar placas con disolvente».', check: (s, ev, prev) => hasEv(prev, 'DIAG_DONE', (e) => e.step === 'CLEAN') },
        { text: 'Secar las placas (▤ Línea)', hint: '▤ Línea › «Secar con bomba de secado».', check: (s, ev, prev) => hasEv(prev, 'DIAG_DONE', (e) => e.step === 'DRY') },
        { text: 'Arrancar con [ONOFF]: READY fijo sin defecto', hint: '[ONOFF]. Al arrancar se borran los defectos cuya causa desapareció.', check: (s) => s.jetState === 'RUNNING' && !s.faults.EHT && s.live.eht >= 0.9 * s.hw.jet.ehtSet, key: (s) => (s.power === 'OFF' ? 'ONOFF' : null) },
      ],
    },
    M9040: {
      brief: 'Alarma roja y HEAD 1 parpadeando: el chorro se paró. Identifique el defecto, limpie y seque las placas de deflexión, resuélvalo y vuelva a arrancar.',
      setup(s) {
        prep(s)
        s.hidden.platesDirt = 0.9
      },
      steps: [
        { text: 'Ver el defecto con [INFO] → «THT»', hint: '(i).', check: (s) => Boolean(m9(s).defects) && Boolean(s.faults.EHT), key: m9Nav('faults') },
        { text: 'Chorro parado', hint: 'El defecto THT para el chorro solo. Si sigue en marcha: [WRENCH] › PARO CHORRO.', check: (s) => s.jetState === 'STOPPED' },
        { text: 'Limpiar las placas de deflexión (▤ Línea)', hint: '▤ Línea › «Limpiar placas con disolvente».', check: (s, ev, prev) => hasEv(prev, 'DIAG_DONE', (e) => e.step === 'CLEAN') },
        { text: 'Secar las placas (▤ Línea)', hint: '▤ Línea › «Secar».', check: (s, ev, prev) => hasEv(prev, 'DIAG_DONE', (e) => e.step === 'DRY') },
        { text: 'Resolver el defecto con [INFO]', hint: '(i) abre la lista; (i) otra vez resuelve.', check: (s) => !s.faults.EHT, key: (s) => (m9(s).defects ? 'INFO' : m9Nav('faults')(s)) },
        { text: '[WRENCH] › ARRANQUE CHORRO: en marcha con THT', hint: 'Estado chorros › ARRANQUE CHORRO.', check: (s) => s.jetState === 'RUNNING' && !s.faults.EHT && s.live.eht >= 0.9 * s.hw.jet.ehtSet, key: m9JetFunc('ARRANQUE CHORRO') },
      ],
    },
  },
  {
    id: 14,
    title: 'Corrección de la longitud del marcaje',
    area: 'Parámetros',
    lesson: 'velocidad',
    S8_CLASSIC: {
      brief: 'El texto del mensaje 02 sale estirado: la velocidad de impresión programada (0300 mm/s) no corresponde a la línea (30 m/min = 500 mm/s). Corríjala.',
      setup(s) {
        prep(s)
        s.activeMessage = '02'
        s.messages['02'].params.printSpeed = 300
      },
      steps: [
        { text: 'Mensaje 02 › [PARAM] › [RIGHT] → Printing speed (mm/s)', hint: '[EDIT] › [PARAM] › [RIGHT].', check: (s, ev) => nav(ev, 'encoder'), key: s8MsgFunc('02', 'PARAM', 'M10') },
        { text: '[DOWN], escribir 0500 y [UP]', hint: '30 m/min × 1000 / 60 = 500 mm/s.', check: (s) => s.hw.encoder.source === 'CONSTANTE' && inRange(active(s).params.printSpeed, 475, 525), key: s8SlotsAt('02', 'PARAM', 'M10', '0500') },
        { text: 'Imprimir con proporciones correctas', hint: '▤ Línea.', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => inRange(e.wf, 0.95, 1.05)) },
      ],
    },
    M9040: {
      brief: 'El texto sale estirado: la Velocidad de impresión (300 mm/s) no corresponde a la línea (30 m/min = 500 mm/s). Corríjala.',
      setup(s) {
        prep(s)
        s.activeMessage = 'LOTE_A1'
        s.messages.LOTE_A1.params.printSpeed = 300
      },
      steps: [
        { text: 'Parámetros del mensaje en producción: [F4]', hint: '[F4].', check: (s, ev) => nav(ev, 'msgParams'), key: m9Nav('prodParams') },
        { text: 'Velocidad de impresion: 500 › [ENTER]', hint: '«Velocidad de impresion» › escribe 500 › [ENTER].', check: (s) => s.hw.encoder.source === 'CONSTANTE' && inRange(active(s).params.printSpeed, 475, 525), key: m9Fill('prodParams', [['printSpeed', 'type', '500']]) },
        { text: 'Imprimir con proporciones correctas', hint: '▤ Línea.', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => inRange(e.wf, 0.95, 1.05)) },
      ],
    },
  },
  {
    id: 15,
    title: 'Cambio de turno completo',
    area: 'Integral',
    lesson: 'arranque',
    S8_CLASSIC: {
      brief: 'Relevo completo: arranque, mensaje del cliente (03), nuevo lote 5678 en el texto, hora verificada, control de gotas validado y primer producto correcto. ¡En orden!',
      setup(s) {
        prep(s, { power: 'OFF' })
        s.activeMessage = '01'
        s.hw.jet.modulation = 120
        s.messages['03'] = structuredClone(s.messages['03'])
      },
      steps: [
        { text: '1 · Arrancar y seleccionar el mensaje 03 (CLIENTE X)', hint: '[ONOFF], [EDIT], [RIGHT] hasta 03, [DOWN].', check: (s) => s.activeMessage === '03', key: s8Select('03') },
        { text: '2 · Cambiar el lote del texto: L:1234 → L:5678', hint: 'En la cabecera del 03: [CYCLE], mueve el cursor sobre el 1 de 1234 con [RIGHT] y escribe 5678 encima. [EDIT] guarda.', check: (s) => (s.messages['03']?.lines[0] || []).some((f) => f.type === 'text' && f.value.includes('L:5678')), key: s8Compose('03', 'CLIENTE X L:5678') },
        { text: '3 · Verificar la hora con [DATE]', hint: 'Desde «Function?...», [DATE].', check: (s, ev, prev) => hasEv(prev, 'RTC_VIEW'), key: s8Nav('clock') },
        { text: '4 · Control de gotas correcto y validado ([UP])', hint: '[F][FAULT][RIGHT][RIGHT][DOWN][CYCLE]; ▤ Línea › potenciómetro hasta 00111100; [UP].', check: (s, ev, prev) => hasEv(prev, 'JET_VALIDATE', (e) => e.ok), key: (s) => (s8(s).scr === 'E9' ? (s.live.phaseOk && s.live.breakoff >= 8 && s.live.breakoff <= 10 ? 'UP' : null) : s8Nav('jet')(s)) },
        { text: '5 · Primer producto del 03 impreso correctamente', hint: '▤ Línea.', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => e.msg === '03' && e.quality >= 1) },
      ],
    },
    M9040: {
      brief: 'Relevo completo: mensaje del cliente CLIENTE_X, nuevo lote, hora verificada, fase correcta, reanudar la impresión y primer producto correcto. ¡En orden!',
      setup(s) {
        prep(s)
        s.activeMessage = 'PRUEBA'
        s.hw.jet.modulation = 120
        s.paused = true
        const lote = s.opvars.find((o) => o.name === 'LOTE')
        s.mission.data = { lote0: lote ? lote.value || lote.def : '' }
      },
      steps: [
        { text: '1 · Cargar CLIENTE_X ([F1])', hint: '[F1], baja a CLIENTE_X, [ENTER].', check: (s) => s.activeMessage === 'CLIENTE_X', key: m9Select('CLIENTE_X') },
        { text: '2 · Cambiar el lote: [F6] › LOTE › [TAB] › nuevo valor › [ENTER]', hint: '[F6] (persona + AB) abre los campos de usuario.', check: (s) => { const l = s.opvars.find((o) => o.name === 'LOTE'); return Boolean(l && (l.value || l.def) !== s.mission.data.lote0) }, key: (s) => { const d = m9(s).dlg; if (d?.list !== 'user') return m9Nav('userFields')(s); if (!d.edit) return 'TAB'; return d.buf === 'B0002' ? 'ENTER' : M9.typingKey(s, 'B0002') } },
        { text: '3 · Verificar la hora (Preparación › Reloj automático)', hint: '[F8] › [F1] › Inicializacion › Reloj automático; [ESC] para salir sin cambiar.', check: (s, ev, prev) => hasEv(prev, 'RTC_VIEW'), key: m9Nav('clock') },
        { text: '4 · Fase correcta ([WRENCH] + potenciómetro) y salir con [ESC]', hint: '▤ Línea › potenciómetro hasta 00111100 en «Fase chorro1».', check: (s, ev, prev) => hasEv(prev, 'JET_VALIDATE', (e) => e.ok), key: (s) => (m9(s).status ? (s.live.phaseOk && s.live.breakoff >= 8 && s.live.breakoff <= 10 ? 'ESC' : null) : m9Nav('status')(s)) },
        { text: '5 · Reanudar la impresión: [F7] › [ENTER] sin alarmas', hint: '[F7] (pausa/reanudar) y confirma con [ENTER].', check: (s, ev, prev) => hasEv(prev, 'PRINT_START', (e) => e.faults.length === 0) && Object.keys(s.faults).length === 0, key: (s) => (m9(s).confirm ? 'ENTER' : M9.atTarget(s, 'prod') ? 'F7' : m9Nav('prod')(s)) },
        { text: '6 · Primer producto de CLIENTE_X correcto', hint: '▤ Línea.', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => e.msg === 'CLIENTE_X' && e.quality >= 1) },
      ],
    },
  },
]

// ---------------------------------------------------------------- API
export function missionsFor(machine) {
  return MISSIONS.map((m) => ({ id: m.id, title: m.title, area: m.area, lesson: m.lesson, ...m[machine] }))
}
export const missionDef = (machine, id) => missionsFor(machine).find((m) => m.id === id)
export const missionById = (id) => MISSIONS.find((m) => m.id === id)

export function missionUnlocked(s, machine) {
  return trainingStatus(s, machine).complete || Boolean(s.ui.unlocked?.[machine])
}

export function startMission(s, machine, id) {
  const def = missionDef(machine, id)
  if (!def) return
  s.lesson = null
  s.mission = { machine, id, done: def.steps.map(() => false), doneSeq: def.steps.map(() => 0), seqStart: s.seq, startedAt: Date.now(), data: {}, hints: 0 }
  def.setup(s)
  pushEvent(s, 'MISSION_START', { id })
  s.mission.seqStart = s.seq
}

export function evaluateMission(s) {
  if (!s.mission || s.mission.completedAt) return
  const def = missionDef(s.mission.machine, s.mission.id)
  if (!def || s.ui.machine !== s.mission.machine) return
  const ev = s.events.filter((e) => e.seq > s.mission.seqStart)
  for (let i = 0; i < def.steps.length; i++) {
    if (s.mission.done[i]) continue
    const prevSeq = i === 0 ? s.mission.seqStart : s.mission.doneSeq[i - 1]
    const prev = ev.filter((e) => e.seq > prevSeq)
    let ok = false
    try {
      ok = def.steps[i].check(s, ev, prev)
    } catch {
      ok = false
    }
    if (!ok) break
    s.mission.done[i] = true
    pushEvent(s, 'MISSION_STEP', { id: def.id, step: i })
    s.mission.doneSeq[i] = s.seq
  }
  if (s.mission.done.every(Boolean)) {
    const seconds = Math.round((Date.now() - s.mission.startedAt) / 1000)
    const m = s.mission.machine
    s.progress[m] = s.progress[m] || {}
    const prevBest = s.progress[m][def.id]?.best
    s.mission.completedAt = Date.now()
    s.progress[m][def.id] = { completedAt: Date.now(), seconds, best: prevBest ? Math.min(prevBest, seconds) : seconds }
    pushEvent(s, 'MISSION_DONE', { id: def.id, seconds })
  }
}

function currentMissionStep(s) {
  if (!s.mission || s.mission.completedAt) return null
  const def = missionDef(s.mission.machine, s.mission.id)
  const i = s.mission.done.findIndex((d) => !d)
  return i >= 0 ? def.steps[i] : null
}

export function missionHintText(s) {
  const st = currentMissionStep(s)
  return st ? st.hint || st.text : ''
}

export function missionHintKey(s) {
  const st = currentMissionStep(s)
  if (!st) return null
  try {
    if (st.key) return st.key(s)
    if (st.nav) return FIRMWARE[s.ui.machine].navKey(s, st.nav)
  } catch {
    return null
  }
  return null
}

export { rtcNow }
export const _internal = { has, fields }
