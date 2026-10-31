// Menú VARIABLES DE OPERADOR / V24: entradas de datos dinámicos de planta.
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import ScreenLayout from '../components/ScreenLayout.jsx'
import { MessagePreview } from '../components/ActivePreview.jsx'
import { ChoiceField, NumberField, TextField, Btn, Section, Readout } from '../components/Fields.jsx'
import { useModal } from '../components/Modals.jsx'
import { messageHasField } from '../engine/render.js'

export const OPVAR_TABS = [
  { label: 'Variables operador', view: 'opvars' },
  { label: 'Puerto V24', view: 'v24' },
  { label: 'Terminal V24', view: 'terminal' },
]
const DESCS = [
  'User prompts (9040): el operador introduce lote, pedido… sin editar el mensaje. Tecla F6.',
  'Comunicación V24 / RS232: velocidad, paridad, bits de datos y de stop, protocolo.',
  'Simulador de host (ERP/PLC): envía tramas al puerto V24 que alimentan los campos «Externa».',
]

export default function OpVars() {
  const { state } = useStore()
  const t = state.nav.tab
  const Body = [OpvarTab, PortTab, TerminalTab][t] || OpvarTab
  return (
    <ScreenLayout tabs={OPVAR_TABS} desc={DESCS[t]}>
      <Body />
    </ScreenLayout>
  )
}

function OpvarTab() {
  const { state, dispatch } = useStore()
  const modal = useModal()
  const [defIdx, setDefIdx] = useState(null)
  const used = (name) => messageHasField(state.messages[state.activeMessage] || { lines: [] }, (f) => (f.type === 'opvar' || (f.type === 'barcode' && f.source === 'opvar')) && f.name === name)
  const v = defIdx != null ? state.opvars[defIdx] : null
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-[55%] shrink-0">
        <Section title="Introducción de valores (producción)">
          {state.opvars.map((o, i) => (
            <div key={o.name} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <TextField label={`${used(o.name) ? '► ' : ''}${o.name}`} value={o.value} placeholder={`(def. ${o.def || '—'})`} maxLen={o.size} upper onChange={(val) => dispatch({ type: 'OPVAR_SET', name: o.name, value: val })} />
              </div>
              <button type="button" className={`lcd-btn !min-h-[24px] text-[11px] ${defIdx === i ? 'on' : ''}`} onClick={() => setDefIdx(defIdx === i ? null : i)}>
                ⚙
              </button>
            </div>
          ))}
        </Section>
        <div className="mt-1 flex gap-1">
          <Btn onClick={() => modal.keyboard({ label: 'Nombre de la nueva variable', value: '', maxLen: 10, upper: true, onOk: (n) => n && dispatch({ type: 'OPVAR_ADD', name: n }) })}>+ Nueva variable</Btn>
        </div>
        <p className="mt-1 text-[10.5px] c-dim">► = utilizada en el mensaje en impresión ({state.activeMessage}).</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {v ? (
          <Section title={`Definición: ${v.name}`}>
            <NumberField label="Tamaño (car.)" value={v.size} min={1} max={99} onChange={(x) => dispatch({ type: 'OPVAR_DEF', index: defIdx, patch: { size: x } })} />
            <TextField label="Valor por defecto" value={v.def} maxLen={v.size} onChange={(x) => dispatch({ type: 'OPVAR_DEF', index: defIdx, patch: { def: x } })} />
            <Btn className="mt-1" onClick={() => modal.confirm({ label: 'Suprimir', text: `¿Suprimir la variable ${v.name}?`, onOk: () => { dispatch({ type: 'OPVAR_REMOVE', index: defIdx }); setDefIdx(null) } })}>
              Suprimir variable
            </Btn>
          </Section>
        ) : (
          <>
            <div className="lcd-font text-[11px] font-bold">Vista del mensaje {state.activeMessage}</div>
            <div className="min-h-[50px] flex-1 rounded border b-line">
              <MessagePreview message={state.messages[state.activeMessage]} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PortTab() {
  const { state, dispatch } = useStore()
  const p = state.hw.v24
  const set = (k, value) => dispatch({ type: 'SET_HW', path: `v24.${k}`, value })
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y w-[55%] shrink-0">
        <ChoiceField label="Velocidad (baudios)" value={p.baud} options={[4800, 9600, 19200, 38400]} onChange={(v) => set('baud', v)} />
        <ChoiceField label="Paridad" value={p.parity} options={['NINGUNA', 'PAR', 'IMPAR']} onChange={(v) => set('parity', v)} />
        <ChoiceField label="Bits de datos" value={p.bits} options={[7, 8]} onChange={(v) => set('bits', v)} />
        <ChoiceField label="Bits de stop" value={p.stop} options={[1, 2]} onChange={(v) => set('stop', v)} />
        <ChoiceField label="Protocolo" value={p.protocol} options={['IMAJE', 'ASCII STX/ETX', 'XON/XOFF']} onChange={(v) => set('protocol', v)} />
      </div>
      <div className="scroll-y min-w-0 flex-1">
        <Section title="Estado del enlace">
          <Readout label="Trama" value={`${p.baud} ${p.bits}${p.parity[0]}${p.stop}`} />
          <Readout label="Datos recibidos" value={p.data || '—'} />
          <Readout label="Última trama" value={p.lastFrame ? p.lastFrame.split('  ')[0] : '—'} />
        </Section>
        <p className="mt-1 text-[10.5px] c-dim">El host debe usar la misma configuración. Los datos recibidos alimentan los campos «Externa» y los códigos de barras con origen V24.</p>
      </div>
    </div>
  )
}

function TerminalTab() {
  const { state, dispatch } = useStore()
  const modal = useModal()
  const [log, setLog] = useState([])
  const [txt, setTxt] = useState('PED-778812')
  const send = () => {
    dispatch({ type: 'V24_FRAME', data: txt })
    setLog((l) => [`${new Date().toLocaleTimeString()} → STX ${txt} ETX  ACK`, ...l].slice(0, 8))
  }
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="flex w-[50%] shrink-0 flex-col gap-1">
        <TextField label="Datos a enviar" value={txt} maxLen={40} upper={false} onChange={setTxt} />
        <div className="flex gap-1">
          <Btn className="flex-1" active onClick={send}>
            Enviar trama ⇄
          </Btn>
          <Btn onClick={() => setTxt(`LOT${Math.floor(Math.random() * 90000 + 10000)}`)}>Aleatorio</Btn>
          <Btn onClick={() => modal.keyboard({ label: 'Datos a enviar', value: txt, maxLen: 40, upper: false, onOk: setTxt })}>✎</Btn>
        </div>
        <div className="lcd-font min-h-0 flex-1 overflow-y-auto rounded border b-line p-1 text-[10.5px]">
          {log.map((l, i) => (
            <div key={i} className="truncate">
              {l}
            </div>
          ))}
          {!log.length && <span className="c-dim">Host ERP/PLC listo · {state.hw.v24.baud} bd</span>}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="lcd-font text-[11px] font-bold">Mensaje en impresión: {state.activeMessage}</div>
        <div className="min-h-[50px] flex-1 rounded border b-line">
          <MessagePreview message={state.messages[state.activeMessage]} />
        </div>
      </div>
    </div>
  )
}
