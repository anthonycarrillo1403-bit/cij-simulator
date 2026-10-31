// Menú PRODUCCIÓN: Impresora · Mensaje · Estado/Cabezal · Mantenimiento · Defectos
import { useState } from 'react'
import { useStore, useKeyHandler } from '../state/store.jsx'
import ScreenLayout from '../components/ScreenLayout.jsx'
import Conveyor from '../components/Conveyor.jsx'
import JetView from '../components/JetView.jsx'
import { MessagePreview } from '../components/ActivePreview.jsx'
import { NumberField, Readout, Btn, Section } from '../components/Fields.jsx'
import { useModal } from '../components/Modals.jsx'
import { canPrint, DIAG_MS, modelInfo } from '../engine/sim.js'
import { FAULTS } from '../engine/faults.js'
import { counterText } from '../engine/render.js'
import { PRESSURE_MIN, PRESSURE_MAX, EHT_LEAK_LIMIT, airKitWindow, GUTTER_TOL_UM } from '../engine/jet.js'

export const PROD_TABS = [
  { label: 'Impresora', view: 'printer' },
  { label: 'Mensaje', view: 'select' },
  { label: 'Estado/Cabezal', view: 'status' },
  { label: 'Mantenimiento', view: 'maint' },
  { label: 'Defectos', view: 'faults' },
]

const DESCS = [
  'Marcha y paro de la impresora y de los chorros. Pausa e impresión manual (CTRL+P).',
  'Selección del mensaje a imprimir y visualización / inicialización del contador.',
  'Parámetros de funcionamiento del cabezal y funciones de mantenimiento del chorro.',
  'Anulación de defectos, diagnóstico THT, tests de presión, consumibles e histórico.',
  'Defectos y alarmas detectados por la impresora. Pulse uno para ver la acción correctiva.',
]

export default function Production() {
  const { state } = useStore()
  const t = state.nav.tab
  const Body = [PrinterTab, MessageTab, StatusTab, MaintTab, FaultsTab][t] || PrinterTab
  return (
    <ScreenLayout tabs={PROD_TABS} desc={DESCS[t]}>
      <Body />
    </ScreenLayout>
  )
}

function CmdList({ items }) {
  const [sel, setSel] = useState(0)
  useKeyHandler((k) => {
    if (k === 'UP') setSel((i) => (i + items.length - 1) % items.length)
    else if (k === 'DOWN') setSel((i) => (i + 1) % items.length)
    else if (k === 'ENTER') items[sel].onClick()
    else return false
    return true
  })
  return (
    <div className="flex flex-col gap-[3px]">
      {items.map((it, i) => (
        <button
          key={it.label}
          type="button"
          disabled={it.disabled}
          onClick={() => {
            setSel(i)
            it.onClick()
          }}
          className={`lcd-btn lcd-font !justify-start !py-[5px] text-left text-[12.5px] font-bold ${i === sel ? 'on' : ''}`}
        >
          {it.label}
          {it.badge && <span className="ml-auto text-[10px] font-normal">{it.badge}</span>}
        </button>
      ))}
    </div>
  )
}

