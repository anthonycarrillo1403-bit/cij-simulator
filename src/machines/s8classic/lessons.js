// Entrenamiento guiado del Imaje S8 Classic (Equipo A, chorro simple).
// Cada paso señala la tecla exacta y se valida solo. [TECLA] se dibuja como una tecla en la tarjeta.
import { prep } from '../../engine/scenario.js'
import { T } from '../../engine/defaults.js'
import { makeS8Message } from '../firmware.js'
import { messageHasField } from '../../engine/render.js'
import * as S8 from './firmware.js'
import { s8, s8Open, s8MsgFunc, s8Nav } from '../guide.js'

const info = (say, o = {}) => ({ say, next: true, ...o })
const fw = (s) => s8(s)
const scr = (s) => s8(s).scr
const ed = (s) => s.editing?.message
const has = (m, pred) => Boolean(m && messageHasField(m, pred))
const ev = (ctx, type, pred = () => true) => ctx.ev.some((e) => e.type === type && pred(e))
const cellsLen = (s) => (ed(s) ? S8.lineToCells(ed(s).lines[fw(s).line]).length : 0)
const atEnd = (s) => scr(s) === 'TXT' && fw(s).pos >= cellsLen(s)

// Teclas de ayuda frecuentes
const toEnd = (s) => (scr(s) !== 'TXT' ? null : fw(s).pos < cellsLen(s) ? 'RIGHT' : null)
const dateVar = (letter) => (s) => (fw(s).var === 'DATE' ? letter : 'DATE')
const postVar = (letter) => (s) => (fw(s).var === 'POST' ? letter : fw(s).var === 'DATE' ? 'P' : 'DATE')
const typeSlots = (target) => ({ type: target, done: (s) => fw(s).mod && fw(s).buf === target })
// cabecera → texto con cursor al final
const intoTextEnd = (num) => (s) => {
  const f = fw(s)
  if (f.scr === 'TXT') return toEnd(s)
  if (f.scr === 'HDR' && f.msg === num) return 'CYCLE'
  if (S8.FUNCS[f.scr] && !f.mod) return 'UP'
  return s8Open(num, 'CYCLE')(s)
}
const leaveAndSelect = (num) => (s) => {
  const f = fw(s)
  if (f.scr === 'TXT' || f.scr === 'BC') return 'EDIT'
  if (f.scr === 'HDR' && f.msg === num) return 'DOWN'
  if (f.scr === 'M19' || f.scr === 'M20' || f.scr === 'M21') return 'UP'
  return null
}

const msg05 = (s, lines) => {
  s.messages['05'] = makeS8Message('05', lines)
}

