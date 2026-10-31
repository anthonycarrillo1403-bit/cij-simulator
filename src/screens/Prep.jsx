// Menú PREPARACIÓN DE IMPRESORA
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import ScreenLayout from '../components/ScreenLayout.jsx'
import JetView from '../components/JetView.jsx'
import DotMatrix from '../components/DotMatrix.jsx'
import { NumberField, ChoiceField, Toggle, Readout, Btn, Section } from '../components/Fields.jsx'
import { useModal } from '../components/Modals.jsx'
import { rtcNow, formatClock, formatDate, pad } from '../engine/rtc.js'
import { canPrint, modelInfo, outputsState, printGeometry } from '../engine/sim.js'
import { rayleighGain, airKitWindow, EHT_MIN, EHT_MAX, ENCODER_DIVISION_REF } from '../engine/jet.js'
import { IO_INPUTS, IO_OUTPUTS, MODELS } from '../engine/defaults.js'
import { rasterizeText } from '../engine/font5x7.js'

export const PREP_TABS = [
  { label: 'Inicialización', view: 'init' },
  { label: 'Chorro', view: 'jet' },
  { label: 'Deflexión', view: 'deflect' },
  { label: 'Cabezal', view: 'head' },
  { label: 'Encoder', view: 'encoder' },
  { label: 'E/S', view: 'io' },
  { label: 'Equipo', view: 'equip' },
]
const DESCS = [
  'Reloj, idioma, modo de arranque y modelo de impresora simulado.',
  'Ajuste de gota: frecuencia piezoeléctrica y modulación para situar el punto de quiebra en el electrodo de carga.',
  'Prueba de deflexión: alta tensión (THT) y anchura de impresión para corregir caracteres deformados.',
  'Configuración monochorro / bichorro y retardo de cabezal (head delay).',
  'Fuente de velocidad: constante o encoder (tacómetro) y división tacométrica.',
  'Tarjeta interfaz industrial: asignación de entradas y salidas (relés).',
  'S8 Contrast: agitador de tinta pigmentada y kit aire fábrica (presurización del cabezal).',
]

export default function Prep() {
  const { state } = useStore()
  const t = state.nav.tab
  const Body = [InitTab, JetTab, DeflectTab, HeadTab, EncoderTab, IoTab, EquipTab][t] || InitTab
  return (
    <ScreenLayout tabs={PREP_TABS} desc={DESCS[t]}>
      <Body />
    </ScreenLayout>
  )
}

function InitTab() {
  const { state, dispatch } = useStore()
  const modal = useModal()
  const clock = state.nav.view === 'clock'
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="flex w-[34%] shrink-0 flex-col gap-1">
        <Btn active={clock} onClick={() => dispatch({ type: 'NAV', menu: 'PREP', tab: 0, view: 'clock' })}>
          Reloj (RTC)
        </Btn>
        <ChoiceField label="Idioma" value={state.hw.language} options={['ESPAÑOL', 'ENGLISH', 'FRANÇAIS']} onChange={(v) => dispatch({ type: 'SET_HW', path: 'language', value: v })} />
        <ChoiceField label="Modo arranque" value={state.hw.startMode} options={['AUTO', 'MANUAL']} onChange={(v) => dispatch({ type: 'SET_START_MODE', mode: v })} />
        <ChoiceField label="Modelo" value={state.hw.model} options={Object.entries(MODELS).map(([k, v]) => ({ value: k, label: v.label }))} onChange={(v) => dispatch({ type: 'SET_MODEL', model: v })} />
        <Btn onClick={() => modal.confirm({ label: 'Reiniciar simulador', text: '¿Restablecer la impresora a valores de fábrica? (se conserva el progreso de misiones)', onOk: () => dispatch({ type: 'RESET_ALL', keepProgress: true }) })}>
          Valores de fábrica
        </Btn>
      </div>
      <div className="scroll-y min-w-0 flex-1">{clock ? <ClockSet /> : <Info />}</div>
    </div>
  )
}

