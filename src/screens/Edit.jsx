// Menú EDICIÓN DE MENSAJE (WYSIWYG): Mensaje · Fuente · Variables · Parámetros
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import ScreenLayout from '../components/ScreenLayout.jsx'
import { MessagePreview } from '../components/ActivePreview.jsx'
import { NumberField, TextField, ChoiceField, Toggle, Btn, Section } from '../components/Fields.jsx'
import { useModal } from '../components/Modals.jsx'
import { fieldText, FIELD_LABELS, FONTS } from '../engine/render.js'
import { DATE_FORMATS, CLOCK_FORMATS, rtcNow } from '../engine/rtc.js'
import { modelInfo } from '../engine/sim.js'

export const EDIT_TABS = [
  { label: 'Mensaje', view: 'edit-msg' },
  { label: 'Fuente', view: 'edit-font' },
  { label: 'Variables', view: 'edit-vars' },
  { label: 'Parámetros', view: 'edit-params' },
]
const DESCS = [
  'Nuevo, Abrir, Guardar, Guardar como, Borrar, Cargar impresora y Cerrar mensaje.',
  'Fuente y dilatación del campo seleccionado, texto libre y códigos de barras.',
  'Insertar elementos variables: contador, reloj, fecha, caducidad, turno, externa V24, variables de operador.',
  'Parámetros del mensaje y de sus variables (todos son propios de cada mensaje).',
]
const ICON = { text: 'T', date: '📅', clock: '🕒', expiry: '⌛', shift: '⇆', counter: '#', opvar: '✎', external: '⇄', barcode: '▥' }

export default function Edit() {
  const { state } = useStore()
  const [sel, setSel] = useState({ line: 0, index: null })
  const ed = state.editing
  const t = state.nav.tab
  const Body = [MessageTab, FontTab, VarsTab, ParamsTab][t] || MessageTab
  const lines = ed?.message.lines || []
  const safeSel = { line: Math.min(sel.line, Math.max(0, lines.length - 1)), index: sel.index != null && lines[sel.line]?.[sel.index] ? sel.index : null }
  return (
    <ScreenLayout tabs={EDIT_TABS} desc={DESCS[t]} msgName={ed ? `${ed.message.name}${ed.dirty ? ' *' : ''}` : '— sin mensaje abierto —'} help="Toque un campo para seleccionarlo · los insertos se colocan tras el campo seleccionado">
      <div className="flex h-full flex-col">
        {ed ? <Wysiwyg sel={safeSel} setSel={setSel} /> : null}
        <div className="min-h-0 flex-1 overflow-hidden">
          <Body sel={safeSel} setSel={setSel} />
        </div>
      </div>
    </ScreenLayout>
  )
}