export const LESSONS_S8 = [
  {
    id: 'panel',
    title: 'Conoce el panel',
    goal: 'Para qué sirve cada tecla y cada luz',
    summary: 'Ya sabes dónde está cada tecla. En la próxima lección arrancarás la impresora.',
    setup: (s) => prep(s, { power: 'OFF' }),
    steps: [
      info('Este es el panel del **Imaje S8 Classic** (chorro simple). Para acercarte: pellizca con dos dedos, o usa los botones **⤢ Todo · 🖵 Pantalla · ⌨ Teclado** de arriba. Arrastra con un dedo para moverte.'),
      info('[ONOFF] arranca y para la impresora completa.', { key: 'ONOFF' }),
      info('Los 4 indicadores: **POWER** naranja = hay corriente · **READY** verde = chorro listo (parpadea mientras arranca) · **FAULT** rojo = defecto, el chorro se para · **ALARM** rojo = alarma (por ejemplo, falta tinta).', { region: 'leds' }),
      info('La pantalla muestra **1 línea de 40 caracteres**. Ahora dice «ON/OFF?»: la impresora está parada. Cuando estés acercado al teclado verás una copia de la pantalla arriba.', { region: 'screen' }),
      info('[EDIT] = edición de mensajes: elegir, escribir y seleccionar el mensaje que se imprime.', { key: 'EDIT' }),
      info('[DATE] = fecha y hora del reloj, y variables de fecha dentro del mensaje.', { key: 'DATE' }),
      info('[CNT] = contador de productos.', { key: 'CNT' }),
      info('[PARAM] = parámetros del mensaje: retardo, velocidad, sentido y modo de disparo.', { key: 'PARAM' }),
      info('[FAULT] = ver y anular defectos. Con [F] delante, abre el mantenimiento del chorro (arrancar/parar chorro, control de gotas…).', { key: 'FAULT' }),
      info('[AA] = estilo de los caracteres: negrita, fuente y código de barras.', { key: 'AA' }),
      info('[UP] = salir de una función, o borrar el carácter donde está el cursor.', { key: 'UP' }),
      info('[DOWN] = entrar a modificar un valor, seleccionar el mensaje a imprimir, o abrir un espacio en el texto.', { key: 'DOWN' }),
      info('[LEFT] y [RIGHT] = pasar a la función vecina o mover el cursor.', { key: 'RIGHT' }),
      info('[CYCLE] = cambiar una opción (Sí/No, tipo…) y, en la biblioteca, entrar al texto del mensaje.', { key: 'CYCLE' }),
      info('[F] y [ALT] dan acceso a los símbolos pequeños de cada tecla: con [F] el de la esquina inferior derecha (por ejemplo [F] + [MINUS] = _ ).', { key: 'F' }),
    ],
  },
  {
    id: 'arranque',
    title: 'Arrancar y parar la impresora',
    goal: 'ON/OFF, READY y paro con limpieza',
    summary: 'Arrancar: ON/OFF y esperar READY fijo. Parar: ON/OFF › Y y esperar «Wait 2 mn».',
    setup: (s) => prep(s, { power: 'OFF' }),
    steps: [
      { say: 'La pantalla dice «ON/OFF?». Presiona [ONOFF] para arrancar.', key: 'ONOFF', done: (s) => s.power !== 'OFF' },
      { say: 'Arrancando: el chorro se pone en marcha solo. **READY parpadea** mientras se estabiliza. Espera…', done: (s) => s.jetState === 'RUNNING' },
      info('**READY verde fijo** = chorro listo para imprimir. «Function?...» es la pantalla de reposo desde donde se llega a todo.', { region: 'leds' }),
      { say: 'Ahora vamos a pararla. Presiona [ONOFF].', key: 'ONOFF', done: (s) => scr(s) === 'STOPQ' },
      { say: 'Pregunta «Stop? Y-N». Presiona [Y] para confirmar (con [N] se cancela).', key: 'Y', done: (s) => s.power === 'STOPPING' || s.power === 'OFF' },
      { say: '«Wait 2 mn»: secuencia de paro con limpieza de la boquilla. Espera a ver «ON/OFF?».', done: (s) => s.power === 'OFF' },
      { say: 'Vuelve a arrancar con [ONOFF] y espera READY fijo.', key: (s) => (s.power === 'OFF' ? 'ONOFF' : null), done: (s) => s.jetState === 'RUNNING' },
    ],
  },
  {
    id: 'seleccion',
    title: 'Seleccionar el mensaje a imprimir',
    goal: 'Biblioteca, número de mensaje y asterisco *',
    summary: '[EDIT] abre la biblioteca, ◄ ► elige el número y ▼ lo selecciona (*).',
    setup: (s) => {
      prep(s)
      s.activeMessage = '01'
    },
    steps: [
      { say: 'Presiona [EDIT] para abrir la biblioteca de mensajes.', key: 'EDIT', done: (s) => scr(s) === 'HDR' },
      info('«01Head 1.1* ◆ IMAJE S8 CLASSIC ◆»: **01** = número de mensaje · **Head 1.1** = cabezal 1, chorro 1 · ***** = es el que se imprime · entre ◆ ◆ el comienzo del texto.', { region: 'screen' }),
      { say: 'Pasa al mensaje **02** con [RIGHT].', key: (s) => (fw(s).msg !== '02' ? 'RIGHT' : null), done: (s) => fw(s).msg === '02' },
      { say: 'Presiona [DOWN] para seleccionarlo: el asterisco * pasa al 02.', key: 'DOWN', done: (s) => s.activeMessage === '02' },
      { say: 'Sal a «Function?...» con [EDIT].', key: 'EDIT', done: (s) => scr(s) === 'HOME' },
      { say: 'Abre **▤ Línea** (botón de arriba a la derecha) y mira el producto: lleva «LOTE A1» y el día juliano.', drawer: 'product', done: (s) => s.prints[0]?.msg === '02' },
    ],
  },
  {
    id: 'texto',
    title: 'Escribir un mensaje nuevo',
    goal: 'Entrar al texto, escribir, corregir y guardar',
    summary: 'Texto: [CYCLE] para entrar, escribir, ▲ borra, ▼ abre un espacio, [EDIT] guarda.',
    setup: (s) => {
      prep(s)
      delete s.messages['05']
      s.activeMessage = '01'
    },
    steps: [
      { say: 'Presiona [EDIT] y luego [RIGHT] hasta el mensaje **05** (vacío: ◆ ◆).', key: s8Open('05'), done: (s) => scr(s) === 'HDR' && fw(s).msg === '05' },
      { say: 'Presiona [CYCLE] para entrar al texto. El cursor parpadea debajo.', key: 'CYCLE', done: (s) => scr(s) === 'TXT' },
      { say: 'Escribe el texto con el teclado. El espacio es la barra larga.', type: 'PRUEBA 1', done: (s) => S8.input(s) === 'PRUEBA 1' },
      info('Para corregir: [LEFT] y [RIGHT] mueven el cursor, [UP] borra el carácter de encima del cursor, [DOWN] abre un espacio. Escribir encima de una letra la reemplaza.'),
      { say: 'Presiona [EDIT] para salir del texto: el mensaje queda memorizado.', key: 'EDIT', done: (s) => scr(s) === 'HDR' },
      { say: 'Presiona [DOWN] para seleccionarlo (aparece *).', key: 'DOWN', done: (s) => s.activeMessage === '05' },
      { say: 'Vuelve a «Function?...» con [EDIT].', key: 'EDIT', done: (s) => scr(s) === 'HOME' },
    ],
  },
  {
    id: 'fecha',
    title: 'Fecha de fabricación en el mensaje',
    goal: 'Variables dd/mm/yy con la tecla de fecha',
    summary: 'En el texto, [DATE] + letra inserta una variable: D día, M mes, Y año, H hora, N minutos, J día juliano.',
    setup: (s) => {
      prep(s)
      msg05(s, [[T('FAB ')]])
      s.activeMessage = '01'
    },
    steps: [
      { say: 'Abre el mensaje 05 y entra al texto: [EDIT], [RIGHT] hasta 05 y [CYCLE].', key: intoTextEnd('05'), done: (s) => scr(s) === 'TXT' && fw(s).msg === '05' },
      { say: 'Lleva el cursor al final del texto con [RIGHT].', key: toEnd, done: atEnd },
      { say: 'Presiona [DATE]: la pantalla pide la variable «(H N S D M Y W X Z P J E)».', key: 'DATE', done: (s) => fw(s).var === 'DATE' },
      { say: 'Presiona [D] = día del mes. Aparece **dd**.', key: 'D', done: (s) => has(ed(s), (f) => f.type === 'date' && f.format === 'DD') },
      { say: 'Escribe la barra «/».', type: 'FAB dd/', done: (s) => S8.input(s) === 'FAB dd/' },
      { say: '[DATE] y luego [M] = mes → **mm**.', key: dateVar('M'), done: (s) => has(ed(s), (f) => f.type === 'date' && f.format === 'MM') },
      { say: 'Otra barra «/».', type: 'FAB dd/mm/', done: (s) => S8.input(s) === 'FAB dd/mm/' },
      { say: '[DATE] y luego [Y] = año → **yy**.', key: dateVar('Y'), done: (s) => has(ed(s), (f) => f.type === 'date' && f.format === 'YY') },
      { say: 'Sal con [EDIT] y selecciona el mensaje con [DOWN].', key: leaveAndSelect('05'), done: (s) => s.activeMessage === '05' && has(s.messages['05'], (f) => f.type === 'date' && f.format === 'YY') },
      { say: 'Abre **▤ Línea**: el producto lleva la fecha de hoy.', drawer: 'product', done: (s) => s.prints[0]?.msg === '05' },
    ],
  },
  {
    id: 'caducidad',
    title: 'Fecha de caducidad (postdate)',
    goal: 'Duración en días + variables pd/pm/py',
    summary: 'Caducidad = [DATE] en la cabecera (Duration) + en el texto [DATE] [P] [D/M/Y].',
    setup: (s) => {
      prep(s)
      msg05(s, [[T('CAD ')]])
      s.activeMessage = '01'
    },
    steps: [
      { say: 'Abre el mensaje 05: [EDIT] y [RIGHT] hasta 05.', key: s8Open('05'), done: (s) => scr(s) === 'HDR' && fw(s).msg === '05' },
      { say: 'Con la cabecera en pantalla presiona [DATE]: «Duration: 0000P (DMY)» = días hasta la caducidad.', key: 'DATE', done: (s) => scr(s) === 'M29' },
      { say: 'Presiona [DOWN] para modificar (la cifra parpadea).', key: 'DOWN', done: (s) => fw(s).mod },
      { say: 'Escribe **0365** con el teclado numérico.', ...typeSlots('0365') },
      { say: 'Presiona [UP] para confirmar. A la derecha ves la fecha de caducidad resultante.', key: 'UP', done: (s) => !fw(s).mod && ed(s)?.expiry.amount === 365 },
      { say: '[UP] vuelve a la cabecera y [CYCLE] entra al texto. Lleva el cursor al final.', key: intoTextEnd('05'), done: atEnd },
      { say: '[DATE], [P] (postdate) y [D] → **pd** = día de caducidad.', key: postVar('D'), done: (s) => has(ed(s), (f) => f.type === 'expiry' && f.format === 'DD') },
      { say: 'Escribe la barra «/».', type: 'CAD pd/', done: (s) => S8.input(s) === 'CAD pd/' },
      { say: '[DATE], [P] y [M] → **pm** = mes de caducidad.', key: postVar('M'), done: (s) => has(ed(s), (f) => f.type === 'expiry' && f.format === 'MM') },
      { say: 'Otra barra «/».', type: 'CAD pd/pm/', done: (s) => S8.input(s) === 'CAD pd/pm/' },
      { say: '[DATE], [P] y [Y] → **py** = año de caducidad.', key: postVar('Y'), done: (s) => has(ed(s), (f) => f.type === 'expiry' && f.format === 'YY') },
      { say: 'Sal con [EDIT] y selecciona con [DOWN].', key: leaveAndSelect('05'), done: (s) => s.activeMessage === '05' && s.messages['05'].expiry.amount === 365 },
    ],
  },
  {
    id: 'reloj',
    title: 'Ajustar la hora del reloj',
    goal: 'Time (HMS), RUN y fecha',
    summary: '[DATE] › [DOWN] › cifras › [UP]. En RUN el reloj sigue avanzando desde la nueva hora.',
    setup: (s) => prep(s),
    steps: [
      { say: 'Presiona [DATE]: «Time (HMS) : hh.mm.ss RUN». RUN = el reloj corre.', key: 'DATE', done: (s) => scr(s) === 'I1' },
      { say: 'Presiona [DOWN] para modificar.', key: 'DOWN', done: (s) => fw(s).mod },
      { say: 'Escribe la hora **14:30:00** con las cifras (los puntos los pone la máquina). [RIGHT] salta una cifra.', ...typeSlots('143000') },
      { say: 'Presiona [UP] para confirmar: el reloj sigue corriendo desde 14:30:00.', key: 'UP', done: (s, c) => ev(c, 'RTC_SET', (e) => e.h === 14 && e.m === 30) },
      { say: '[RIGHT] muestra la fecha «Date (DMY)» (se cambia igual, con [DOWN]).', key: 'RIGHT', done: (s) => scr(s) === 'I2' },
      { say: 'Sal con [UP].', key: 'UP', done: (s) => scr(s) === 'HOME' },
    ],
  },
  {
    id: 'turno',
    title: 'Código de turno automático',
    goal: 'S (inicio), I (intervalo) y variable ee',
    summary: 'Turno = cabecera › [DATE] › [RIGHT] (S, I, tipo) + en el texto [DATE] [E].',
    setup: (s) => {
      prep(s)
      msg05(s, [[T('T')]])
      s.activeMessage = '01'
    },
    steps: [
      { say: 'Abre el mensaje 05: [EDIT] y [RIGHT] hasta 05.', key: s8Open('05'), done: (s) => scr(s) === 'HDR' && fw(s).msg === '05' },
      { say: 'Presiona [DATE] y luego [RIGHT]: «S: hh: mm I: hh: mm tipo».', key: s8MsgFunc('05', 'DATE', 'M30'), done: (s) => scr(s) === 'M30' },
      info('**S** = hora de inicio del primer turno · **I** = duración de cada turno · tipo **01** = números (01, 02, 03) o **A** = letras (A, B, C). Con S 07:00 e I 08:00: 07-15 = 01, 15-23 = 02, 23-07 = 03.'),
      { say: 'Presiona [DOWN] para modificar.', key: 'DOWN', done: (s) => fw(s).mod },
      { say: 'Escribe **0700** (inicio) y **0800** (intervalo).', ...typeSlots('07000800') },
      { say: 'Presiona [CYCLE] hasta que el tipo sea **01**.', key: 'CYCLE', done: (s) => ed(s)?.shift.type === '01' },
      { say: 'Presiona [UP] para confirmar.', key: 'UP', done: (s) => !fw(s).mod && ed(s)?.shift.start === '07:00' && ed(s).shift.interval === '08:00' },
      { say: '[UP] vuelve a la cabecera, [CYCLE] entra al texto; lleva el cursor al final.', key: intoTextEnd('05'), done: atEnd },
      { say: '[DATE] y [E] insertan el código de turno (**ee**).', key: dateVar('E'), done: (s) => has(ed(s), (f) => f.type === 'shift') },
      { say: 'Sal con [EDIT] y selecciona con [DOWN].', key: leaveAndSelect('05'), done: (s) => s.activeMessage === '05' && has(s.messages['05'], (f) => f.type === 'shift') },
    ],
  },
  {
    id: 'contador',
    title: 'Contador de productos',
    goal: 'Valores inicial/final, insertar y poner a cero',
    summary: 'Contador = cabecera › [CNT] (batch, step, start, final) + en el texto [CNT]. Desde reposo, [CNT] muestra y resetea.',
    setup: (s) => {
      prep(s)
      msg05(s, [[T('N.')]])
      s.activeMessage = '01'
    },
    steps: [
      { say: 'Abre el mensaje 05: [EDIT] y [RIGHT] hasta 05.', key: s8Open('05'), done: (s) => scr(s) === 'HDR' && fw(s).msg === '05' },
      { say: 'Presiona [CNT]: «Counter batch» = cada cuántos productos sube el contador.', key: 'CNT', done: (s) => scr(s) === 'M24' },
      { say: '[RIGHT] → «Step counter» = de cuánto en cuánto sube.', key: 'RIGHT', done: (s) => scr(s) === 'M25' },
      { say: '[RIGHT] → «Start value» = valor inicial.', key: 'RIGHT', done: (s) => scr(s) === 'M26' },
      { say: 'Presiona [DOWN] para modificar.', key: 'DOWN', done: (s) => fw(s).mod },
      { say: 'Escribe **000000001**.', ...typeSlots('000000001') },
      { say: '[UP] confirma.', key: 'UP', done: (s) => !fw(s).mod && ed(s)?.counter.start === 1 },
      { say: '[RIGHT] → «Final value» = valor final (después vuelve al inicial).', key: 'RIGHT', done: (s) => scr(s) === 'M27' },
      { say: 'Presiona [DOWN] para modificar.', key: 'DOWN', done: (s) => fw(s).mod },
      { say: 'Escribe **000000500**.', ...typeSlots('000000500') },
      { say: '[UP] confirma.', key: 'UP', done: (s) => !fw(s).mod && ed(s)?.counter.end === 500 },
      { say: '[UP] cabecera, [CYCLE] texto, cursor al final.', key: intoTextEnd('05'), done: atEnd },
      { say: 'Presiona [CNT]: inserta el contador (ccccccccc).', key: 'CNT', done: (s) => has(ed(s), (f) => f.type === 'counter') },
      { say: 'Sal con [EDIT] y selecciona con [DOWN].', key: leaveAndSelect('05'), done: (s) => s.activeMessage === '05' && has(s.messages['05'], (f) => f.type === 'counter') },
      { say: '[EDIT] a «Function?...» y luego [CNT]: «Jet 1 C:» = valor actual del contador.', key: (s) => (scr(s) === 'HDR' ? 'EDIT' : 'CNT'), done: (s) => scr(s) === 'I10' },
      { say: 'Para ponerlo a cero: [DOWN] y luego [CYCLE].', key: (s) => (fw(s).opt.armed ? 'CYCLE' : 'DOWN'), done: (s, c) => ev(c, 'COUNTER_RESET') },
      { say: 'Sal con [UP].', key: 'UP', done: (s) => scr(s) === 'HOME' },
    ],
  },
  {
    id: 'velocidad',
    title: 'Retardo, velocidad, tacómetro y modo',
    goal: 'Parámetros del mensaje con [PARAM]',
    summary: '[PARAM]: Printing delay (posición), Printing speed / Tachy (longitud), sentidos y Mode (disparo).',
    setup: (s) => {
      prep(s)
      s.activeMessage = '02'
      s.messages['02'] = structuredClone(s.messages['02'])
      s.messages['02'].params.trigger = 'MANUAL_OBJETO'
    },
    steps: [
      { say: 'Presiona [EDIT] (se abre en el 02, el seleccionado) y luego [PARAM]: «Printing delay: A R I».', key: s8MsgFunc('02', 'PARAM', 'M9'), done: (s) => scr(s) === 'M9' },
      info('**A** = distancia en mm de la fotocélula al comienzo del marcaje (mueve el marcaje en la caja). R = retorno, I = intervalo en modo Auto.'),
      { say: 'Presiona [DOWN] para modificar.', key: 'DOWN', done: (s) => fw(s).mod },
      { say: 'Escribe A **0080**, R **0050**, I **0100**.', ...typeSlots('008000500100') },
      { say: '[UP] confirma.', key: 'UP', done: (s) => !fw(s).mod && ed(s)?.params.delayFwd === 80 },
      { say: '[RIGHT] → «Printing speed (mm/s)» = velocidad de la línea (30 m/min = 0500).', key: 'RIGHT', done: (s) => scr(s) === 'M10' },
      { say: 'Si la línea tiene tacómetro (encoder): [DOWN] y luego [CYCLE] cambian a «Tachy».', key: (s) => (fw(s).mod ? 'CYCLE' : 'DOWN'), done: (s) => s.hw.encoder.source === 'ENCODER' },
      { say: 'Escribe la división **0015**.', ...typeSlots('0015') },
      { say: '[UP] confirma.', key: 'UP', done: (s) => !fw(s).mod && s.hw.encoder.division === 15 },
      { say: '[LEFT] dos veces → «Mode» (modo de disparo).', key: 'LEFT', done: (s) => scr(s) === 'M13' },
      info('Modos: **Manual object** = una impresión con cada [SPACE] · Manual auto · **Object** = una impresión por cada producto que ve la fotocélula · Auto = repetitivo.'),
      { say: 'Presiona [CYCLE] hasta «Mode: Object».', key: 'CYCLE', done: (s) => ed(s)?.params.trigger === 'OBJETO' },
      { say: '[UP] vuelve a la cabecera y [EDIT] a «Function?...».', key: (s) => (scr(s) === 'HDR' ? 'EDIT' : 'UP'), done: (s) => scr(s) === 'HOME' },
    ],
  },
  {
    id: 'defectos',
    title: 'Alarmas, defectos y estado del chorro',
    goal: '[FAULT], anular, [F]+[FAULT] mantenimiento',
    summary: '[FAULT] muestra y anula. [F] [FAULT] = mantenimiento: Jet On/Stop, control de gotas, presión…',
    setup: (s) => {
      prep(s)
      s.hidden.inkLevel = 6
    },
    steps: [
      { say: 'El LED **ALARM** está encendido. Presiona [FAULT] para ver qué pasa.', key: 'FAULT', done: (s) => scr(s) === 'FAULTS' },
      info('«Ink tank level low.» = falta tinta. Las **alarmas** (ALARM) avisan pero no paran; los **defectos** (FAULT) paran el chorro. Con [LEFT] [RIGHT] se ven los demás.', { region: 'screen' }),
      { say: 'Abre **▤ Línea** › «Rellenar tinta» (máximo medio depósito).', drawer: 'ink', done: (s) => s.hidden.inkLevel > 10 },
      { say: 'Presiona [FAULT] otra vez para anular lo memorizado.', key: 'FAULT', done: (s, c) => ev(c, 'FAULT_ACK') && Object.keys(s.faults).length === 0 },
      { say: '[F] y luego [FAULT] = mantenimiento: «Status jet».', key: (s) => (fw(s).pre === 'F' ? 'FAULT' : scr(s) === 'HOME' ? 'F' : 'UP'), done: (s) => scr(s) === 'E1' },
      { say: '[DOWN] → «Jet: On». Con [CYCLE] se para o arranca solo el chorro (ahora no lo hagas).', key: 'DOWN', done: (s) => scr(s) === 'E2' },
      { say: '[UP] vuelve a «Status jet»; [LEFT] tres veces → «Vm P µ Vj»: presión y velocidad del chorro.', key: s8Nav('visco'), done: (s) => scr(s) === 'E11' },
      { say: 'Sal con [UP].', key: 'UP', done: (s) => scr(s) === 'HOME' },
    ],
  },
  {
    id: 'quiebra',
    title: 'Punto de quiebra (control de gotas)',
    goal: 'Jet 1: 00111100 y potenciómetro',
    summary: 'Control de gotas: [F][FAULT] ► ► [DOWN] [CYCLE]. Correcto = 3-4 unos seguidos. Se ajusta con el potenciómetro del cabezal.',
    setup: (s) => {
      prep(s)
      s.hw.jet.modulation = 95
    },
    steps: [
      { say: '[F] y [FAULT] → «Status jet».', key: s8Nav('service'), done: (s) => scr(s) === 'E1' },
      { say: '[RIGHT] dos veces → «Jet 1: Dc 20.0 m/s» (velocidad del chorro).', key: 'RIGHT', done: (s) => scr(s) === 'E8' },
      { say: '[DOWN] y luego [CYCLE] → control de gotas «Jet 1: xxxxxxxx».', key: (s) => (fw(s).opt.e8armed ? 'CYCLE' : 'DOWN'), done: (s) => scr(s) === 'E9' },
      info('Correcto = **3 ó 4 unos seguidos** (00111100). Ahora sale desordenado: el punto donde el chorro se rompe en gotas no está en el electrodo de carga.', { region: 'screen' }),
      { say: 'Abre **▤ Línea** › «Potenciómetro de quiebra» y gíralo con ‹ › hasta ver 00111100.', drawer: 'pot', done: (s) => s.live.breakoff >= 8 && s.live.breakoff <= 10 && s.live.phaseOk },
      { say: 'Espera 5 segundos sin tocar (fase estable).', done: (s) => s.live.phaseStableMs >= 5000 },
      { say: 'Presiona [UP]: sale del control de gotas y valida.', key: 'UP', done: (s, c) => ev(c, 'JET_VALIDATE', (e) => e.ok) },
    ],
  },
  {
    id: 'centrado',
    title: 'Centrar el chorro en el canal',
    goal: 'Inhibir Vacuum, levas, reactivar',
    summary: 'E7 «Vacuum: No» → arrancar chorro → levas del cañón hasta Canal OK → «Vacuum: Yes».',
    setup: (s) => {
      prep(s, { power: 'ON', jet: 'STOPPED' })
      s.hidden.biasX = 70
      s.hidden.biasY = -40
    },
    steps: [
      { say: '[F] [FAULT] y [RIGHT] → «Fault: Cover Yes Vacuum: Yes» (vigilancia de la tapa y de la recuperación).', key: s8Nav('faultInhibit'), done: (s) => scr(s) === 'E7' },
      { say: '[DOWN] para modificar, [RIGHT] al campo **Vacuum** y [CYCLE] → No.', key: (s) => (!fw(s).mod ? 'DOWN' : fw(s).cur !== 1 ? 'RIGHT' : 'CYCLE'), done: (s) => s.hw.faultInhibit.recup },
      { say: 'Presiona [UP] para confirmar.', key: 'UP', done: (s) => !fw(s).mod },
      { say: 'Arranca el chorro: [LEFT] a «Status jet», [DOWN] → «Jet: Stop» y [CYCLE] → «Jet: On».', key: (s) => (scr(s) === 'E2' ? 'CYCLE' : scr(s) === 'E1' ? 'DOWN' : scr(s) === 'E7' ? 'LEFT' : s8Nav('jetStatus')(s)), done: (s) => s.jetState === 'RUNNING' || s.jetState === 'STARTING' },
      { say: 'Abre **▤ Línea** › «Levas del cañón»: horizontal y vertical hasta «Canal: OK».', drawer: 'cams', done: (s) => s.live.gutterOk && s.jetState === 'RUNNING' },
      { say: 'Reactiva la vigilancia: vuelve a «Fault: …» y pon **Vacuum: Yes**.', key: (s) => (scr(s) !== 'E7' ? s8Nav('faultInhibit')(s) : !fw(s).mod ? 'DOWN' : fw(s).cur !== 1 ? 'RIGHT' : 'CYCLE'), done: (s) => !s.hw.faultInhibit.recup },
      { say: 'Confirma con [UP].', key: 'UP', done: (s) => !fw(s).mod && s.jetState === 'RUNNING' },
    ],
  },
  {
    id: 'eht',
    title: 'Defecto EHT: limpiar y secar placas',
    goal: 'Diagnóstico, paro, limpieza y rearranque',
    summary: 'EHT = fuga de alta tensión: parar, limpiar y secar las placas de deflexión, volver a arrancar.',
    setup: (s) => {
      prep(s)
      s.hidden.platesDirt = 0.9
    },
    steps: [
      { say: 'FAULT rojo: el chorro se ha parado solo. Presiona [FAULT].', key: 'FAULT', done: (s, c) => scr(s) === 'FAULTS' && Boolean(s.faults.EHT) },
      info('«EHT» = la alta tensión de las placas de deflexión tiene fugas: placas sucias de tinta o húmedas.', { region: 'screen' }),
      { say: 'Para la impresora: [UP], [ONOFF] y [Y].', key: (s) => (scr(s) === 'STOPQ' ? 'Y' : scr(s) === 'FAULTS' ? 'UP' : s.power === 'ON' ? 'ONOFF' : null), done: (s) => s.power === 'OFF' },
      { say: 'Abre **▤ Línea** › Placas: «Limpiar placas con disolvente».', drawer: 'plates', done: (s, c) => ev(c, 'DIAG_DONE', (e) => e.step === 'CLEAN') },
      { say: 'Ahora «Secar con bomba de secado» (con las placas húmedas también hay fuga).', drawer: 'plates', done: (s, c) => ev(c, 'DIAG_DONE', (e) => e.step === 'DRY') },
      { say: 'Arranca con [ONOFF] y espera READY fijo, sin FAULT.', key: (s) => (s.power === 'OFF' ? 'ONOFF' : null), done: (s) => s.jetState === 'RUNNING' && !s.faults.EHT },
    ],
  },
  {
    id: 'barras',
    title: 'Código de barras',
    goal: '2/5 entrelazado y Code 39 con [AA] [C]',
    summary: 'Código: en el texto [AA] [C], datos dentro, [PARAM] tipo (2/5 int / Code 39), [CNT] = contador.',
    setup: (s) => {
      prep(s)
      delete s.messages['05']
      s.activeMessage = '01'
    },
    steps: [
      { say: 'Abre el mensaje 05 y entra al texto: [EDIT], [RIGHT] hasta 05, [CYCLE].', key: intoTextEnd('05'), done: (s) => scr(s) === 'TXT' && fw(s).msg === '05' },
      { say: 'Presiona [AA]: «Variable: (B,M,C,L,→,dIN)».', key: 'AA', done: (s) => fw(s).var === 'AA' },
      { say: 'Presiona [C] = código de barras (aparece ⇕⇕).', key: 'C', done: (s) => scr(s) === 'BC' },
      { say: 'Escribe los datos del código (2/5 entrelazado solo admite cifras).', type: '12345', done: (s) => S8.input(s) === '12345' },
      { say: '[PARAM] → «Bar code type: 2/5 int»; [CYCLE] cambia a **Code 39**.', key: (s) => (scr(s) === 'BC' ? 'PARAM' : 'CYCLE'), done: (s) => has(ed(s), (f) => f.type === 'barcode' && f.symbology === 'CODE39') },
      { say: '[UP] vuelve al código, [EDIT] sale al texto, [EDIT] a la cabecera y [DOWN] selecciona.', key: leaveAndSelect('05'), done: (s) => s.activeMessage === '05' && has(s.messages['05'], (f) => f.type === 'barcode') },
      { say: 'Abre **▤ Línea**: mira el código de barras impreso.', drawer: 'product', done: (s) => s.prints[0]?.msg === '05' },
    ],
  },
]