function Info() {
  const { state } = useStore()
  const mi = modelInfo(state)
  return (
    <div className="text-[12px]">
      <Section title="Versiones / opciones">
        <Readout label="Modelo" value={mi.label} />
        <Readout label="Tinta pigmentada + agitador" value={mi.pigmented ? 'SÍ' : 'NO'} />
        <Readout label="Kit aire fábrica" value={mi.airKit ? 'SÍ' : 'NO'} />
        <Readout label="Variables operador (User prompt)" value={mi.opvars ? 'SÍ' : 'NO (simulado)'} />
        <Readout label="DataMatrix" value={mi.datamatrix ? 'SÍ' : 'NO (simulado)'} />
        <Readout label="Contador horario" value={`${Math.floor(state.stats.prints / 7200)} h`} />
      </Section>
      <p className="mt-1 text-[11px] c-dim">Seleccione «Reloj (RTC)» para ajustar la fecha y la hora de la impresora.</p>
    </div>
  )
}

function ClockSet() {
  const { state, dispatch } = useStore()
  const modal = useModal()
  const now = rtcNow(state.rtcOffset)
  const [draft, setDraft] = useState(null)
  useEffect(() => setDraft(null), [state.rtcOffset])
  const v = draft || { y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate(), h: now.getHours(), m: now.getMinutes(), sec: 0 }
  const part = (k, label, min, max, w = 2) => (
    <button
      type="button"
      className={`lcd-font rounded border px-1.5 py-0.5 text-[18px] font-bold ${draft ? 'bg-sel' : 'b-line'}`}
      onClick={() => modal.numpad({ label, value: v[k], min, max, onOk: (x) => setDraft({ ...v, [k]: x }) })}
    >
      {pad(v[k], w)}
    </button>
  )
  const offMin = Math.round(state.rtcOffset / 60000)
  return (
    <div className="flex flex-col gap-1">
      <div className="lcd-font text-center text-[28px] font-bold leading-none">{formatClock(now, 'HH:MM:SS')}</div>
      <div className="text-center text-[12px]">{formatDate(now, 'DD-MMM-YYYY')} · semana {formatDate(now, 'WW')} · día juliano {formatDate(now, 'JJJ')}</div>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {part('d', 'Día', 1, 31)}/{part('mo', 'Mes', 1, 12)}/{part('y', 'Año', 2000, 2099, 4)}
        <span className="w-2" />
        {part('h', 'Hora', 0, 23)}:{part('m', 'Minutos', 0, 59)}
      </div>
      <div className="flex justify-center gap-1">
        <Btn active disabled={!draft} onClick={() => dispatch({ type: 'RTC_SET', ...v })}>
          VALIDAR HORA
        </Btn>
        <Btn disabled={!draft} onClick={() => setDraft(null)}>Cancelar</Btn>
        <Btn onClick={() => dispatch({ type: 'RTC_SYNC' })}>Sincronizar con sistema</Btn>
      </div>
      <div className="text-center text-[10.5px] c-dim">
        OFFSET RTC: {offMin >= 0 ? '+' : ''}
        {offMin} min respecto a la hora del sistema. El reloj sigue avanzando tras el ajuste.
      </div>
    </div>
  )
}