function Wysiwyg({ sel, setSel }) {
  const { state, dispatch } = useStore()
  const m = state.editing.message
  const ctx = { now: rtcNow(state.rtcOffset), opvars: state.opvars, v24: state.hw.v24, message: m }
  return (
    <div className="shrink-0 border-b-2 b-line">
      <div className="h-[52px] px-1">
        <MessagePreview message={m} maxPitch={4} />
      </div>
      <div className="scroll-y max-h-[66px] px-1 pb-0.5">
        {m.lines.map((l, li) => (
          <div key={li} className="flex items-center gap-[3px] py-[1px]">
            <button type="button" onClick={() => setSel({ line: li, index: null })} className={`lcd-font w-7 shrink-0 rounded text-[10px] font-bold ${sel.line === li && sel.index == null ? 'bg-sel' : 'border b-line'}`}>
              L{li + 1}
            </button>
            <div className="scroll-x flex min-w-0 flex-1 gap-[3px]">
              {l.map((f, fi) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSel({ line: li, index: fi })}
                  className={`lcd-font flex max-w-[150px] shrink-0 items-center gap-0.5 rounded border px-1 py-[1px] text-[11px] ${sel.line === li && sel.index === fi ? 'bg-sel' : 'b-line'}`}
                >
                  <span className="opacity-70">{ICON[f.type]}</span>
                  <span className="truncate">{f.type === 'barcode' ? `${f.symbology}` : fieldText(f, ctx)}</span>
                </button>
              ))}
              {!l.length && <span className="text-[10px] c-dim">línea vacía</span>}
            </div>
            {m.lines.length > 1 && (
              <button type="button" className="text-[11px] c-dim" onClick={() => dispatch({ type: 'EDIT_REMOVE_LINE', line: li })}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Inserta un campo tras la selección actual
function useInsert(sel, setSel) {
  const { state, dispatch } = useStore()
  return (field) => {
    if (!state.editing) return
    const line = sel.line
    const len = state.editing.message.lines[line]?.length || 0
    const index = sel.index == null ? len : sel.index + 1
    dispatch({ type: 'EDIT_INSERT', line, index, field })
    setSel({ line, index })
  }
}

function NeedMessage() {
  return <div className="p-3 text-[12px] c-dim">Abra o cree un mensaje en la pestaña «Mensaje» para editarlo.</div>
}

function MessageTab({ setSel }) {
  const { state, dispatch } = useStore()
  const modal = useModal()
  const ed = state.editing
  const names = Object.keys(state.messages).sort()
  const nameOk = (v) => /^[A-Z0-9_-]{1,12}$/.test(v)
  const openList = () =>
    modal.choice({
      label: 'Abrir mensaje',
      options: names.map((n) => ({ value: n, label: n })),
      value: ed?.original,
      onOk: (n) => {
        dispatch({ type: 'EDIT_OPEN', name: n })
        setSel({ line: 0, index: null })
      },
    })
  const items = [
    { l: 'Nuevo', fn: () => modal.keyboard({ label: 'Nombre del nuevo mensaje (máx. 12)', value: '', maxLen: 12, upper: true, validate: nameOk, onOk: (v) => { dispatch({ type: 'EDIT_NEW', name: v }); setSel({ line: 0, index: null }) } }) },
    { l: 'Abrir', fn: openList },
    { l: 'Guardar', fn: () => dispatch({ type: 'EDIT_SAVE' }), need: true },
    { l: 'Guardar como', fn: () => modal.keyboard({ label: 'Guardar como…', value: ed?.message.name, maxLen: 12, upper: true, validate: nameOk, onOk: (v) => dispatch({ type: 'EDIT_SAVE_AS', name: v }) }), need: true },
    { l: 'Borrar', fn: () => modal.choice({ label: 'Borrar mensaje (irreversible)', options: names.map((n) => ({ value: n, label: n })), onOk: (n) => modal.confirm({ label: 'Borrar', text: `¿Borrar definitivamente ${n}?`, onOk: () => dispatch({ type: 'MSG_DELETE', name: n }) }) }) },
    { l: 'Cargar impresora', fn: () => dispatch({ type: 'EDIT_LOAD_PRINTER' }), need: true },
    { l: 'Cerrar', fn: () => (ed?.dirty ? modal.confirm({ label: 'Cerrar', text: '¿Guardar las modificaciones antes de cerrar?', onOk: () => { dispatch({ type: 'EDIT_SAVE' }); dispatch({ type: 'EDIT_CLOSE' }) } }) : dispatch({ type: 'EDIT_CLOSE' })), need: true },
    { l: '+ Línea', fn: () => dispatch({ type: 'EDIT_ADD_LINE' }), need: true },
  ]
  return (
    <div className="flex h-full flex-col gap-1 p-1.5">
      <div className="grid grid-cols-4 gap-1">
        {items.map((it) => (
          <Btn key={it.l} disabled={it.need && !ed} onClick={it.fn}>
            {it.l}
          </Btn>
        ))}
      </div>
      {!ed && (
        <div className="text-[11px] c-dim">
          Mensajes en memoria: {names.join(' · ')}
          <button type="button" className="ml-2 underline" onClick={() => dispatch({ type: 'MSG_RESTORE_DEFAULTS' })}>
            restaurar ejemplos
          </button>
        </div>
      )}
      {ed && <div className="text-[11px] c-dim">Líneas: {ed.message.lines.length}/4 · Campos: {ed.message.lines.flat().length} · Para imprimir los cambios use «Cargar impresora».</div>}
    </div>
  )
}

function SelectedFieldTools({ sel, setSel }) {
  const { state, dispatch } = useStore()
  const modal = useModal()
  const f = state.editing.message.lines[sel.line]?.[sel.index]
  if (!f) return <div className="text-[11px] c-dim">Seleccione un campo en la zona WYSIWYG para cambiar su fuente o editarlo.</div>
  const upd = (patch) => dispatch({ type: 'EDIT_UPDATE_FIELD', line: sel.line, index: sel.index, patch })
  const editField = () => {
    if (f.type === 'text') modal.keyboard({ label: 'Texto', value: f.value, maxLen: 40, upper: false, onOk: (v) => upd({ value: v }) })
    else if (f.type === 'date' || f.type === 'expiry') modal.choice({ label: 'Formato fecha', value: f.format, options: DATE_FORMATS, onOk: (v) => upd({ format: v }) })
    else if (f.type === 'clock') modal.choice({ label: 'Formato reloj', value: f.format, options: CLOCK_FORMATS, onOk: (v) => upd({ format: v }) })
    else if (f.type === 'opvar') modal.choice({ label: 'Variable de operador', value: f.name, options: state.opvars.map((o) => o.name), onOk: (v) => upd({ name: v }) })
    else if (f.type === 'external') modal.numpad({ label: 'Nº de emplazamientos V24', value: f.len, min: 1, max: 40, onOk: (v) => upd({ len: v }) })
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="lcd-font text-[11px] font-bold">
        Campo: {FIELD_LABELS[f.type]} {f.type === 'barcode' ? f.symbology : ''}
      </div>
      <div className="flex flex-wrap gap-1">
        <Btn onClick={() => {
            dispatch({ type: 'EDIT_MOVE_FIELD', line: sel.line, index: sel.index, dir: -1 })
            setSel({ ...sel, index: Math.max(0, sel.index - 1) })
          }}>◄ Mover</Btn>
        <Btn onClick={() => {
            dispatch({ type: 'EDIT_MOVE_FIELD', line: sel.line, index: sel.index, dir: 1 })
            setSel({ ...sel, index: Math.min(state.editing.message.lines[sel.line].length - 1, sel.index + 1) })
          }}>Mover ►</Btn>
        {f.type !== 'barcode' && f.type !== 'counter' && f.type !== 'shift' && <Btn onClick={editField}>✎ Modificar</Btn>}
        <Btn
          onClick={() => {
            dispatch({ type: 'EDIT_REMOVE_FIELD', line: sel.line, index: sel.index })
            setSel({ line: sel.line, index: sel.index > 0 ? sel.index - 1 : null })
          }}
        >
          🗑 Suprimir
        </Btn>
      </div>
      {f.type !== 'barcode' && (
        <>
          <ChoiceField label="Selección fuente" value={f.font} options={Object.entries(FONTS).map(([k, v]) => ({ value: k, label: v.label }))} onChange={(v) => upd({ font: v })} />
          <NumberField label="Dilatación (negrita)" value={f.bold} min={1} max={9} onChange={(v) => upd({ bold: v })} />
        </>
      )}
      {f.type === 'barcode' && <BarcodeEditor f={f} upd={upd} />}
    </div>
  )
}

function BarcodeEditor({ f, upd }) {
  const { state } = useStore()
  return (
    <>
      <ChoiceField label="Simbología" value={f.symbology} options={[{ value: 'CODE128', label: 'Code 128' }, { value: 'DATAMATRIX', label: 'DataMatrix ECC200' }]} onChange={(v) => upd({ symbology: v })} hint={f.symbology === 'DATAMATRIX' && !modelInfo(state).datamatrix ? 'Opción de software 9040' : undefined} />
      <ChoiceField
        label="Origen de datos"
        value={f.source}
        options={[
          { value: 'text', label: 'Texto fijo' },
          { value: 'external', label: 'Externa V24' },
          { value: 'opvar', label: 'Variable operador' },
          { value: 'counter', label: 'Contador' },
          { value: 'date', label: 'Fecha AAMMDD' },
        ]}
        onChange={(v) => upd({ source: v, name: v === 'opvar' ? f.name || state.opvars[0]?.name : f.name })}
      />
      {f.source === 'text' && <TextField label="Datos" value={f.value || ''} maxLen={40} upper={false} onChange={(v) => upd({ value: v })} />}
      {f.source === 'opvar' && <ChoiceField label="Variable" value={f.name} options={state.opvars.map((o) => o.name)} onChange={(v) => upd({ name: v })} />}
      {f.symbology === 'CODE128' && <NumberField label="Altura" value={f.height || 14} min={5} max={32} unit="pt" onChange={(v) => upd({ height: v })} />}
    </>
  )
}

function FontTab({ sel, setSel }) {
  const { state } = useStore()
  const modal = useModal()
  const insert = useInsert(sel, setSel)
  if (!state.editing) return <NeedMessage />
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y flex w-[34%] shrink-0 flex-col gap-1">
        <Btn onClick={() => modal.keyboard({ label: 'Insertar texto', value: '', maxLen: 40, upper: false, onOk: (v) => v && insert({ type: 'text', value: v }) })}>+ Texto</Btn>
        <Btn onClick={() => insert({ type: 'barcode', symbology: 'CODE128', source: 'text', value: '123456', height: 14 })}>+ Código de barras 128</Btn>
        <Btn onClick={() => insert({ type: 'barcode', symbology: 'DATAMATRIX', source: 'text', value: 'LOTE' })}>+ DataMatrix</Btn>
        <div className="text-[10px] c-dim">Las fuentes «H» de mayor altura ocupan varias líneas del chorro (WYSIWYG).</div>
      </div>
      <div className="scroll-y min-w-0 flex-1">
        <SelectedFieldTools sel={sel} setSel={setSel} />
      </div>
    </div>
  )
}

function VarsTab({ sel, setSel }) {
  const { state } = useStore()
  const modal = useModal()
  const insert = useInsert(sel, setSel)
  if (!state.editing) return <NeedMessage />
  const fmt = (label, list, fn) => modal.choice({ label, options: list, value: list[0], onOk: fn })
  const items = [
    { l: 'Contador', fn: () => insert({ type: 'counter' }) },
    { l: 'Reloj', fn: () => fmt('Componer variable Reloj', CLOCK_FORMATS, (v) => insert({ type: 'clock', format: v })) },
    { l: 'Fecha', fn: () => fmt('Componer variable Fecha', DATE_FORMATS, (v) => insert({ type: 'date', format: v })) },
    { l: 'Caducidad', fn: () => fmt('Componer Caducidad', DATE_FORMATS, (v) => insert({ type: 'expiry', slot: 1, format: v })) },
    { l: 'Caducidad 2', fn: () => fmt('Componer Caducidad 2', DATE_FORMATS, (v) => insert({ type: 'expiry', slot: 2, format: v })) },
    { l: 'Turno de trabajo', fn: () => insert({ type: 'shift' }) },
    { l: 'Externa (V24)', fn: () => modal.numpad({ label: 'Emplazamientos a reservar', value: 8, min: 1, max: 40, onOk: (n) => insert({ type: 'external', len: n, symbol: '?' }) }) },
    { l: 'Var. operador', fn: () => modal.choice({ label: 'Variable de operador (User prompt)', options: state.opvars.map((o) => ({ value: o.name, label: `${o.name} (${o.size} car.)` })), value: state.opvars[0]?.name, onOk: (v) => insert({ type: 'opvar', name: v }) }) },
  ]
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="scroll-y grid w-[52%] shrink-0 grid-cols-2 content-start gap-1 pr-0.5 [&>button]:!min-h-[26px] [&>button]:!py-0">
        {items.map((it) => (
          <Btn key={it.l} onClick={it.fn}>
            + {it.l}
          </Btn>
        ))}
      </div>
      <div className="scroll-y min-w-0 flex-1">
        <SelectedFieldTools sel={sel} setSel={setSel} />
      </div>
    </div>
  )
}

const PARAM_PAGES = ['Mensaje', 'Contador', 'Caducidad', 'Caducidad 2', 'Turno de trabajo']

function ParamsTab() {
  const { state, dispatch } = useStore()
  const [page, setPage] = useState(0)
  if (!state.editing) return <NeedMessage />
  const m = state.editing.message
  const set = (path, value) => dispatch({ type: 'EDIT_SET', path, value })
  return (
    <div className="flex h-full gap-2 p-1.5">
      <div className="flex w-[25%] shrink-0 flex-col gap-1">
        {PARAM_PAGES.map((p, i) => (
          <Btn key={p} active={i === page} onClick={() => setPage(i)}>
            {p}
          </Btn>
        ))}
      </div>
      <div className="scroll-y min-w-0 flex-1 pr-1">
        {page === 0 && (
          <>
            <ChoiceField label="Sentido mensaje" value={m.params.sense} options={['DIRECTO', 'INVERSO', 'DIRECTO VOLTEADO', 'INVERSO VOLTEADO']} onChange={(v) => set('params.sense', v)} />
            <ChoiceField label="Modo de disparo" value={m.params.trigger} options={[{ value: 'OBJETO', label: 'OBJETO' }, { value: 'REPETITIVO', label: 'REPETITIVO' }, { value: 'MANUAL_OBJETO', label: 'MANUAL OBJETO' }, { value: 'MANUAL_AUTO', label: 'MANUAL AUTO' }]} onChange={(v) => set('params.trigger', v)} />
            <NumberField label="Velocidad impresión" hint="modo velocidad constante" value={m.params.printSpeed} min={10} max={5000} step={10} coarse={100} unit="mm/s" onChange={(v) => set('params.printSpeed', v)} />
            <NumberField label="Repetición de impresión" value={m.params.repeat} min={1} max={99} onChange={(v) => set('params.repeat', v)} />
            <NumberField label="Retardo ida" value={m.params.delayFwd} min={0} max={9999} unit="mm" onChange={(v) => set('params.delayFwd', v)} />
            <NumberField label="Retardo vuelta" value={m.params.delayRev} min={0} max={9999} unit="mm" onChange={(v) => set('params.delayRev', v)} />
            <NumberField label="Cancelación DTOP" value={m.params.dtopCancel} min={0} max={9999} unit="mm" onChange={(v) => set('params.dtopCancel', v)} />
            <NumberField label="Filtro DTOP" value={m.params.dtopFilter} min={0} max={9999} step={10} unit="µs" onChange={(v) => set('params.dtopFilter', v)} />
            <NumberField label="Anchura (Width)" value={m.params.width} min={30} max={300} step={1} coarse={10} unit="%" onChange={(v) => set('params.width', v)} />
          </>
        )}
        {page === 1 && (
          <>
            <NumberField label="Valor inicial" value={m.counter.start} min={0} max={999999} onChange={(v) => set('counter.start', v)} />
            <NumberField label="Valor final" value={m.counter.end} min={0} max={999999} step={1} coarse={1000} onChange={(v) => set('counter.end', v)} />
            <NumberField label="Paso contador" value={m.counter.step} min={0} max={99} onChange={(v) => set('counter.step', v)} />
            <NumberField label="Contador lotes" hint="objetos por incremento" value={m.counter.batch} min={1} max={9999} onChange={(v) => set('counter.batch', v)} />
            <ChoiceField label="Tipo incremento" value={m.counter.incType} options={['OBJETOS', 'MENSAJES']} onChange={(v) => set('counter.incType', v)} />
            <Toggle label="Cero a la izquierda" value={m.counter.leadingZeros} onChange={(v) => set('counter.leadingZeros', v)} />
            <Toggle label="Contador cíclico" value={m.counter.cyclic} onChange={(v) => set('counter.cyclic', v)} />
          </>
        )}
        {(page === 2 || page === 3) && (
          <ExpiryParams k={page === 2 ? 'expiry' : 'expiry2'} m={m} set={set} />
        )}
        {page === 4 && <ShiftParams m={m} set={set} />}
      </div>
    </div>
  )
}

function ExpiryParams({ k, m, set }) {
  const { state } = useStore()
  const e = m[k]
  return (
    <>
      <NumberField label="Duración" value={e.amount} min={0} max={9999} step={1} coarse={30} onChange={(v) => set(`${k}.amount`, v)} />
      <ChoiceField label="Unidad" value={e.unit} options={[{ value: 'DIAS', label: 'DÍAS' }, { value: 'MESES', label: 'MESES' }]} onChange={(v) => set(`${k}.unit`, v)} />
      <div className="mt-1 text-[11px]">
        Fecha RTC: <b>{rtcNow(state.rtcOffset).toLocaleDateString('es')}</b> → Caducidad: <b>{fieldText({ type: 'expiry', slot: k === 'expiry' ? 1 : 2, format: 'DD/MM/YYYY' }, { now: rtcNow(state.rtcOffset), message: m })}</b>
      </div>
    </>
  )
}

function ShiftParams({ m, set }) {
  const { state } = useStore()
  const modal = useModal()
  const sh = m.shift
  const time = (label, key) => (
    <div className="lcd-row flex items-center gap-1 py-[3px] text-[12px]">
      <span className="flex-1">{label}</span>
      {[0, 1].map((part) => (
        <button
          key={part}
          type="button"
          className="lcd-font rounded border b-line px-2 py-0.5 text-[14px] font-bold"
          onClick={() =>
            modal.numpad({
              label: `${label} — ${part ? 'minutos' : 'horas'}`,
              value: Number(sh[key].split(':')[part]),
              min: 0,
              max: part ? 59 : 23,
              onOk: (v) => {
                const p = sh[key].split(':')
                p[part] = String(v).padStart(2, '0')
                set('shift', { ...sh, [key]: p.join(':') })
              },
            })
          }
        >
          {sh[key].split(':')[part]}
        </button>
      ))}
    </div>
  )
  const nCodes = Math.max(1, Math.ceil(1440 / Math.max(1, Number(sh.interval.split(':')[0]) * 60 + Number(sh.interval.split(':')[1]))))
  return (
    <>
      {time('Hora inicio', 'start')}
      {time('Intervalo', 'interval')}
      <ChoiceField label="Tipo" value={sh.type} options={['CIFRAS', 'LETRAS', 'LETRAS (-I -O)']} onChange={(v) => set('shift', { ...sh, type: v })} />
      <Section title={`Códigos de turno (${Math.min(nCodes, 26)} turnos/día)`}>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: Math.min(nCodes, 8) }, (_, i) => (
            <button
              key={i}
              type="button"
              className="lcd-font rounded border b-line px-2 py-0.5 text-[12px] font-bold"
              onClick={() =>
                modal.keyboard({
                  label: `Código turno ${i + 1}`,
                  value: sh.codes[i] || '',
                  maxLen: 2,
                  upper: true,
                  onOk: (v) => {
                    const codes = [...sh.codes]
                    codes[i] = v
                    set('shift', { ...sh, codes })
                  },
                })
              }
            >
              {i + 1}: {sh.codes[i] || '—'}
            </button>
          ))}
        </div>
      </Section>
      <div className="mt-1 text-[11px]">
        Turno actual (RTC): <b>{fieldText({ type: 'shift' }, { now: rtcNow(state.rtcOffset), message: m })}</b>
      </div>
    </>
  )
}
