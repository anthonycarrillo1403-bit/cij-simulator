// Sistema de 15 misiones de planta (modo entrenamiento).
// Cada misión: setup() prepara el escenario y steps[] se validan en orden.
// Un paso, una vez cumplido, queda registrado (progreso secuencial).
import { canPrint, pushEvent, outputsState, modelInfo } from './sim.js'
import { headOverpressure } from './jet.js'
import { defaultMessages, defaultHidden } from './defaults.js'
import { rtcNow, shiftCode } from './rtc.js'
import { messageHasField } from './render.js'

const hasEv = (ev, type, pred = () => true) => ev.some((e) => e.type === type && pred(e))
const countEv = (ev, type, pred = () => true) => ev.filter((e) => e.type === type && pred(e)).length
const nav = (ev, view) => hasEv(ev, 'NAV', (e) => e.view === view)
const editMsg = (s) => s.editing?.message
const active = (s) => s.messages[s.activeMessage]
const inRange = (v, a, b) => v >= a && v <= b

function baseline(s, { keepJet = false } = {}) {
  const h = defaultHidden()
  s.hidden = { ...h, inkLevel: Math.max(s.hidden.inkLevel, 40) }
  s.faults = {}
  s.paused = false
  s.adjustMode = false
  s.diag = { running: null, progress: 0, lastLeak: null, done: {} }
  if (s.power !== 'ON') {
    s.power = 'ON'
    s.powerTimer = 0
  }
  Object.assign(s.hw.jet, { pressureSet: 2.9, piezoFreq: 62.5, modulation: 200, alignX: 0, alignY: 0, ehtSet: 7200 })
  s.hw.head.jets = 1
  s.line.running = true
  s.line.speed = 30
  s.line.sensorType = 'PNP'
  if (!s.hw.io.in.includes('PHOTOCELL_PNP') && !s.hw.io.in.includes('PHOTOCELL_NPN')) s.hw.io.in[0] = 'PHOTOCELL_PNP'
  if (s.hw.io.in.includes('PHOTOCELL_NPN')) s.hw.io.in = s.hw.io.in.map((x) => (x === 'PHOTOCELL_NPN' ? 'PHOTOCELL_PNP' : x))
  const defs = defaultMessages()
  for (const name of ['LOTE_A1', 'CLIENTE_X', 'PRUEBA']) if (!s.messages[name]) s.messages[name] = defs[name]
  if (!keepJet) {
    s.jetState = 'STOPPED'
    s.jetTimer = 0
  }
}

function runJet(s) {
  s.jetState = 'RUNNING'
  s.jetTimer = 0
  s.live.pressure = s.hw.jet.pressureSet
}

