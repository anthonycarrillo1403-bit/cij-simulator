// Entrenamiento guiado del Markem-Imaje 9040 bichorro (Equipo B, doble chorro).
import { prep } from '../../engine/scenario.js'
import { makeMessage, T } from '../../engine/defaults.js'
import { messageHasField } from '../../engine/render.js'
import * as M9 from './firmware.js'
import { m9, m9Nav, m9Select, m9JetFunc, m9Choose, m9Type, m9Check } from '../guide.js'

const info = (say, o = {}) => ({ say, next: true, ...o })
const fw = (s) => m9(s)
const ed = (s) => s.editing?.message
const has = (m, pred) => Boolean(m && messageHasField(m, pred))
const ev = (ctx, type, pred = () => true) => ctx.ev.some((e) => e.type === type && pred(e))
const at = (name) => (s) => M9.atTarget(s, name)
const dlgV = (s, k) => fw(s).dlg?.v?.[k]
const inEdit = (s) => fw(s).mode === 'EDIT'
// desde Edición, la tecla para cargar la impresora (F7) cerrando lo que estorbe
const loadKey = (s) => (fw(s).dlg ? 'ESC' : fw(s).focus === 'pull' ? 'ESC' : 'F7')
// abrir la edición del mensaje en producción (F3)
const editProd = (s) => (inEdit(s) ? null : M9.navKey(s, 'text'))

function setupMsg(s, name, lines) {
  s.messages[name] = makeMessage(name, lines)
  s.activeMessage = name
}

