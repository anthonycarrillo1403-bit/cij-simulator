// Línea de producción simulada: cinta, fotocélula y último producto marcado.
import { useStore } from '../state/store.jsx'
import DotMatrix from './DotMatrix.jsx'
import { NumberField, Btn } from './Fields.jsx'

const DOTS_PER_MM = 2.8 // resolución teórica cabezal G (manual 9040)

export default function Conveyor({ compact }) {
  const { state, dispatch } = useStore()
  const p = state.prints[0]
  const recent = p && Date.now() - p.t < 700
  const twin = p && state.hw.head.jets === 2 ? { splitY: Math.floor(p.h / 2), offsetDots: p.twinOffset * DOTS_PER_MM } : null
  const dur = state.line.running && state.line.speed > 0 ? `${Math.max(0.15, 6 / state.line.speed)}s` : '0s'
  const photocellOk = state.hw.io.in.includes(state.line.sensorType === 'NPN' ? 'PHOTOCELL_NPN' : 'PHOTOCELL_PNP')
  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <div className="relative min-h-[54px] flex-1 overflow-hidden rounded border b-line" style={{ background: '#c9a46a' }}>
        {/* producto (caja de cartón) con el último marcaje */}
        <div className="absolute inset-x-[6%] inset-y-[8%] rounded-sm border border-[#8a6a3a] bg-[#d8b77f]">
          {p ? (
            <DotMatrix bits={p.bits} w={p.w} h={p.h} wf={p.wf} hf={p.hf} quality={p.quality} maxPitch={compact ? 3.2 : 4.2} color="#111" twin={twin} />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-[#5a4320]">Sin impresiones todavía</div>
          )}
        </div>
        {p && (
          <div className="absolute right-1 top-0.5 rounded bg-black/55 px-1 text-[9px] text-white">
            #{p.id} · W×{p.wf.toFixed(2)} H×{p.hf.toFixed(2)}
            {state.hw.head.jets === 2 && ` · Δ ${p.twinOffset.toFixed(1)} mm`}
          </div>
        )}
      </div>
      <div className="relative h-3 rounded-sm conveyor" style={{ '--belt-dur': dur, animationPlayState: state.line.running ? 'running' : 'paused' }}>
        <span className={`absolute left-1 top-[1px] led ${recent ? 'amber' : ''}`} title="Fotocélula" />
        <span className="absolute left-4 top-[-1px] text-[9px] text-white/80">
          {state.line.sensorType} {photocellOk ? '' : '· ¡entrada no asignada!'}
        </span>
      </div>
      {!compact && (
        <div className="flex items-center gap-1">
          <Btn active={state.line.running} onClick={() => dispatch({ type: 'SET_LINE', key: 'running', value: !state.line.running })}>
            {state.line.running ? '■ Línea' : '▶ Línea'}
          </Btn>
          <div className="min-w-0 flex-1">
            <NumberField compact label="m/min" value={state.line.speed} min={0} max={200} step={1} coarse={10} onChange={(v) => dispatch({ type: 'SET_LINE', key: 'speed', value: v })} />
          </div>
          <Btn onClick={() => dispatch({ type: 'PRODUCT_TRIGGER' })}>TOP</Btn>
        </div>
      )}
    </div>
  )
}