export const MISSIONS = [
  {
    id: 1,
    title: 'Selección y carga rápida de mensaje',
    area: 'Producción',
    brief: 'El jefe de línea pide arrancar la orden LOTE_A1. Seleccione el mensaje y deje la impresora lista para imprimir.',
    setup(s) {
      baseline(s)
      s.activeMessage = 'PRUEBA'
    },
    steps: [
      { text: 'Abrir Producción › Mensaje › Selección mensajes (o tecla MENSAJE)', check: (s, ev) => nav(ev, 'select') },
      { text: 'Seleccionar el mensaje LOTE_A1', check: (s) => s.activeMessage === 'LOTE_A1' },
      { text: 'Arrancar el chorro (Producción › Impresora › Arranque chorro)', check: (s) => s.jetState === 'RUNNING' },
      { text: 'Impresora en estado LISTO / IMPRIMIENDO con LOTE_A1', check: (s) => s.activeMessage === 'LOTE_A1' && canPrint(s) },
    ],
  },
  {
    id: 2,
    title: 'Fecha de caducidad automática (+365 días)',
    area: 'Edición',
    brief: 'El producto tiene vida útil de un año. Inserte una fecha de caducidad calculada desde el RTC con +365 días.',
    setup(s) {
      baseline(s, { keepJet: true })
    },
    steps: [
      { text: 'Edición de mensaje › Mensaje › Abrir (o Nuevo) un mensaje', check: (s, ev) => hasEv(ev, 'EDIT_OPEN') },
      { text: 'Variables › Caducidad: insertar el campo de caducidad', check: (s) => Boolean(editMsg(s) && messageHasField(editMsg(s), (f) => f.type === 'expiry')) },
      {
        text: 'Parámetros › Caducidad: duración 365 DÍAS',
        check: (s) => {
          const m = editMsg(s)
          if (!m) return false
          return m.lines.flat().some((f) => f.type === 'expiry' && (f.slot === 2 ? m.expiry2 : m.expiry).amount === 365 && (f.slot === 2 ? m.expiry2 : m.expiry).unit === 'DIAS')
        },
      },
      {
        text: 'Mensaje › Cargar impresora (el mensaje activo imprime RTC + 365 días)',
        check: (s, ev) => {
          const m = active(s)
          return hasEv(ev, 'LOAD_PRINTER') && m.lines.flat().some((f) => f.type === 'expiry' && (f.slot === 2 ? m.expiry2 : m.expiry).amount === 365 && (f.slot === 2 ? m.expiry2 : m.expiry).unit === 'DIAS')
        },
      },
    ],
  },
  {
    id: 3,
    title: 'Ajuste manual de hora (RTC offset)',
    area: 'Preparación',
    brief: 'Tras un corte de energía el reloj quedó desfasado. Ajuste la hora a las 06:00 y compruebe que sigue avanzando.',
    setup(s) {
      baseline(s, { keepJet: true })
    },
    steps: [
      { text: 'Preparación › Inicialización › Reloj', check: (s, ev) => nav(ev, 'clock') },
      { text: 'Ajustar la hora a 06:00 y validar', check: (s, ev) => hasEv(ev, 'RTC_SET', (e) => e.h === 6 && e.m === 0) },
      {
        text: 'Verificar que el reloj sigue corriendo (≥ 10 s después de 06:00:00)',
        check: (s) => {
          if (!s.rtcLastSet) return false
          const now = rtcNow(s.rtcOffset)
          return Date.now() - s.rtcLastSet.sys >= 10000 && now.getHours() === 6 && now.getMinutes() < 10
        },
      },
    ],
  },
  {
    id: 4,
    title: 'Turnos automáticos T1 / T2 / T3',
    area: 'Edición',
    brief: 'La planta trabaja 3 turnos: T1 07:00-15:00, T2 15:00-23:00 y T3 23:00-07:00. El código de turno debe cambiar solo.',
    setup(s) {
      baseline(s, { keepJet: true })
    },
    steps: [
      { text: 'Abrir un mensaje en Edición de mensaje', check: (s, ev) => hasEv(ev, 'EDIT_OPEN') },
      { text: 'Variables › Turno de trabajo: insertar el campo', check: (s) => Boolean(editMsg(s) && messageHasField(editMsg(s), (f) => f.type === 'shift')) },
      {
        text: 'Parámetros › Turno: inicio 07:00, intervalo 08:00, códigos T1, T2, T3',
        check: (s) => {
          const sh = editMsg(s)?.shift
          return Boolean(sh && sh.start === '07:00' && sh.interval === '08:00' && sh.codes.slice(0, 3).join(',') === 'T1,T2,T3')
        },
      },
      {
        text: 'Cargar impresora con el turno configurado',
        check: (s) => {
          const m = active(s)
          return messageHasField(m, (f) => f.type === 'shift') && m.shift.start === '07:00' && m.shift.interval === '08:00' && m.shift.codes.slice(0, 3).join(',') === 'T1,T2,T3'
        },
      },
      {
        text: 'Prueba: poner el RTC en horario de T2 (15:00-22:59) y ver "T2" en el mensaje',
        check: (s) => shiftCode(rtcNow(s.rtcOffset), active(s).shift) === 'T2',
      },
    ],
  },
  {
    id: 5,
    title: 'Contador ascendente + lote dinámico',
    area: 'Edición',
    brief: 'Cada caja lleva un número correlativo 1→9999 que avanza con cada disparo de la fotocélula, más un lote dinámico.',
    setup(s) {
      baseline(s, { keepJet: true })
    },
    steps: [
      { text: 'Abrir un mensaje e insertar Variables › Contador', check: (s) => Boolean(editMsg(s) && messageHasField(editMsg(s), (f) => f.type === 'counter')) },
      {
        text: 'Parámetros › Contador: inicial 1, final 9999, paso 1, por OBJETOS',
        check: (s) => {
          const c = editMsg(s)?.counter
          return Boolean(c && c.start === 1 && c.end === 9999 && c.step === 1 && c.incType === 'OBJETOS')
        },
      },
      {
        text: 'Insertar lote dinámico (Var. operador LOTE o fecha juliana JJJ)',
        check: (s) => Boolean(editMsg(s) && messageHasField(editMsg(s), (f) => (f.type === 'opvar' && f.name === 'LOTE') || (f.type === 'date' && f.format.includes('JJJ')))),
      },
      {
        text: 'Cargar impresora',
        check: (s) => {
          const m = active(s)
          return messageHasField(m, (f) => f.type === 'counter') && m.counter.start === 1 && m.counter.end === 9999 && m.counter.step === 1
        },
      },
      {
        text: 'Imprimir 3 productos por fotocélula y ver el contador +1 cada vez',
        check: (s, ev, prev) => countEv(prev, 'PRINT', (e) => e.cause === 'PHOTOCELL' && (e.counterAfter === e.counterBefore + 1 || (e.counterBefore === 9999 && e.counterAfter === 1))) >= 3,
      },
    ],
  },
  {
    id: 6,
    title: 'Calibración del punto de quiebra',
    area: 'Preparación',
    brief: 'El control de gotas muestra "01010011": el punto de quiebra está fuera del electrodo de carga. Llévelo a 8-10 gotas.',
    setup(s) {
      baseline(s)
      s.hw.jet.modulation = 95
      s.hw.jet.piezoFreq = 57.0
    },
    steps: [
      { text: 'Abrir Preparación › Chorro (ajuste de gota)', check: (s, ev) => nav(ev, 'jet') },
      { text: 'Chorro en marcha', check: (s) => s.jetState === 'RUNNING' },
      { text: 'Punto de quiebra entre 8 y 10 gotas (modulación / frecuencia)', check: (s) => inRange(s.live.breakoff, 8, 10) },
      { text: 'Fase correcta (3-4 "1" consecutivos) estable 5 s', check: (s) => s.live.phaseStableMs >= 5000 },
      { text: 'Validar el ajuste (botón VALIDAR / ENTER)', check: (s, ev, prev) => hasEv(prev, 'JET_VALIDATE', (e) => e.ok) },
    ],
  },
  {
    id: 7,
    title: 'Centrado del chorro en el canal',
    area: 'Estado/Cabezal',
    brief: 'Tras desmontar el cabezal, el chorro no entra en el recuperador. Use la función AJUSTE para centrarlo.',
    setup(s) {
      baseline(s)
      s.hidden.biasX = 85
      s.hidden.biasY = -50
      s.hw.jet.pressureSet = 3.3
    },
    steps: [
      { text: 'Entrar en Estado/Cabezal › Estado chorros › AJUSTE (o tecla CHORRO)', check: (s, ev) => hasEv(ev, 'ADJUST_ENTER') },
      { text: 'Presión de consigna entre 2,8 y 3,0 bar', check: (s) => inRange(s.hw.jet.pressureSet, 2.8 - 1e-9, 3.0 + 1e-9) },
      { text: 'Sensor del recuperador OK (desvío ≤ 20 µm en X e Y)', check: (s) => s.live.gutterOk && s.jetState === 'RUNNING' },
      { text: 'Salir de AJUSTE con chorro en marcha y sin defecto de recuperación', check: (s, ev, prev) => hasEv(prev, 'ADJUST_EXIT') && s.jetState === 'RUNNING' && !s.faults.RECUP && s.live.gutterOk },
    ],
  },
  {
    id: 8,
    title: 'Sincronización con encoder de línea',
    area: 'Preparación',
    brief: 'La línea cambia de velocidad y el marcaje sale estirado. Sincronice con el encoder externo (división 1500).',
    setup(s) {
      baseline(s, { keepJet: true })
      s.hw.encoder.source = 'CONSTANTE'
      s.hw.encoder.division = 1000
      s.line.speed = 45
    },
    steps: [
      { text: 'Abrir Preparación › Encoder', check: (s, ev) => nav(ev, 'encoder') },
      { text: 'Fuente de velocidad = ENCODER EXTERNO', check: (s) => s.hw.encoder.source === 'ENCODER' },
      { text: 'División tacométrica = 1500', check: (s) => s.hw.encoder.division === 1500 },
      { text: 'Imprimir con anchura correcta (factor 0,95-1,05)', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => inRange(e.wf, 0.95, 1.05)) },
    ],
  },
  {
    id: 9,
    title: 'Code 128 alimentado por V24',
    area: 'Variables / V24',
    brief: 'El ERP envía el código de pedido por el puerto serie. Cree un Code 128 cuyo contenido llegue por V24.',
    setup(s) {
      baseline(s, { keepJet: true })
      s.hw.v24.data = ''
    },
    steps: [
      { text: 'Variables op. / V24 › Puerto V24: 9600 baudios, 8 bits, sin paridad, 1 stop', check: (s, ev) => hasEv(ev, 'V24_CONFIG') && s.hw.v24.baud === 9600 && s.hw.v24.bits === 8 && s.hw.v24.parity === 'NINGUNA' && s.hw.v24.stop === 1 },
      { text: 'En Edición: Fuente › Código de barras CODE 128 con origen "Externa V24"', check: (s) => [editMsg(s), active(s)].some((m) => m && messageHasField(m, (f) => f.type === 'barcode' && f.symbology === 'CODE128' && f.source === 'external')) },
      { text: 'Cargar impresora', check: (s) => messageHasField(active(s), (f) => f.type === 'barcode' && f.symbology === 'CODE128' && f.source === 'external') },
      { text: 'Terminal V24: enviar una trama de datos', check: (s, ev, prev) => hasEv(prev, 'V24_FRAME', (e) => e.data.length > 0) },
      { text: 'Imprimir el código con los datos recibidos', check: (s, ev, prev) => hasEv(prev, 'PRINT') },
    ],
  },
  {
    id: 10,
    title: 'Agitador y kit de aire (S8 Contrast)',
    area: 'Equipo',
    model: 'S8_CONTRAST',
    brief: 'Ambiente con polvo y tinta pigmentada. Active el agitador y la presurización del cabezal con el kit de aire fábrica.',
    setup(s) {
      baseline(s, { keepJet: true })
      s.hw.agitator = false
      s.hw.airKit = { enabled: false, inlet: 6.5, regulator: 2.0, purged: false }
      s.hidden.dusty = true
      s.live.sediment = 60
    },
    steps: [
      { text: 'Preparación › Equipo: activar el agitador de tinta', check: (s) => s.hw.agitator },
      { text: 'Activar el kit de aire fábrica', check: (s) => s.hw.airKit.enabled },
      { text: 'Purgar los filtros del kit de aire', check: (s) => s.hw.airKit.purged },
      { text: 'Regular presión de entrada = P.trabajo + 0,7 bar (-0,1/+0,3)', check: (s) => headOverpressure(s.hw, modelInfo(s), s.hw.jet.pressureSet) },
      { text: 'Mantenimiento › TESTS: verificar presión de entrada', check: (s, ev, prev) => hasEv(prev, 'AIR_TEST', (e) => e.ok) },
      { text: 'Sin alarmas de sedimentación ni de aire', check: (s) => !s.faults.SEDIMENT && !s.faults.AIR },
    ],
  },
  {
    id: 11,
    title: 'Impresión bichorro: retardo de cabezal',
    area: 'Preparación',
    brief: 'Cabezal bichorro: el chorro 2 está 24 mm aguas abajo del chorro 1. Ajuste el retardo para alinear ambas líneas.',
    setup(s) {
      baseline(s, { keepJet: true })
      s.hw.head = { jets: 2, delayJet1: 50, delayJet2: 60, physOffset: 24 }
    },
    steps: [
      { text: 'Abrir Preparación › Cabezal', check: (s, ev) => nav(ev, 'head') },
      { text: 'Ajustar retardo chorro 2 para desfase ≤ 0,5 mm', check: (s) => s.hw.head.jets === 2 && Math.abs(s.hw.head.delayJet2 - s.hw.head.delayJet1 - s.hw.head.physOffset) <= 0.5 },
      { text: 'Imprimir y comprobar alineación sin solapamiento', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => Math.abs(e.twinOffset) <= 0.5) },
    ],
  },
  {
    id: 12,
    title: 'Mapeo de E/S (I/O board)',
    area: 'Preparación',
    brief: 'Mantenimiento instaló una fotocélula NPN y una baliza para falta de tinta. Asigne las señales.',
    setup(s) {
      baseline(s, { keepJet: true })
      s.line.sensorType = 'NPN'
      s.hw.io = { in: ['PHOTOCELL_PNP', 'NONE', 'NONE', 'NONE'], out: ['GENERAL_ALARM', 'NONE', 'NONE', 'NONE'] }
    },
    steps: [
      { text: 'Abrir Preparación › E/S', check: (s, ev) => nav(ev, 'io') },
      { text: 'Entrada 1 = Fotocélula producto NPN', check: (s) => s.hw.io.in[0] === 'PHOTOCELL_NPN' },
      { text: 'Salida 2 = Lámpara alarma falta de tinta', check: (s) => s.hw.io.out[1] === 'INK_LOW_LAMP' },
      { text: 'Verificar detección: imprimir un producto por fotocélula', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => e.cause === 'PHOTOCELL') },
      { text: 'Probar: simular reserva de tinta y ver la lámpara S2 encendida', check: (s) => outputsState(s)[1] === true },
      { text: 'Rellenar tinta y comprobar que la lámpara se apaga', check: (s) => outputsState(s)[1] === false && s.hidden.inkLevel > 10 },
    ],
  },
  {
    id: 13,
    title: 'Falla THT / EHT: limpieza de placas',
    area: 'Diagnóstico',
    brief: 'La impresora se ha detenido con alta tensión desarmada. Identifique el defecto y ejecute la secuencia de limpieza y secado.',
    setup(s) {
      baseline(s)
      s.hidden.platesDirt = 0.9
      runJet(s)
    },
    steps: [
      { text: 'Tecla DEFECTOS: identificar y consultar el defecto THT', check: (s, ev) => hasEv(ev, 'FAULT_VIEW', (e) => e.code === 'EHT') },
      { text: 'Chorro parado', check: (s) => s.jetState === 'STOPPED' },
      { text: 'Diagnóstico THT: limpieza de placas deflectoras', check: (s, ev) => hasEv(ev, 'DIAG_DONE', (e) => e.step === 'CLEAN') },
      { text: 'Secado de placas con bomba de secado', check: (s, ev, prev) => hasEv(prev, 'DIAG_DONE', (e) => e.step === 'DRY') },
      { text: 'Test de aislamiento THT < 10 µA', check: (s, ev, prev) => hasEv(prev, 'DIAG_DONE', (e) => e.step === 'TEST' && e.ok) },
      { text: 'Anular el defecto', check: (s) => !s.faults.EHT },
      { text: 'Arrancar el chorro con THT armada', check: (s) => s.jetState === 'RUNNING' && !s.faults.EHT && s.live.eht >= 0.9 * s.hw.jet.ehtSet },
    ],
  },
  {
    id: 14,
    title: 'Corrección de anchura y modulación THT',
    area: 'Preparación',
    brief: 'El texto sale estirado y aplastado. Corrija la anchura de impresión y la alta tensión de deflexión.',
    setup(s) {
      baseline(s, { keepJet: true })
      s.activeMessage = 'PRUEBA'
      s.messages.PRUEBA.params.width = 170
      s.messages.PRUEBA.params.printSpeed = 500
      s.hw.jet.ehtSet = 5400
    },
    steps: [
      { text: 'Abrir Preparación › Prueba de deflexión', check: (s, ev) => nav(ev, 'deflect') },
      { text: 'Anchura (Width) entre 95 y 105 %', check: (s) => inRange(active(s).params.width, 95, 105) },
      { text: 'Alta tensión THT entre 6900 y 7500 V', check: (s) => inRange(s.hw.jet.ehtSet, 6900, 7500) },
      { text: 'Imprimir con proporciones correctas', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => inRange(e.wf, 0.9, 1.1) && inRange(e.hf, 0.95, 1.05)) },
    ],
  },
  {
    id: 15,
    title: 'Cambio de turno completo',
    area: 'Integral',
    brief: 'Simulación completa de relevo: mensaje del cliente, nuevo lote, hora RTC, punto de quiebra y arranque sin alertas. ¡En orden!',
    setup(s) {
      baseline(s)
      s.activeMessage = 'PRUEBA'
      s.hw.jet.modulation = 120
      s.paused = true
      const lote = s.opvars.find((o) => o.name === 'LOTE')
      s.mission.data = { lote0: lote ? lote.value || lote.def : '' }
    },
    steps: [
      { text: '1 · Cargar el mensaje de cliente CLIENTE_X', check: (s) => s.activeMessage === 'CLIENTE_X' },
      { text: '2 · Cambiar el lote (variable de operador LOTE, tecla F6)', check: (s) => { const l = s.opvars.find((o) => o.name === 'LOTE'); return Boolean(l && (l.value || l.def) !== s.mission.data.lote0) } },
      { text: '3 · Verificar la hora RTC (Preparación › Reloj)', check: (s, ev, prev) => hasEv(prev, 'RTC_VIEW') || hasEv(prev, 'RTC_SET') },
      { text: '4 · Arrancar chorro y calibrar punto de quiebra 8-10 (VALIDAR)', check: (s, ev, prev) => hasEv(prev, 'JET_VALIDATE', (e) => e.ok) },
      { text: '5 · Orden de inicio de impresión (PAUSA → reanudar) sin alertas', check: (s, ev, prev) => hasEv(prev, 'PRINT_START', (e) => e.faults.length === 0) && Object.keys(s.faults).length === 0 },
      { text: '6 · Primer producto impreso correctamente', check: (s, ev, prev) => hasEv(prev, 'PRINT', (e) => e.msg === 'CLIENTE_X' && e.quality >= 1) },
    ],
  },
]