function JetTab() {
  const { state, dispatch } = useStore()
  const L = state.live
  const j = state.hw.jet
  const set = (path, value) => dispatch({ type: 'SET_HW', path, value })
  const running = state.jetState === 'RUNNING'
  const { ratio } = rayleighGain(L.velocity || 20, j.piezoFreq)
  const okB = L.breakoff >= 8 && L.breakoff <= 10
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-[50%] shrink-0">
        <NumberField label="Frecuencia piezo" value={j.piezoFreq} min={45} max={80} step={0.1} coarse={1} decimals={1} unit="kHz" onChange={(v) => set('jet.piezoFreq', v)} />
        <NumberField label="Modulación (punto quiebra)" value={j.modulation} min={0} max={250} step={1} coarse={10} unit="V" onChange={(v) => set('jet.modulation', v)} />
        <NumberField label="Consigna presión" value={j.pressureSet} min={2} max={4} step={0.05} coarse={0.2} decimals={2} unit="bar" onChange={(v) => set('jet.pressureSet', v)} />
        <div className="mt-1 flex gap-1">
          <Btn className="flex-1" onClick={() => dispatch({ type: running ? 'JET_STOP' : 'JET_START' })}>
            {running ? 'Paro chorro' : state.jetState === 'STARTING' ? 'Arrancando…' : 'Arranque chorro'}
          </Btn>
          <Btn className="flex-1" active onClick={() => dispatch({ type: 'JET_VALIDATE' })}>
            VALIDAR
          </Btn>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <JetView live={L} running={running || state.jetState === 'STARTING'} eht={L.eht} printing={canPrint(state)} className="h-[70px] shrink-0" />
        <Readout label="Control de gotas (fase)" value={running ? L.phase : '--------'} status={running ? (L.phaseOk ? 'c-ok' : 'c-bad') : ''} />
        <Readout label="Punto de quiebra" value={running ? L.breakoff.toFixed(1) : '--'} unit="gotas" status={running ? (okB ? 'c-ok' : 'c-bad') : ''} />
        <Readout label="Velocidad chorro" value={L.velocity.toFixed(2)} unit="m/s" />
        <Readout label="λ / Ø boquilla" value={ratio.toFixed(2)} status={ratio > 3.5 && ratio < 5.5 ? '' : 'c-warn'} />
        <Readout label="Fase estable" value={`${Math.min(99, Math.floor(L.phaseStableMs / 1000))} s`} />
      </div>
    </div>
  )
}

function DeflectTab() {
  const { state, dispatch } = useStore()
  const m = state.messages[state.activeMessage]
  const g = printGeometry(state)
  const hfSet = state.hw.jet.ehtSet / 7200
  const sample = rasterizeText('HE8', '16x10', 1)
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-[52%] shrink-0">
        <NumberField label="Alta tensión THT" hint={`${EHT_MIN} – ${EHT_MAX} V, paso 300`} value={state.hw.jet.ehtSet} min={EHT_MIN} max={EHT_MAX} step={300} coarse={900} unit="V" onChange={(v) => dispatch({ type: 'SET_HW', path: 'jet.ehtSet', value: v })} />
        <NumberField label={`Anchura (Width) · ${state.activeMessage}`} value={m?.params.width ?? 100} min={30} max={300} step={1} coarse={10} unit="%" onChange={(v) => dispatch({ type: 'SET_ACTIVE_MSG', path: 'params.width', value: v })} />
        <NumberField label="Velocidad impresión" hint={state.hw.encoder.source === 'ENCODER' ? 'ignorada: modo encoder' : 'modo constante'} value={m?.params.printSpeed ?? 500} min={10} max={5000} step={10} coarse={100} unit="mm/s" onChange={(v) => dispatch({ type: 'SET_ACTIVE_MSG', path: 'params.printSpeed', value: v })} />
        <Readout label="Factor anchura" value={g.wf.toFixed(2)} status={Math.abs(g.wf - 1) <= 0.1 ? 'c-ok' : 'c-bad'} />
        <Readout label="Factor altura (THT)" value={hfSet.toFixed(2)} status={Math.abs(hfSet - 1) <= 0.05 ? 'c-ok' : 'c-bad'} />
        <Btn className="mt-1 w-full" onClick={() => dispatch({ type: 'MANUAL_PRINT' })}>Impresión de prueba</Btn>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="lcd-font text-[11px] font-bold">Prueba de deflexión (patrón)</div>
        <div className="relative min-h-0 flex-1 rounded border b-line">
          <div className="absolute inset-x-2 top-1/2 border-t border-dashed b-line" />
          <DotMatrix cols={sample.cols} wf={g.wf} hf={hfSet} maxPitch={4} />
        </div>
        <div className="text-[10.5px] c-dim">Nominal: THT 7200 V y factor de anchura 1,00. Más THT → caracteres más altos.</div>
      </div>
    </div>
  )
}