function PrinterTab() {
  const { state, dispatch } = useStore()
  const m = state.messages[state.activeMessage]
  const items = [
    { label: 'Arranque', onClick: () => dispatch({ type: 'POWER_ON' }), badge: state.power === 'OFF' ? '' : '✓' },
    { label: 'Paro', onClick: () => dispatch({ type: 'POWER_OFF' }) },
    { label: 'Arranque chorro(s)', onClick: () => dispatch({ type: 'JET_START' }), badge: state.jetState === 'RUNNING' ? '✓' : '' },
    { label: 'Paro chorro(s)', onClick: () => dispatch({ type: 'JET_STOP' }) },
    { label: `Modo arranque: ${state.hw.startMode === 'AUTO' ? 'AUTO' : 'MANUAL'}`, onClick: () => dispatch({ type: 'SET_START_MODE', mode: state.hw.startMode === 'AUTO' ? 'MANUAL' : 'AUTO' }) },
    { label: state.paused ? '▶ Reanudar impresión' : '⏸ Pausa impresión', onClick: () => dispatch({ type: 'PAUSE_TOGGLE' }) },
    { label: 'Impresión manual (CTRL+P)', onClick: () => dispatch({ type: 'MANUAL_PRINT' }) },
  ]
  const jetProgress = state.jetState === 'STARTING' ? Math.round(100 - (state.jetTimer / 6000) * 100) : null
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-[36%] shrink-0">
        <CmdList items={items} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="grid grid-cols-3 gap-x-2 text-[11px]">
          <Readout label="Chorro" value={state.jetState === 'RUNNING' ? 'MARCHA' : state.jetState === 'STARTING' ? `ARR ${jetProgress}%` : state.jetState === 'STOPPING' ? 'PARO…' : 'PARADO'} status={state.jetState === 'RUNNING' ? 'c-ok' : 'c-warn'} />
          <Readout label="Impresos" value={state.stats.prints} />
          <Readout label="Contador" value={m ? counterText(m.counter) : '-'} />
          <Readout label="Productos" value={state.stats.products} />
          <Readout label="Sin marcar" value={state.stats.missed} status={state.stats.missed ? 'c-warn' : ''} />
          <Readout label="Disparo" value={m?.params.trigger.replace('_', ' ') ?? '-'} />
        </div>
        <div className="min-h-0 flex-1">
          <Conveyor />
        </div>
        {!canPrint(state) && state.power === 'ON' && state.jetState === 'RUNNING' && (
          <div className="text-[10.5px] c-warn">No imprime: {state.paused ? 'impresión en pausa' : state.adjustMode ? 'modo ajuste' : Object.keys(state.faults).length ? 'defecto activo' : 'alta tensión subiendo…'}</div>
        )}
      </div>
    </div>
  )
}

function MessageTab() {
  const { state, dispatch } = useStore()
  const modal = useModal()
  const names = Object.keys(state.messages).sort()
  const [sel, setSel] = useState(Math.max(0, names.indexOf(state.activeMessage)))
  const [filter, setFilter] = useState('')
  const shown = names.filter((n) => n.includes(filter))
  const m = state.messages[state.activeMessage]
  useKeyHandler((k) => {
    if (k === 'UP') setSel((i) => Math.max(0, i - 1))
    else if (k === 'DOWN') setSel((i) => Math.min(shown.length - 1, i + 1))
    else if (k === 'ENTER' && shown[sel]) dispatch({ type: 'SELECT_MESSAGE', name: shown[sel] })
    else return false
    return true
  })
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="flex w-[40%] shrink-0 flex-col gap-1">
        <div className="flex items-center gap-1">
          <span className="lcd-font text-[11px] font-bold">Selección mensajes</span>
          <button type="button" className="lcd-btn ml-auto !min-h-[24px] text-[11px]" onClick={() => modal.keyboard({ label: 'Buscar mensaje por nombre', value: filter, maxLen: 12, onOk: (v) => { setFilter(v.toUpperCase()); setSel(0) } })}>
            🔍 {filter || 'Buscar'}
          </button>
        </div>
        <div className="scroll-y min-h-0 flex-1 rounded border b-line">
          {shown.map((n, i) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setSel(i)
                dispatch({ type: 'SELECT_MESSAGE', name: n })
              }}
              className={`lcd-font flex w-full items-center gap-1 px-2 py-[5px] text-left text-[13px] font-bold ${i === sel ? 'bg-sel' : ''}`}
            >
              <span className="w-4">{n === state.activeMessage ? '►' : ''}</span>
              {n}
            </button>
          ))}
          {!shown.length && <div className="p-2 text-[11px] c-dim">Ningún mensaje coincide</div>}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="lcd-font text-[11px] font-bold">Mensaje en impresión: {state.activeMessage}</div>
        <div className="min-h-[50px] flex-1 rounded border b-line">
          <MessagePreview message={m} maxPitch={5} />
        </div>
        <Section title="Visua / Inic. contador">
          <Readout label="Valor contador" value={m ? counterText(m.counter) : '-'} />
          <Readout label="Límites / paso" value={m ? `${m.counter.start} → ${m.counter.end} / ${m.counter.step}` : '-'} />
          <div className="mt-1 flex gap-1">
            <Btn onClick={() => modal.confirm({ label: 'Contador', text: '¿Reinicializar el contador al valor inicial?', onOk: () => dispatch({ type: 'COUNTER_RESET' }) })}>Inicializar contador</Btn>
            <Btn onClick={() => {
              dispatch({ type: 'EDIT_OPEN', name: state.activeMessage })
              dispatch({ type: 'NAV', menu: 'EDIT', tab: 0 })
            }}>Corregir mensaje</Btn>
          </div>
        </Section>
      </div>
    </div>
  )
}