export const missionById = (id) => MISSIONS.find((m) => m.id === id)

export function startMission(s, id) {
  const def = missionById(id)
  if (!def) return
  if (def.model && s.hw.model !== def.model) s.hw.model = def.model
  s.mission = { id, done: def.steps.map(() => false), doneSeq: def.steps.map(() => 0), seqStart: s.seq, startedAt: Date.now(), data: {} }
  def.setup(s)
  pushEvent(s, 'MISSION_START', { id })
  s.mission.seqStart = s.seq
}

export function evaluateMission(s) {
  if (!s.mission || s.mission.completedAt) return
  const def = missionById(s.mission.id)
  if (!def) return
  if (def.model && s.hw.model !== def.model) return
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
    s.mission.doneSeq[i] = s.seq
    pushEvent(s, 'MISSION_STEP', { id: def.id, step: i })
    s.mission.doneSeq[i] = s.seq
  }
  if (s.mission.done.every(Boolean)) {
    const seconds = Math.round((Date.now() - s.mission.startedAt) / 1000)
    const prevBest = s.progress[def.id]?.best
    s.mission.completedAt = Date.now()
    s.progress[def.id] = { completedAt: Date.now(), seconds, best: prevBest ? Math.min(prevBest, seconds) : seconds }
    pushEvent(s, 'MISSION_DONE', { id: def.id, seconds })
  }
}