function HeadTab() {
  const { state, dispatch } = useStore()
  const h = state.hw.head
  const set = (path, value) => dispatch({ type: 'SET_HW', path, value })
  const delta = h.delayJet2 - h.delayJet1 - h.physOffset
  const sample = rasterizeText('LOTE 1234', '7x5', 1)
  const two = sample.cols.map((c) => [...c, false, ...c])
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-[52%] shrink-0">
        <ChoiceField label="Configuración cabezal" value={h.jets} options={[{ value: 1, label: 'Monochorro' }, { value: 2, label: 'Bichorro' }]} onChange={(v) => set('head.jets', v)} />
        <NumberField label="Retardo chorro 1" value={h.delayJet1} min={0} max={999} step={0.5} coarse={5} decimals={1} unit="mm" onChange={(v) => set('head.delayJet1', v)} />
        <NumberField label="Retardo chorro 2" value={h.delayJet2} min={0} max={999} step={0.5} coarse={5} decimals={1} unit="mm" onChange={(v) => set('head.delayJet2', v)} />
        <Readout label="Distancia física entre boquillas" value={h.physOffset.toFixed(1)} unit="mm" />
        <Readout label="Desfase resultante" value={h.jets === 2 ? delta.toFixed(1) : '—'} unit="mm" status={h.jets === 2 ? (Math.abs(delta) <= 0.5 ? 'c-ok' : 'c-bad') : ''} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="lcd-font text-[11px] font-bold">Alineación chorro 1 / chorro 2</div>
        <div className="min-h-0 flex-1 rounded border b-line">
          <DotMatrix cols={two} maxPitch={4} twin={h.jets === 2 ? { splitY: 7, offsetDots: delta * 2.8 } : null} />
        </div>
        <div className="text-[10.5px] c-dim">Retardo chorro 2 = retardo chorro 1 + distancia entre boquillas → impresión alineada sin solapamiento.</div>
      </div>
    </div>
  )
}

function EncoderTab() {
  const { state, dispatch } = useStore()
  const e = state.hw.encoder
  const set = (path, value) => dispatch({ type: 'SET_HW', path, value })
  const mms = (state.line.speed * 1000) / 60
  const hz = (mms / e.wheelMm) * e.ppr
  const g = printGeometry(state)
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-[55%] shrink-0">
        <ChoiceField label="Fuente de velocidad" value={e.source} options={[{ value: 'CONSTANTE', label: 'Velocidad constante' }, { value: 'ENCODER', label: 'Encoder externo (tacómetro)' }]} onChange={(v) => set('encoder.source', v)} />
        <NumberField label="División tacométrica" hint="1 – 9999" value={e.division} min={1} max={9999} step={1} coarse={100} onChange={(v) => set('encoder.division', v)} />
        <NumberField label="Pulsos por vuelta" value={e.ppr} min={1} max={10000} step={1} coarse={100} unit="ppr" onChange={(v) => set('encoder.ppr', v)} />
        <NumberField label="Desarrollo rueda" value={e.wheelMm} min={10} max={1000} step={1} coarse={10} unit="mm" onChange={(v) => set('encoder.wheelMm', v)} />
      </div>
      <div className="scroll-y min-w-0 flex-1">
        <Section title="Línea">
          <NumberField label="Velocidad línea" value={state.line.speed} min={0} max={200} step={1} coarse={10} unit="m/min" onChange={(v) => dispatch({ type: 'SET_LINE', key: 'speed', value: v })} />
          <Readout label="Frecuencia encoder" value={e.source === 'ENCODER' ? hz.toFixed(0) : '—'} unit="Hz" />
          <Readout label="RPM rueda" value={e.source === 'ENCODER' ? ((mms / e.wheelMm) * 60).toFixed(0) : '—'} unit="rpm" />
          <Readout label="Factor anchura impreso" value={g.wf.toFixed(2)} status={Math.abs(g.wf - 1) <= 0.05 ? 'c-ok' : 'c-bad'} />
        </Section>
        <p className="mt-1 text-[10.5px] c-dim">Tabla de línea: división de referencia {ENCODER_DIVISION_REF} para la resolución nominal del cabezal G.</p>
      </div>
    </div>
  )
}