export const LESSONS_9040 = [
  {
    id: 'panel',
    title: 'Conoce el panel',
    goal: 'Pantalla, teclas de función, cruceta y teclado',
    summary: 'Ya conoces el panel del 9040. Ahora arrancarás la impresora.',
    setup: (s) => prep(s, { power: 'ON', jet: 'STOPPED' }),
    steps: [
      info('Este es el panel del **Markem-Imaje 9040 bichorro** (doble chorro). Para acercarte: pellizca con dos dedos o usa **⤢ Todo · 🖵 Pantalla · ⌨ Teclado**. Arrastra con un dedo para moverte.'),
      info('[ONOFF] (naranja) arranca y para la impresora completa. Al lado: LED amarillo = corriente; LEDs rojos = nivel bajo de **aditivo** y de **tinta**.', { key: 'ONOFF' }),
      info('LED **HEAD 1** verde: fijo = listo para imprimir, parpadeando = defecto, apagado = parado. El LED rojo con el triángulo avisa de defectos y alarmas.', { region: 'leds' }),
      info('La pantalla: arriba el estado («ON»), el título del menú y la hora; debajo la **barra de menús**; en el centro el mensaje en producción; abajo los **iconos de F1 a F8**.', { region: 'screen' }),
      info('Cada tecla [F1] … [F8] hace lo que muestra el icono justo encima. En Producción: F1 seleccionar mensaje, F2 nuevo, F3 modificar, F4 parámetros, F5 contadores, F6 campos de usuario, F7 pausa, F8 otros menús.', { key: 'F1' }),
      info('La [WRENCH] (llave) muestra el estado del cabezal y las funciones del chorro (arrancar, parar, ajuste…).', { key: 'WRENCH' }),
      info('La tecla [INFO] muestra los defectos y alarmas, y los resuelve.', { key: 'INFO' }),
      info('La cruceta [UP] [DOWN] [LEFT] [RIGHT] mueve por los menús y los campos. [ENTER] valida, [ESC] cancela o sale, [TAB] abre una lista, entra a escribir un dato o marca una casilla.', { region: 'nav' }),
      info('El teclado escribe textos. [SHIFT] da mayúsculas y los símbolos morados (en la pantalla táctil funciona para la siguiente tecla). [CAPS] fija mayúsculas.', { region: 'keyboard' }),
    ],
  },
  {
    id: 'arranque',
    title: 'Arrancar y parar la impresora',
    goal: 'ON/OFF, HEAD 1 y tipo de paro',
    summary: 'Arrancar: ON/OFF y esperar HEAD 1 fijo. Parar: ON/OFF › Paro largo (SÍ) con limpieza.',
    setup: (s) => prep(s, { power: 'OFF' }),
    steps: [
      { say: 'La impresora está parada (pantalla apagada, solo el LED amarillo). Presiona [ONOFF].', key: 'ONOFF', done: (s) => s.power !== 'OFF' },
      { say: 'Arranca el circuito de tinta y luego los chorros (Modo de arranque automático). **HEAD 1 parpadea**… espera.', done: (s) => s.jetState === 'RUNNING' },
      info('**HEAD 1 verde fijo** = listo para imprimir. Arriba a la izquierda de la pantalla: «ON».', { region: 'leds' }),
      { say: 'Para parar: presiona [ONOFF]. Aparece «Selección del tipo de paro».', key: 'ONOFF', done: (s) => Boolean(fw(s).confirm) },
      { say: 'SÍ = **paro largo** (limpia el cabezal, para paradas largas); NO = paro corto. Deja SÍ marcado y presiona [ENTER].', key: 'ENTER', done: (s) => s.power === 'STOPPING' || s.power === 'OFF' },
      { say: 'Secuencia de paro en curso… espera a que se apague.', done: (s) => s.power === 'OFF' },
      { say: 'Vuelve a arrancar con [ONOFF] y espera HEAD 1 fijo.', key: (s) => (s.power === 'OFF' ? 'ONOFF' : null), done: (s) => s.jetState === 'RUNNING' },
    ],
  },
  {
    id: 'seleccion',
    title: 'Seleccionar el mensaje a imprimir',
    goal: 'F1 Selección mensajes',
    summary: '[F1] abre la lista, ▲▼ eligen, [ENTER] envía a producción. Abajo se ve «Cabezal 1: NOMBRE».',
    setup: (s) => {
      prep(s)
      s.activeMessage = 'PRUEBA'
    },
    steps: [
      { say: 'Presiona [F1] (icono de las tres hojas): «Seleccionar y enviar un mensaje en producción».', key: m9Nav('select'), done: (s) => fw(s).dlg?.list === 'select' },
      info('La lista muestra los mensajes de la memoria; el asterisco * marca el que está en producción. A la izquierda se ve el nombre del resaltado.', { region: 'screen' }),
      { say: 'Muévete con [UP] / [DOWN] hasta **LOTE_A1** (la barra negra).', key: (s) => { const d = fw(s).dlg; if (!d) return null; const i = d.items.indexOf('LOTE_A1'); return d.cur === i ? null : d.cur < i ? 'DOWN' : 'UP' }, done: (s) => { const d = fw(s).dlg; return Boolean(d && d.items[d.cur] === 'LOTE_A1') } },
      { say: 'Presiona [ENTER] para ponerlo en producción.', key: 'ENTER', done: (s) => s.activeMessage === 'LOTE_A1' },
      info('Abajo en la pantalla: «Cabezal 1: LOTE_A1». En el centro, la vista previa del marcaje.', { region: 'screen' }),
      { say: 'Abre **▤ Línea** y mira el producto marcado.', drawer: 'product', done: (s) => s.prints[0]?.msg === 'LOTE_A1' },
    ],
  },
  {
    id: 'texto',
    title: 'Crear un mensaje de dos líneas',
    goal: 'F2 nuevo, escribir en los 2 chorros, F7 cargar',
    summary: '[F2] nombre › escribir › [DOWN] segunda línea (chorro 2) › [F7] cargar › [F8] volver.',
    setup: (s) => {
      prep(s)
      delete s.messages.PRUEBA2
    },
    steps: [
      { say: 'Presiona [F2] (hoja en blanco) para crear un mensaje.', key: m9Nav('newmsg'), done: (s) => fw(s).dlg?.form === 'newmsg' },
      { say: 'Escribe el nombre **PRUEBA2** (máx. 8 caracteres).', type: 'PRUEBA2', done: (s) => fw(s).dlg?.buf === 'PRUEBA2' },
      { say: 'Presiona [ENTER]: se abre la zona de edición vacía (el nombre aparece arriba a la derecha).', key: 'ENTER', done: (s) => inEdit(s) && ed(s)?.name === 'PRUEBA2' },
      info('A la izquierda hay **dos barras**: arriba la zona del **chorro 1**, abajo la del **chorro 2**. El cursor parpadea donde vas a escribir.', { region: 'screen' }),
      { say: 'Escribe la primera línea.', type: 'HOLA 9040', done: (s) => M9.input(s) === 'HOLA 9040' },
      { say: 'Presiona [DOWN] para bajar a la línea del chorro 2.', key: 'DOWN', done: (s) => fw(s).line === 1 },
      { say: 'Escribe la segunda línea.', type: 'LINEA 2', done: (s) => M9.input(s) === 'LINEA 2' },
      info('Para corregir: [LEFT] [RIGHT] mueven el cursor, [BKSP] borra a la izquierda.'),
      { say: 'Presiona [F7] «Cargar impresora»: guarda el mensaje y lo pone en producción.', key: loadKey, done: (s) => s.activeMessage === 'PRUEBA2' },
      { say: 'Presiona [F8] (casa) para volver a Producción.', key: 'F8', done: (s) => fw(s).mode === 'PROD' },
    ],
  },
  {
    id: 'fecha',
    title: 'Fecha de fabricación',
    goal: 'Menú Variables › Fecha, composición DD/MM/YY',
    summary: 'Variables › Fecha: marcar códigos o escribir la composición (DD/MM/YY) › [ENTER].',
    setup: (s) => {
      prep(s)
      setupMsg(s, 'FECHA', [[T('FAB ')]])
    },
    steps: [
      { say: 'Presiona [F3] (hoja con lápiz) para modificar el mensaje en producción.', key: editProd, done: inEdit },
      { say: 'El cursor está al final de «FAB ». Presiona [ESC]: se activa la **barra de menús** (Mensaje Fuente Variables Parametros).', key: 'ESC', done: (s) => fw(s).focus === 'bar' },
      { say: 'Ve a **Variables** con [RIGHT] y ábrela con [DOWN].', key: (s) => (fw(s).bar !== 2 ? 'RIGHT' : 'DOWN'), done: (s) => fw(s).focus === 'pull' && fw(s).bar === 2 },
      { say: 'Baja a **Fecha** y presiona [ENTER].', key: (s) => (fw(s).pull !== 3 ? 'DOWN' : 'ENTER'), done: at('varDate') },
      { say: 'Baja a «Dia del mes» y márcalo con [TAB]: el código DD pasa a «Composicion».', key: m9Check('varDate', 'DD'), done: (s) => Boolean(dlgV(s, 'DD')) },
      info('Puedes marcar más casillas o escribir directamente la composición. Los códigos: DD día, MM mes, YY año, JJJ día del año, WW semana.'),
      { say: 'Baja a «Composicion», presiona [TAB] y escribe **DD/MM/YY**.', key: m9Type('varDate', 'comp', 'DD/MM/YY', 'ENTER'), done: (s) => fw(s).dlg?.buf === 'DD/MM/YY' || has(ed(s), (f) => f.type === 'date') },
      { say: 'Presiona [ENTER]: la fecha se inserta en el mensaje (subrayada).', key: 'ENTER', done: (s) => has(ed(s), (f) => f.type === 'date' && f.format === 'DD/MM/YY') },
      { say: 'Presiona [F7] para cargar la impresora.', key: loadKey, done: (s, c) => ev(c, 'LOAD_PRINTER') },
      { say: 'Abre **▤ Línea**: el producto lleva la fecha de hoy.', drawer: 'product', done: (s) => s.prints[0]?.msg === 'FECHA' },
    ],
  },
  {
    id: 'caducidad',
    title: 'Fecha de caducidad',
    goal: 'Parametros › Caducidad + Variables › Caducidad',
    summary: 'Caducidad: Parametros › Caducidad (DIA + días) y Variables › Caducidad (composición) › [F7].',
    setup: (s) => {
      prep(s)
      setupMsg(s, 'CADUCA', [[T('CAD ')]])
    },
    steps: [
      { say: 'Presiona [F3] para modificar el mensaje en producción.', key: editProd, done: inEdit },
      { say: 'Abre **Parametros › Caducidad**: [ESC], [RIGHT] hasta Parametros, [DOWN], baja a Caducidad, [ENTER].', key: m9Nav('postdate'), done: at('postdate') },
      { say: '«Unidad: DIA» está bien. Baja a «Caducidad», presiona [TAB] y escribe **30** (días).', key: m9Type('postdate', 'amount', '30', 'ENTER'), done: (s) => fw(s).dlg?.buf === '30' || ed(s)?.expiry.amount === 30 },
      { say: 'Presiona [ENTER] para validar.', key: 'ENTER', done: (s) => ed(s)?.expiry.amount === 30 && !fw(s).dlg },
      { say: 'Ahora **Variables › Caducidad**: [ESC], Variables, baja a Caducidad, [ENTER].', key: m9Nav('varExpiry'), done: at('varExpiry') },
      { say: 'Baja a «Composicion», [TAB] y escribe **DD/MM/YY**.', key: m9Type('varExpiry', 'comp', 'DD/MM/YY', 'ENTER'), done: (s) => fw(s).dlg?.buf === 'DD/MM/YY' || has(ed(s), (f) => f.type === 'expiry') },
      { say: '[ENTER] inserta la fecha de caducidad (hoy + 30 días).', key: 'ENTER', done: (s) => has(ed(s), (f) => f.type === 'expiry') },
      { say: '[F7] para cargar la impresora.', key: loadKey, done: (s) => has(s.messages[s.activeMessage], (f) => f.type === 'expiry') && s.messages[s.activeMessage].expiry.amount === 30 },
    ],
  },
  {
    id: 'reloj',
    title: 'Ajustar la hora del reloj',
    goal: 'Preparación › Inicialización › Reloj automático',
    summary: '[F8] › [F1] Preparación › Inicializacion › Reloj automático › Hora › [ENTER].',
    setup: (s) => prep(s),
    steps: [
      { say: 'Presiona [F8] (otros menús): la barra de iconos cambia.', key: (s) => (fw(s).others ? null : 'F8'), done: (s) => fw(s).others || fw(s).mode === 'PREP' },
      { say: 'Presiona [F1] (engranajes) = Preparación de impresora.', key: 'F1', done: (s) => fw(s).mode === 'PREP' },
      { say: '«Inicializacion» está resaltada. Ábrela con [DOWN].', key: (s) => (fw(s).bar !== 0 ? 'LEFT' : 'DOWN'), done: (s) => fw(s).focus === 'pull' && fw(s).bar === 0 },
      { say: 'Baja a **Reloj automático** y presiona [ENTER].', key: (s) => (fw(s).pull !== 2 ? 'DOWN' : 'ENTER'), done: at('clock') },
      { say: 'Con «Hora» resaltada presiona [TAB] y escribe **143000** (los dos puntos se ponen solos).', key: m9Type('clock', 'time', '143000', 'ENTER'), done: (s) => fw(s).dlg?.buf === '143000' },
      { say: 'Presiona [ENTER] para validar: el reloj sigue corriendo desde 14:30:00.', key: 'ENTER', done: (s, c) => ev(c, 'RTC_SET', (e) => e.h === 14 && e.m === 30) },
      { say: 'Vuelve a Producción con [F8] (casa): arriba a la derecha ves la hora nueva.', key: 'F8', done: (s) => fw(s).mode === 'PROD' },
    ],
  },
  {
    id: 'turno',
    title: 'Código de turno automático',
    goal: 'Parametros › Turno de trabajo + Variables › Turno',
    summary: 'Turno: Hora inicio + Intervalo + Tipo (CIFRAS 01/02/03 o LETRAS A/B/C), y Variables › Turno de trabajo.',
    setup: (s) => {
      prep(s)
      setupMsg(s, 'TURNO', [[T('T')]])
    },
    steps: [
      { say: 'Presiona [F3] para modificar el mensaje en producción.', key: editProd, done: inEdit },
      { say: 'Abre **Parametros › Turno de trabajo** ([ESC] › Parametros › Turno de trabajo › [ENTER]).', key: m9Nav('shift'), done: at('shift') },
      info('**Hora inicio** = comienzo del primer turno · **Intervalo** = duración de cada turno · **Tipo** CIFRAS = 01, 02, 03 · LETRAS = A, B, C.'),
      { say: 'En «Hora inicio» presiona [TAB] y escribe **0700**; [DOWN] pasa al siguiente campo.', key: m9Type('shift', 'start', '0700'), done: (s) => dlgV(s, 'start') === '07:00' },
      { say: 'En «Intervalo» [TAB], escribe **0800** y [DOWN].', key: m9Type('shift', 'interval', '0800'), done: (s) => dlgV(s, 'interval') === '08:00' },
      { say: '«Tipo»: [TAB] abre la lista; elige **CIFRAS** y [TAB].', key: m9Choose('shift', 'type', '01'), done: (s) => dlgV(s, 'type') === '01' && fw(s).dlg?.listOpen == null },
      { say: 'Presiona [ENTER] para validar el cuadro.', key: 'ENTER', done: (s) => ed(s)?.shift.start === '07:00' && ed(s).shift.interval === '08:00' && !fw(s).dlg },
      { say: 'Inserta la variable: **Variables › Turno de trabajo** › [ENTER] (queda detrás de la T).', key: m9Nav('varShift'), done: (s) => has(ed(s), (f) => f.type === 'shift') },
      { say: '[F7] para cargar la impresora.', key: loadKey, done: (s) => has(s.messages.TURNO, (f) => f.type === 'shift') && s.messages.TURNO.shift.start === '07:00' },
    ],
  },
  {
    id: 'contador',
    title: 'Contador y lote del operador',
    goal: 'Parametros › Contador, Variables, F5 y F6',
    summary: 'Contador (Parametros + Variables), Campo de usuario LOTE (Variables › Usuario), F5 resetea, F6 cambia el lote.',
    setup: (s) => {
      prep(s)
      setupMsg(s, 'CAJAS', [[T('N.')]])
      s.opvars = s.opvars.filter((o) => o.name !== 'LOTE')
    },
    steps: [
      { say: 'Presiona [F3] para modificar el mensaje en producción.', key: editProd, done: inEdit },
      { say: 'Abre **Parametros › Contador**.', key: m9Nav('counterParams'), done: at('counterParams') },
      info('Valor inicial / final (al llegar al final vuelve al inicial), Paso, Contador lotes (cada cuántos productos sube), Tipo incremento OBJECTO = sube con cada producto.'),
      { say: 'Baja a «Valor final», [TAB], escribe **500** y [DOWN].', key: m9Type('counterParams', 'end', '500'), done: (s) => dlgV(s, 'end') === 500 },
      { say: '[ENTER] valida el cuadro.', key: 'ENTER', done: (s) => ed(s)?.counter.end === 500 && !fw(s).dlg },
      { say: 'Inserta el contador: **Variables › Contador** › [ENTER].', key: m9Nav('varCounter'), done: (s) => has(ed(s), (f) => f.type === 'counter') },
      { say: 'Escribe un espacio y «L» para el lote.', type: null, key: (s) => (M9.input(s)?.endsWith(' L') ? null : M9.input(s)?.endsWith(' ') ? 'L' : 'SPACE'), done: (s) => M9.input(s)?.endsWith(' L') },
      { say: 'Campo de usuario: **Variables › Usuario** › [ENTER].', key: m9Nav('varUser'), done: at('varUser') },
      { say: 'Ya viene «Elemento de identificacion: LOTE» y «Valor por defecto: A0001». Presiona [ENTER] para insertarlo.', key: 'ENTER', done: (s) => has(ed(s), (f) => f.type === 'opvar') },
      { say: '[F7] carga la impresora y [F8] vuelve a Producción.', key: (s) => (s.messages.CAJAS && has(s.messages.CAJAS, (f) => f.type === 'opvar') ? 'F8' : loadKey(s)), done: (s) => fw(s).mode === 'PROD' && has(s.messages.CAJAS, (f) => f.type === 'opvar') },
      { say: 'Presiona [F6] (persona + AB): campos de usuario del mensaje.', key: m9Nav('userFields'), done: (s) => fw(s).dlg?.list === 'user' },
      { say: 'Con LOTE resaltado presiona [TAB] y escribe el lote nuevo **B0002**.', key: (s) => (fw(s).dlg?.edit ? M9.typingKey(s, 'B0002') : 'TAB'), done: (s) => fw(s).dlg?.buf === 'B0002' },
      { say: '[ENTER] guarda el valor; [ESC] cierra la lista.', key: (s) => (fw(s).dlg?.edit ? 'ENTER' : 'ESC'), done: (s) => s.opvars.find((o) => o.name === 'LOTE')?.value === 'B0002' && !fw(s).dlg },
      { say: 'Presiona [F5] (001): contadores. Marca «Reset» con [TAB] y valida con [ENTER] para volver al valor inicial.', key: (s) => (fw(s).dlg?.form !== 'counters' ? 'F5' : fw(s).dlg.v.reset1 ? 'ENTER' : 'TAB'), done: (s, c) => ev(c, 'COUNTER_RESET') },
    ],
  },
  {
    id: 'velocidad',
    title: 'Parámetros de impresión',
    goal: 'F4: retardo, velocidad, taco y modo de disparo',
    summary: '[F4]: Retardo ida (posición), Velocidad / Lectura velocidad TACO + Division taco (longitud), Modo de disparo.',
    setup: (s) => {
      prep(s)
      s.activeMessage = 'LOTE_A1'
      s.messages.LOTE_A1 = structuredClone(s.messages.LOTE_A1)
      s.messages.LOTE_A1.params.trigger = 'MANUAL_OBJETO'
    },
    steps: [
      { say: 'Presiona [F4] (bloque de texto con flechas): parámetros del mensaje en producción.', key: m9Nav('prodParams'), done: at('prodParams') },
      info('Columna derecha: **Retardo ida** = mm desde la fotocélula al comienzo del marcaje · **Modo de disparo** · **Lectura velocidad**. Izquierda: **Velocidad de impresion** (mm/s) y **Division taco**. ▲▼ ◀▶ se mueven entre campos.'),
      { say: 'Ve a «Retardo ida», [TAB], escribe **80** y [DOWN].', key: m9Type('prodParams', 'delayFwd', '80'), done: (s) => dlgV(s, 'delayFwd') === 80 },
      { say: '«Modo de disparo»: [TAB] y elige **OBJECTO** (una impresión por producto) › [TAB].', key: m9Choose('prodParams', 'trigger', 'OBJETO'), done: (s) => dlgV(s, 'trigger') === 'OBJETO' && fw(s).dlg?.listOpen == null },
      { say: '«Lectura velocidad»: [TAB] y elige **TACO** (encoder de la línea) › [TAB].', key: m9Choose('prodParams', 'lectura', 'ENCODER'), done: (s) => dlgV(s, 'lectura') === 'ENCODER' && fw(s).dlg?.listOpen == null },
      { say: 'Ahora aparece «Division taco»: [TAB], escribe **12** y [DOWN].', key: m9Type('prodParams', 'division', '12'), done: (s) => dlgV(s, 'division') === 12 },
      { say: 'Presiona [ENTER] para validar todo el cuadro.', key: 'ENTER', done: (s) => !fw(s).dlg && s.messages.LOTE_A1.params.delayFwd === 80 && s.hw.encoder.source === 'ENCODER' },
      { say: 'Abre **▤ Línea**: con OBJECTO cada producto se marca.', drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => e.cause === 'PHOTOCELL') },
    ],
  },
  {
    id: 'defectos',
    title: 'Alarmas, defectos y estado',
    goal: '(i) ver y resolver, llave = estado del cabezal',
    summary: '(i) muestra y resuelve defectos. La llave muestra presión, velocidad, fase y viscosidad.',
    setup: (s) => {
      prep(s)
      s.hidden.inkLevel = 6
    },
    steps: [
      info('El LED rojo de **tinta** y el de **alarma** están encendidos.', { region: 'leds' }),
      { say: 'Presiona [INFO] para ver la lista de defectos.', key: 'INFO', done: (s) => Boolean(fw(s).defects) },
      info('«Nivel de tinta bajo» y debajo la solución recomendada.', { region: 'screen' }),
      { say: 'Abre **▤ Línea** › «Rellenar tinta».', drawer: 'ink', done: (s) => s.hidden.inkLevel > 10 },
      { say: 'Presiona [INFO] otra vez para resolver la alarma.', key: (s) => (fw(s).defects ? 'INFO' : null), done: (s) => Object.keys(s.faults).length === 0 },
      { say: 'Presiona [WRENCH]: estado del cabezal.', key: (s) => (fw(s).defects ? 'ESC' : 'WRENCH'), done: (s) => Boolean(fw(s).status) },
      info('**Estado chorros** (EN MARCHA), **Veloc. chorro1/2** (≈20 m/s), **Fase chorro1/2**, **Presion** (≈2,9 bar), **Viscosidad** y temperaturas.', { region: 'screen' }),
      { say: 'Sal con [ESC].', key: 'ESC', done: (s) => !fw(s).status },
    ],
  },
  {
    id: 'quiebra',
    title: 'Punto de quiebra (fase)',
    goal: 'Fase chorro 00111100 y potenciómetro',
    summary: 'Fase correcta = 3-4 unos seguidos. Se ajusta con el potenciómetro de cada chorro en el cabezal.',
    setup: (s) => {
      prep(s)
      s.hw.jet.modulation = 95
    },
    steps: [
      { say: 'Presiona [WRENCH] para ver «Fase chorro1» y «Fase chorro2».', key: 'WRENCH', done: (s) => Boolean(fw(s).status) },
      info('Correcto = **3 ó 4 unos seguidos** (00111100). Ahora sale desordenado: el chorro no se rompe en gotas a la altura del electrodo de carga.', { region: 'screen' }),
      { say: 'Abre **▤ Línea** › «Potenciómetro de quiebra» y gíralo con ‹ › hasta ver 00111100.', drawer: 'pot', done: (s) => s.live.breakoff >= 8 && s.live.breakoff <= 10 && s.live.phaseOk },
      { say: 'Espera 5 segundos sin tocar.', done: (s) => s.live.phaseStableMs >= 5000 },
      { say: 'Sal con [ESC] (queda validado).', key: 'ESC', done: (s, c) => ev(c, 'JET_VALIDATE', (e) => e.ok) },
    ],
  },
  {
    id: 'centrado',
    title: 'Centrar el chorro en el canal',
    goal: 'AJUSTE CHORRO, excéntricas, ARRANQUE CHORRO',
    summary: 'AJUSTE CHORRO arranca ignorando defectos de chorro; se centra con las excéntricas y se vuelve con ARRANQUE CHORRO.',
    setup: (s) => {
      prep(s, { power: 'ON', jet: 'STOPPED' })
      s.hidden.biasX = 70
      s.hidden.biasY = -40
    },
    steps: [
      { say: 'Presiona [WRENCH] y, con «Estado chorros» resaltado, [TAB] para abrir la lista de funciones.', key: (s) => (fw(s).status ? 'TAB' : 'WRENCH'), done: (s) => fw(s).status?.listOpen != null },
      info('PARO CHORRO · ARRANQUE CHORRO · REFRESCO DE TINTA · ESTABILIDAD CHORRO · INTRO.DISOLVENTE · DESOBTURACION BUS · **AJUSTE CHORRO** (arranca sin vigilar la recuperación, para poder centrar).'),
      { say: 'Baja a **AJUSTE CHORRO** y presiona [ENTER].', key: m9JetFunc('AJUSTE CHORRO'), done: (s, c) => ev(c, 'ADJUST_ENTER') },
      { say: 'Abre **▤ Línea** › «Excéntricas del cañón»: horizontal y vertical hasta «Canal: OK».', drawer: 'cams', done: (s) => s.live.gutterOk && s.jetState === 'RUNNING' },
      { say: 'Vuelve a la lista ([TAB]) y elige **ARRANQUE CHORRO** › [ENTER] (sale del ajuste).', key: m9JetFunc('ARRANQUE CHORRO'), done: (s, c) => ev(c, 'ADJUST_EXIT') && s.jetState === 'RUNNING' },
      { say: 'Sal con [ESC].', key: 'ESC', done: (s) => !fw(s).status },
    ],
  },
  {
    id: 'eht',
    title: 'Defecto THT: limpiar y secar placas',
    goal: '(i), limpieza, secado, resolver y arrancar',
    summary: 'THT = fuga de alta tensión: limpiar y secar las placas, resolver con (i) y ARRANQUE CHORRO.',
    setup: (s) => {
      prep(s)
      s.hidden.platesDirt = 0.9
    },
    steps: [
      { say: 'Alarma roja y HEAD 1 parpadeando: el chorro se paró. Presiona [INFO].', key: 'INFO', done: (s) => Boolean(fw(s).defects) && Boolean(s.faults.EHT) },
      info('«THT»: la alta tensión de las placas de deflexión tiene fugas. Solución: «Limpiar y secar con cuidado el cabezal».', { region: 'screen' }),
      { say: 'Sal con [ESC] y espera a que el chorro esté parado.', key: (s) => (fw(s).defects ? 'ESC' : null), done: (s) => s.jetState === 'STOPPED' && !fw(s).defects },
      { say: 'Abre **▤ Línea** › Placas: «Limpiar placas con disolvente».', drawer: 'plates', done: (s, c) => ev(c, 'DIAG_DONE', (e) => e.step === 'CLEAN') },
      { say: 'Ahora «Secar con bomba de secado».', drawer: 'plates', done: (s, c) => ev(c, 'DIAG_DONE', (e) => e.step === 'DRY') },
      { say: 'Presiona [INFO] y otra vez [INFO] para resolver el defecto.', key: 'INFO', done: (s) => !s.faults.EHT },
      { say: 'Arranca los chorros: [WRENCH] › [TAB] › ARRANQUE CHORRO › [ENTER].', key: (s) => (fw(s).defects ? 'ESC' : m9JetFunc('ARRANQUE CHORRO')(s)), done: (s) => s.jetState === 'RUNNING' || s.jetState === 'STARTING' },
    ],
  },
  {
    id: 'barras',
    title: 'Código de barras por V24',
    goal: 'Puerto V24, CODE 128 y Elemento externo',
    summary: 'V24 en Preparación; Parametros › Codigo de barras (tipo); Fuente › Código de barras (Elemento externo).',
    setup: (s) => {
      prep(s)
      setupMsg(s, 'PEDIDO', [[T('PED ')]])
      s.hw.v24.baud = 38400
    },
    steps: [
      { say: 'Abre **Preparación › Inicializacion › Comunicación V24** ([F8] › [F1] › [DOWN] › baja › [ENTER]).', key: m9Nav('v24'), done: at('v24') },
      { say: '«Velocidad (bauds)»: [TAB], elige **9600** y [TAB].', key: m9Choose('v24', 'baud', 9600), done: (s) => dlgV(s, 'baud') === 9600 && fw(s).dlg?.listOpen == null },
      { say: 'Paridad NO, Stop bit 1 y 8 bits ya están bien. Presiona [ENTER].', key: 'ENTER', done: (s) => s.hw.v24.baud === 9600 && !fw(s).dlg },
      { say: 'Vuelve con [F8] y abre el mensaje con [F3].', key: editProd, done: inEdit },
      { say: 'Abre **Parametros › Codigo de barras**.', key: m9Nav('bcParams'), done: at('bcParams') },
      { say: '«Tipo»: [TAB], elige **EAN128 / CODE128** y [TAB]; luego [ENTER].', key: (s) => (dlgV(s, 'symbology') === 'CODE128' && fw(s).dlg?.listOpen == null ? 'ENTER' : m9Choose('bcParams', 'symbology', 'CODE128')(s)), done: (s) => ed(s)?.barcode?.symbology === 'CODE128' && !fw(s).dlg },
      { say: 'Abre **Fuente › Código de barras** (composición del código).', key: m9Nav('bcCompose'), done: at('bcCompose') },
      { say: 'Baja a «Elemento externo» y márcalo con [TAB]: los datos llegarán por el puerto serie.', key: m9Check('bcCompose', 'external'), done: (s) => Boolean(dlgV(s, 'external')) },
      { say: '[ENTER] inserta el código.', key: 'ENTER', done: (s) => has(ed(s), (f) => f.type === 'barcode' && f.source === 'external') },
      { say: '[F7] carga la impresora.', key: loadKey, done: (s) => has(s.messages.PEDIDO, (f) => f.type === 'barcode') && s.activeMessage === 'PEDIDO' },
      { say: 'Abre **▤ Línea** › «Terminal V24» y pulsa «Enviar» (simula el ERP).', drawer: 'v24', done: (s, c) => ev(c, 'V24_FRAME') },
      { say: 'Mira en ▤ Línea el código impreso con los datos recibidos.', drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => e.msg === 'PEDIDO') },
    ],
  },
  {
    id: 'orientacion',
    title: 'Alinear los dos chorros',
    goal: 'Orientación chorros (tramas)',
    summary: 'Bichorro: el chorro más retrasado es la referencia (0); al otro se le da el retardo en tramas.',
    setup: (s) => {
      prep(s)
      s.activeMessage = 'LOTE_A1'
      s.hw.head.skew = 6
    },
    steps: [
      { say: 'Abre **▤ Línea**: las dos líneas del marcaje salen desfasadas (el chorro 1.2 llega 6 tramas tarde).', drawer: 'product', done: (s) => s.prints.length > 0 },
      { say: 'Abre **Preparación › Inicializacion › Orientación chorros**.', key: m9Nav('head'), done: at('head') },
      info('«Numero de chorro» 1.1 / 1.2 y «Orientacion» en tramas. El más retrasado (1.2) se queda en 0; al 1.1 se le da el retraso.'),
      { say: 'Con «Numero de chorro: 1.1», baja a «Orientacion», [TAB] y escribe **6**.', key: m9Type('head', 'val', '6', 'ENTER'), done: (s) => fw(s).dlg?.buf === '6' || s.hw.head.orient?.j1 === 6 },
      { say: '[ENTER] valida.', key: 'ENTER', done: (s) => s.hw.head.orient?.j1 === 6 && !fw(s).dlg },
      { say: 'Mira **▤ Línea**: el desfase del próximo producto es 0 mm.', drawer: 'product', done: (s, c) => ev(c, 'PRINT', (e) => Math.abs(e.twinOffset) <= 0.5) },
    ],
  },
]