function StatusTab() {
  const { state, dispatch } = useStore()
  const L = state.live
  const running = state.jetState === 'RUNNING' || state.jetState === 'STARTING'
  const set = (path, value) => dispatch({ type: 'SET_HW', path, value })
  const fns = ['REFRESCO', 'ESTABILIDAD', 'INTRO. DISOLVENTE', 'DESOBTURACIÓN BOQUILLA']
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-[44%] shrink-0">
        <Readout label="Veloc. chorro 1" value={L.velocity.toFixed(1)} unit="m/s" />
        <Readout label="Fase chorro 1" value={running ? L.phase : '--------'} status={running ? (L.phaseOk ? 'c-ok' : 'c-bad') : ''} />
        <Readout label="Punto de quiebra" value={running ? L.breakoff.toFixed(1) : '--'} unit="gotas" status={running ? (L.breakoff >= 8 && L.breakoff <= 10 ? 'c-ok' : 'c-bad') : ''} />
        <Readout label="Presión" value={L.pressure.toFixed(2)} unit="bar" status={running && (L.pressure < PRESSURE_MIN || L.pressure > PRESSURE_MAX) ? 'c-bad' : ''} />
        <Readout label="Alta tensión (THT)" value={Math.round(L.eht)} unit="V" />
        <Readout label="Recuperación" value={running ? `${Math.round(L.recovery)}% ${L.gutterOk ? 'OK' : 'DESVÍO'}` : '--'} status={running ? (L.gutterOk ? 'c-ok' : 'c-bad') : ''} />
        <Readout label="Viscosidad" value={(4.2 + (L.sediment || 0) * 0.01).toFixed(2)} unit="cps" />
        <Readout label="Temperatura" value={L.temp.toFixed(1)} unit="°C" />
        {modelInfo(state).pigmented && <Readout label="Agitador" value={state.hw.agitator ? 'MARCHA' : 'PARADO'} status={state.hw.agitator ? 'c-ok' : 'c-bad'} />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <JetView live={L} running={running} eht={L.eht} printing={canPrint(state)} className="h-[64px] shrink-0" />
        {state.adjustMode ? (
          <div className="scroll-y min-h-0 flex-1">
            <div className="lcd-font text-[11px] font-bold c-warn">AJUSTE: control de recuperación inhibido</div>
            <NumberField label="Tornillo horizontal (X)" hint={`Desvío X ${Math.round(L.devX)} µm`} value={state.hw.jet.alignX} step={5} coarse={25} min={-200} max={200} unit="µm" onChange={(v) => set('jet.alignX', v)} status={Math.abs(L.devX) <= GUTTER_TOL_UM ? 'c-ok' : 'c-bad'} />
            <NumberField label="Tornillo vertical (Y)" hint={`Desvío Y ${Math.round(L.devY)} µm`} value={state.hw.jet.alignY} step={5} coarse={25} min={-200} max={200} unit="µm" onChange={(v) => set('jet.alignY', v)} status={Math.abs(L.devY) <= GUTTER_TOL_UM ? 'c-ok' : 'c-bad'} />
            <NumberField label="Consigna presión" value={state.hw.jet.pressureSet} step={0.05} coarse={0.2} decimals={2} min={2} max={4} unit="bar" onChange={(v) => set('jet.pressureSet', v)} />
            <div className={`lcd-font my-1 text-center text-[13px] font-bold ${L.gutterOk ? 'c-ok' : 'c-bad'}`}>SENSOR RECUPERADOR: {L.gutterOk ? 'OK' : 'DESVÍO'}</div>
            <Btn className="w-full" active onClick={() => dispatch({ type: 'ADJUST_EXIT' })}>Salir de AJUSTE</Btn>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {fns.map((f) => (
              <Btn key={f} disabled={state.jetState !== 'RUNNING'} onClick={() => dispatch({ type: 'JET_MAINT', fn: f })}>
                {f}
              </Btn>
            ))}
            <Btn active onClick={() => dispatch({ type: 'ADJUST_ENTER' })}>AJUSTE (centrado)</Btn>
            <Btn onClick={() => dispatch({ type: 'NAV', menu: 'PROD', tab: 4, view: 'faults' })}>DEFECTOS ({Object.keys(state.faults).length})</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

function MaintTab() {
  const { state, dispatch } = useStore()
  const mi = modelInfo(state)
  const d = state.diag
  const step = (k, label, n) => {
    const doneAt = d.done?.[k]
    const pct = d.running === k ? Math.round((d.progress / DIAG_MS[k]) * 100) : null
    return (
      <Btn className="flex-1 !flex-col !items-start !py-1" active={d.running === k} onClick={() => dispatch({ type: 'DIAG_START', step: k })}>
        <span>{n}. {label}</span>
        <span className="text-[10px] font-normal">{pct != null ? `en curso ${pct}%` : doneAt ? '✓ realizado' : 'pendiente'}</span>
      </Btn>
    )
  }
  const win = airKitWindow(state.hw.jet.pressureSet)
  return (
    <div className="scroll-y h-full p-1.5">
      <div className="grid grid-cols-2 gap-x-3">
        <Section title="Anulación defectos">
          <div className="flex gap-1">
            <Btn className="flex-1" onClick={() => dispatch({ type: 'FAULT_ACK' })}>Anular defectos</Btn>
            <Btn className="flex-1" active={state.hidden.coverOpen} onClick={() => dispatch({ type: 'COVER_TOGGLE' })}>
              Tapa: {state.hidden.coverOpen ? 'ABIERTA' : 'CERRADA'}
            </Btn>
          </div>
        </Section>
        <Section title="Consumibles">
          <Readout label="Nivel tinta" value={state.hidden.inkLevel.toFixed(1)} unit="%" status={state.hidden.inkLevel < 10 ? 'c-bad' : ''} />
          <div className="mt-0.5 flex gap-1">
            <Btn className="flex-1" onClick={() => dispatch({ type: 'INK_SET', level: 6 })}>Simular reserva</Btn>
            <Btn className="flex-1" onClick={() => dispatch({ type: 'INK_SET', level: 98 })}>Rellenar tinta</Btn>
          </div>
        </Section>
      </div>
      <Section title="Diagnóstico THT (alta tensión / placas deflectoras)">
        <div className="flex items-center gap-2 text-[11px]">
          <span>Fuga medida: <b className={state.live.leak > EHT_LEAK_LIMIT ? 'c-bad' : 'c-ok'}>{state.live.leak.toFixed(1)} µA</b> (límite {EHT_LEAK_LIMIT} µA)</span>
          <span className="c-dim">Chorro: {state.jetState === 'STOPPED' ? 'parado ✓' : 'en marcha — pararlo antes'}</span>
        </div>
        <div className="mt-0.5 flex gap-1">
          {step('CLEAN', 'Limpieza placas (disolvente)', 1)}
          {step('DRY', 'Secado (bomba de secado)', 2)}
          {step('TEST', 'Test aislamiento THT', 3)}
        </div>
        {d.lastLeak != null && <div className={`text-[11px] ${d.lastLeak <= EHT_LEAK_LIMIT ? 'c-ok' : 'c-bad'}`}>Último test: {d.lastLeak.toFixed(1)} µA → {d.lastLeak <= EHT_LEAK_LIMIT ? 'AISLAMIENTO CORRECTO' : 'FUGA EXCESIVA'}</div>}
      </Section>
      <div className="grid grid-cols-2 gap-x-3">
        <Section title="TESTS presión de entrada (kit aire)">
          {mi.airKit ? (
            <>
              <Readout label="Presión entrada" value={state.hw.airKit.enabled ? state.hw.airKit.regulator.toFixed(2) : '0.00'} unit="bar" />
              <Readout label="Ventana" value={`${win.min.toFixed(1)} – ${win.max.toFixed(1)}`} unit="bar" />
              <Btn className="mt-0.5 w-full" onClick={() => dispatch({ type: 'AIR_TEST' })}>Ejecutar test</Btn>
            </>
          ) : (
            <div className="text-[11px] c-dim">Kit aire fábrica no presente en este modelo</div>
          )}
        </Section>
        <Section title="Histórico (Imaje SAV)">
          <div className="lcd-font max-h-[90px] overflow-y-auto text-[10.5px]">
            {state.faultLog.slice(0, 12).map((l, i) => (
              <div key={i} className="truncate">
                {new Date(l.t).toLocaleTimeString()} {l.kind} {FAULTS[l.code]?.title}
              </div>
            ))}
            {!state.faultLog.length && <span className="c-dim">Sin registros</span>}
          </div>
        </Section>
      </div>
    </div>
  )
}

function FaultsTab() {
  const { state, dispatch } = useStore()
  const codes = Object.keys(state.faults)
  const [sel, setSel] = useState(codes[0] || null)
  const cur = sel && FAULTS[sel]
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-[44%] shrink-0">
        {codes.length === 0 && <div className="p-2 text-[12px] c-ok">Sin defectos ni alarmas activos.</div>}
        {codes.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setSel(c)
              dispatch({ type: 'FAULT_VIEW', code: c })
            }}
            className={`lcd-font mb-[3px] flex w-full items-center gap-1 rounded border b-line px-1.5 py-1 text-left text-[12px] font-bold ${sel === c ? 'bg-sel' : ''}`}
          >
            <span className={FAULTS[c].severity === 'DEFECTO' ? 'c-bad' : 'c-warn'}>{FAULTS[c].severity === 'DEFECTO' ? '⛔' : '⚠'}</span>
            <span className="truncate">
              {String(FAULTS[c].n).padStart(2, '0')} {FAULTS[c].title}
            </span>
          </button>
        ))}
        <Btn className="mt-1 w-full" onClick={() => dispatch({ type: 'FAULT_ACK' })}>Anular / aceptar defectos</Btn>
      </div>
      <div className="scroll-y min-w-0 flex-1 rounded border b-line p-1.5 text-[12px]">
        {cur ? (
          <>
            <div className={`lcd-font font-bold ${cur.severity === 'DEFECTO' ? 'c-bad' : 'c-warn'}`}>
              {cur.severity} {String(cur.n).padStart(2, '0')}: {cur.title}
            </div>
            <p className="mt-1">{cur.detail}</p>
            <p className="mt-1">
              <b>Acción:</b> {cur.remedy}
            </p>
            {sel === 'EHT' && <p className="mt-1 c-dim">Fuga actual: {state.live.leak.toFixed(1)} µA</p>}
          </>
        ) : (
          <span className="c-dim">Seleccione un defecto para ver su descripción y la acción correctiva.</span>
        )}
      </div>
    </div>
  )
}

