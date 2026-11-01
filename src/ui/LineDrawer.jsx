// Cajón lateral «Línea»: lo que el operador ve alrededor de la máquina (no en su pantalla):
// la cinta con el producto marcado, el cabezal con lupa, el nivel de tinta y acciones físicas.
import { useStore } from '../state/store.jsx'
import DotMatrix from '../components/DotMatrix.jsx'
import JetView from '../components/JetView.jsx'
import { useState } from 'react'
import { canPrint, DIAG_MS } from '../engine/sim.js'

const DOTS_PER_MM = 2.8

function Small({ children, onClick, active, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[11.5px] font-bold active:scale-95 ${danger ? 'bg-red-700 text-white' : active ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-100'}`}
    >
      {children}
    </button>
  )
}

// Sección resaltable (el tutor la señala cuando el paso se hace en la máquina física)
function Section({ id, focus, title, children }) {
  const on = focus === id
  return (
    <div className={`rounded-lg p-1.5 ${on ? 'border-2 border-yellow-300 bg-yellow-300/10 shadow-[0_0_14px_rgba(253,224,71,.5)]' : 'border border-slate-700/70'}`}>
      <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-200">
        {on && <span className="coach-arrow-x text-yellow-300">▶</span>}
        {title}
      </div>
      {children}
    </div>
  )
}

function Stepper({ label, value, unit, onStep, fine = 1, coarse = 10 }) {
  return (
    <div className="flex items-center gap-1 text-[11.5px]">
      <span className="w-[74px] shrink-0 text-slate-300">{label}</span>
      <Small onClick={() => onStep(-coarse)}>«</Small>
      <Small onClick={() => onStep(-fine)}>‹</Small>
      <span className="w-[62px] text-center font-mono font-bold">
        {value}
        {unit}
      </span>
      <Small onClick={() => onStep(fine)}>›</Small>
      <Small onClick={() => onStep(coarse)}>»</Small>
    </div>
  )
}

export default function LineDrawer({ open, onClose, focus }) {
  const { state, dispatch } = useStore()
  const [frame, setFrame] = useState('PED-00123')
  const twinJets = state.hw.head.jets === 2
  const setHw = (path, value) => dispatch({ type: 'SET_HW', path, value })
  const diag = state.diag.running
  const diagPct = diag ? Math.round((state.diag.progress / DIAG_MS[diag]) * 100) : 0
  const p = state.prints[0]
  const twin = p && state.hw.head.jets === 2 ? { splitY: Math.floor(p.h / 2), offsetDots: p.twinOffset * DOTS_PER_MM } : null
  const dur = state.line.running && state.line.speed > 0 ? `${Math.max(0.15, 6 / state.line.speed)}s` : '0s'
  const recent = p && Date.now() - p.t < 700
  const photocellOk = state.hw.io.in.includes(state.line.sensorType === 'NPN' ? 'PHOTOCELL_NPN' : 'PHOTOCELL_PNP')
  const L = state.live
  const running = state.jetState === 'RUNNING'
  const ink = Math.round(state.hidden.inkLevel)
  const setLine = (key, value) => dispatch({ type: 'SET_LINE', key, value })

  return (
    <>
      {open && <div className="absolute inset-0 z-40 bg-black/30" onClick={onClose} />}
      <aside
        className={`absolute bottom-0 right-0 top-0 z-50 flex w-[min(330px,62%)] flex-col gap-1.5 overflow-y-auto border-l border-slate-700 bg-[#0f1828] p-2 text-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center">
          <div className="text-[13px] font-black">Línea de producción</div>
          <button type="button" onClick={onClose} className="ml-auto rounded bg-slate-700 px-2 py-0.5 text-[12px] font-bold">
            ✕
          </button>
        </div>

        <Section id="product" focus={focus} title="Último producto marcado">
        <div className="relative h-[92px] shrink-0 overflow-hidden rounded border border-[#8a6a3a]" style={{ background: '#c9a46a' }}>
          <div className="absolute inset-x-[5%] inset-y-[8%] rounded-sm border border-[#8a6a3a] bg-[#d8b77f]">
            {p ? (
              <DotMatrix bits={p.bits} w={p.w} h={p.h} wf={p.wf} hf={p.hf} quality={p.quality} maxPitch={3.4} color="#111" twin={twin} />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-[#5a4320]">Sin impresiones todavía</div>
            )}
          </div>
          {p && (
            <div className="absolute right-1 top-0.5 rounded bg-black/55 px-1 text-[9px]">
              #{p.id} · {p.msg}
              {state.hw.head.jets === 2 && ` · desfase ${p.twinOffset.toFixed(1)} mm`}
            </div>
          )}
        </div>
        <div className="relative h-3 shrink-0 rounded-sm conveyor" style={{ '--belt-dur': dur, animationPlayState: state.line.running ? 'running' : 'paused' }}>
          <span className={`absolute left-1 top-[1px] led ${recent ? 'amber' : ''}`} />
          <span className="absolute left-4 top-[-1px] text-[9px] text-white/80">
            Fotocélula {state.line.sensorType} {photocellOk ? '' : '· ¡entrada no asignada!'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Small active={state.line.running} onClick={() => setLine('running', !state.line.running)}>
            {state.line.running ? '■ Parar cinta' : '▶ Mover cinta'}
          </Small>
          <Small onClick={() => setLine('speed', Math.max(0, state.line.speed - 5))}>−</Small>
          <span className="w-[62px] text-center text-[12px] font-bold">{state.line.speed} m/min</span>
          <Small onClick={() => setLine('speed', Math.min(200, state.line.speed + 5))}>+</Small>
          <Small onClick={() => dispatch({ type: 'PRODUCT_TRIGGER' })}>📦 Pasar 1 producto</Small>
        </div>
        </Section>

        <Section id="pot" focus={focus} title={twinJets ? 'Cabezal: potenciómetro de quiebra (chorros 1.1 / 1.2)' : 'Cabezal: potenciómetro de quiebra (chorro 1.1)'}>
        <div className="mb-1 text-[10.5px] text-slate-400">Vista con lupa (estroboscopio). Gira el potenciómetro hasta que el punto de quiebra quede en el electrodo de carga (8-10 gotas, fase 00111100).</div>
        <JetView live={L} running={running || state.jetState === 'STARTING'} eht={L.eht} printing={canPrint(state)} className="h-[64px] shrink-0" />
        <div className="grid grid-cols-3 gap-1 text-center text-[10.5px]">
          <div className="rounded bg-black/30 py-0.5">Presión<br /><b>{L.pressure.toFixed(2)} bar</b></div>
          <div className="rounded bg-black/30 py-0.5">Quiebra<br /><b>{L.breakoff ? `${L.breakoff.toFixed(1)} gotas` : '—'}</b></div>
          <div className="rounded bg-black/30 py-0.5">Canal<br /><b className={L.gutterOk ? 'text-emerald-300' : 'text-red-300'}>{running ? (L.gutterOk ? 'OK' : 'DESVÍO') : '—'}</b></div>
        </div>
        <div className="mt-1">
          <Stepper label="Potenciómetro" value={Math.round(state.hw.jet.modulation)} unit="" fine={5} coarse={25} onStep={(d) => setHw('jet.modulation', Math.max(40, Math.min(400, state.hw.jet.modulation + d)))} />
          <div className="mt-0.5 text-[10.5px]">
            Fase: <b className="font-mono">{running ? L.phase : '--------'}</b> {running && (L.phaseOk ? <span className="text-emerald-300">correcta</span> : <span className="text-red-300">incorrecta</span>)}
          </div>
        </div>
        </Section>

        <Section id="cams" focus={focus} title="Cabezal: excéntricas del cañón (centrado en el canal)">
          <Stepper label="Horizontal" value={state.hw.jet.alignX} unit=" µm" fine={5} coarse={25} onStep={(d) => setHw('jet.alignX', Math.max(-200, Math.min(200, state.hw.jet.alignX + d)))} />
          <Stepper label="Vertical" value={state.hw.jet.alignY} unit=" µm" fine={5} coarse={25} onStep={(d) => setHw('jet.alignY', Math.max(-200, Math.min(200, state.hw.jet.alignY + d)))} />
          <div className="text-[10.5px] text-slate-300">
            Desvío X {Math.round(L.devX)} µm · Y {Math.round(L.devY)} µm {running ? (L.gutterOk ? '· chorro dentro del canal ✔' : '· fuera del canal') : '· (arranca el chorro para verlo)'}
          </div>
        </Section>

        <Section id="plates" focus={focus} title="Cabezal: placas de deflexión (con el chorro parado)">
          <div className="flex flex-wrap gap-1">
            <Small onClick={() => dispatch({ type: 'DIAG_START', step: 'CLEAN' })}>🧽 Limpiar placas con disolvente</Small>
            <Small onClick={() => dispatch({ type: 'DIAG_START', step: 'DRY' })}>💨 Secar con bomba de secado</Small>
          </div>
          {diag && (
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/40">
              <div className="h-full bg-sky-400" style={{ width: `${diagPct}%` }} />
            </div>
          )}
          <div className="text-[10.5px] text-slate-300">
            Placas: {state.hidden.platesWet ? 'húmedas' : state.hidden.platesDirt > 0.3 ? 'sucias (tinta acumulada)' : 'limpias y secas'}
          </div>
        </Section>

        {(
          <Section id="v24" focus={focus} title="Terminal V24 (ordenador del ERP)">
            <div className="flex gap-1">
              <input value={frame} onChange={(e) => setFrame(e.target.value.toUpperCase().slice(0, 32))} className="min-w-0 flex-1 rounded bg-black/40 px-1.5 py-1 font-mono text-[12px] text-white" />
              <Small onClick={() => dispatch({ type: 'V24_FRAME', data: frame })}>Enviar</Small>
            </div>
            {state.hw.v24.lastFrame && <div className="mt-0.5 font-mono text-[10px] text-slate-400">{state.hw.v24.lastFrame}</div>}
          </Section>
        )}
        <Section id="ink" focus={focus} title="Consumibles y tapa del cabezal">
        <div className="flex items-center gap-1.5 text-[11.5px]">
          <span>Tinta</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/40">
            <div className={`h-full ${ink < 10 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${ink}%` }} />
          </div>
          <span className="w-8 text-right font-bold">{ink}%</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Small onClick={() => dispatch({ type: 'INK_SET', level: 98 })}>🧴 Rellenar tinta</Small>
          <Small onClick={() => dispatch({ type: 'INK_SET', level: 6 })}>Simular reserva</Small>
          <Small active={state.hidden.coverOpen} danger={state.hidden.coverOpen} onClick={() => dispatch({ type: 'COVER_TOGGLE' })}>
            Tapa cabezal: {state.hidden.coverOpen ? 'ABIERTA' : 'cerrada'}
          </Small>
        </div>
        </Section>
      </aside>
    </>
  )
}