function IoTab() {
  const { state, dispatch } = useStore()
  const outs = outputsState(state)
  const lastPrint = Date.now() - state.lastPrintAt < 500
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-1/2">
        <Section title="Entradas">
          {state.hw.io.in.map((fn, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className={`led ${fn.startsWith('PHOTOCELL') && lastPrint ? 'amber' : ''}`} />
              <div className="min-w-0 flex-1">
                <ChoiceField label={`E${i + 1}`} value={fn} options={Object.entries(IO_INPUTS).map(([k, l]) => ({ value: k, label: l }))} onChange={(v) => dispatch({ type: 'IO_SET', dir: 'in', index: i, fn: v })} />
              </div>
            </div>
          ))}
        </Section>
        <div className="mt-1 text-[10.5px]">
          Sensor instalado en la línea: <b>fotocélula {state.line.sensorType}</b>
        </div>
      </div>
      <div className="scroll-y w-1/2">
        <Section title="Salidas (relés)">
          {state.hw.io.out.map((fn, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className={`led ${outs[i] ? (fn === 'READY' ? 'green' : 'red') : ''}`} />
              <div className="min-w-0 flex-1">
                <ChoiceField label={`S${i + 1}`} value={fn} options={Object.entries(IO_OUTPUTS).map(([k, l]) => ({ value: k, label: l }))} onChange={(v) => dispatch({ type: 'IO_SET', dir: 'out', index: i, fn: v })} />
              </div>
            </div>
          ))}
        </Section>
        <div className="mt-1 flex gap-1">
          <Btn className="flex-1" onClick={() => dispatch({ type: 'INK_SET', level: 6 })}>Simular reserva tinta</Btn>
          <Btn className="flex-1" onClick={() => dispatch({ type: 'INK_SET', level: 98 })}>Rellenar</Btn>
        </div>
      </div>
    </div>
  )
}

function EquipTab() {
  const { state, dispatch } = useStore()
  const mi = modelInfo(state)
  const a = state.hw.airKit
  const set = (path, value) => dispatch({ type: 'SET_HW', path, value })
  if (!mi.pigmented && !mi.airKit)
    return (
      <div className="p-3 text-[12px]">
        Agitador y kit aire fábrica no presentes en {mi.label}.
        <Btn className="ml-2" onClick={() => dispatch({ type: 'SET_MODEL', model: 'S8_CONTRAST' })}>Cambiar a S8 Contrast</Btn>
      </div>
    )
  const win = airKitWindow(state.hw.jet.pressureSet)
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-1/2">
        <Section title="Circuito de tinta">
          <Toggle label="Agitador tinta pigmentada" value={state.hw.agitator} on="MARCHA" off="PARO" onChange={(v) => set('agitator', v)} />
          <Readout label="Sedimentación" value={Math.round(state.live.sediment)} unit="%" status={state.live.sediment > 70 ? 'c-bad' : state.live.sediment > 40 ? 'c-warn' : 'c-ok'} />
        </Section>
        <Section title="Ambiente">
          <Readout label="Polvo en ambiente" value={state.hidden.dusty ? 'ALTO' : 'NORMAL'} status={state.hidden.dusty ? 'c-warn' : ''} />
          <Readout label="Sobrepresión cabezal" value={state.live.overpressure ? 'POSITIVA' : 'NO'} status={state.live.overpressure ? 'c-ok' : 'c-bad'} />
        </Section>
      </div>
      <div className="scroll-y w-1/2">
        <Section title="Kit aire fábrica">
          <Toggle label="Electroválvula kit aire" value={a.enabled} on="ABIERTA" off="CERRADA" onChange={(v) => set('airKit.enabled', v)} />
          <NumberField label="Red de aire (entrada)" hint="5 – 10 bar" value={a.inlet} min={0} max={12} step={0.1} decimals={1} unit="bar" onChange={(v) => set('airKit.inlet', v)} />
          <NumberField label="Regulador presión" hint={`objetivo ${win.min.toFixed(2)} – ${win.max.toFixed(2)} bar`} value={a.regulator} min={0} max={8} step={0.05} coarse={0.5} decimals={2} unit="bar" onChange={(v) => set('airKit.regulator', v)} status={state.live.overpressure ? 'c-ok' : ''} />
          <div className="mt-1 flex items-center gap-1">
            <Btn className="flex-1" onClick={() => dispatch({ type: 'AIR_PURGE' })}>Purgar filtros 5µ / 0,03µ</Btn>
            <span className={`text-[11px] ${a.purged ? 'c-ok' : 'c-warn'}`}>{a.purged ? '✓ purgado' : 'pendiente'}</span>
          </div>
        </Section>
      </div>
    </div>
  )
}
