// Teclado simulado de la interfaz operador: teclado numérico, alfanumérico y
// cuadros de diálogo de elección / confirmación. Se dibujan dentro del visualizador.
import { createContext, useCallback, useContext, useState } from 'react'
import { useKeyHandler } from '../state/store.jsx'

const ModalCtx = createContext(null)
export const useModal = () => useContext(ModalCtx)

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null)
  const close = useCallback(() => setModal(null), [])
  const api = {
    numpad: (opts) => setModal({ kind: 'numpad', ...opts }),
    keyboard: (opts) => setModal({ kind: 'keyboard', ...opts }),
    choice: (opts) => setModal({ kind: 'choice', ...opts }),
    confirm: (opts) => setModal({ kind: 'confirm', ...opts }),
    close,
  }
  return (
    <ModalCtx.Provider value={api}>
      {children}
      {modal && <ModalHost modal={modal} close={close} />}
    </ModalCtx.Provider>
  )
}

function ModalHost({ modal, close }) {
  useKeyHandler((k) => {
    if (k === 'ESC') {
      close()
      return true
    }
    return false
  }, true, true)
  const Body = { numpad: NumPad, keyboard: Keyboard, choice: Choice, confirm: Confirm }[modal.kind]
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="scr-modal pop max-h-full w-[min(560px,96%)] overflow-hidden rounded border-2 b-line bg-lcd shadow-2xl">
        <div className="bg-sel px-2 py-0.5 text-[12px] font-bold lcd-font">{modal.label}</div>
        <Body modal={modal} close={close} />
      </div>
    </div>
  )
}

function Key({ children, onClick, className = '', wide }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lcd-btn lcd-font text-[15px] font-bold ${wide ? 'col-span-2' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

function NumPad({ modal, close }) {
  const [txt, setTxt] = useState(String(modal.value ?? ''))
  const [fresh, setFresh] = useState(true)
  const dec = modal.decimals ?? 0
  const push = (c) => {
    setTxt((t) => {
      const base = fresh ? '' : t
      if (c === '.' && (dec === 0 || base.includes('.'))) return base
      if (c === '-' ) return base.startsWith('-') ? base.slice(1) : '-' + base
      return (base + c).slice(0, 10)
    })
    setFresh(false)
  }
  const ok = () => {
    let v = parseFloat(txt.replace(',', '.'))
    if (Number.isNaN(v)) return
    if (modal.min != null) v = Math.max(modal.min, v)
    if (modal.max != null) v = Math.min(modal.max, v)
    v = Number(v.toFixed(dec))
    modal.onOk(v)
    close()
  }
  useKeyHandler((k) => {
    if (k === 'ENTER') {
      ok()
      return true
    }
    return false
  }, true, true)
  return (
    <div className="flex gap-2 p-2">
      <div className="flex w-[42%] flex-col gap-1">
        <div className="lcd-font rounded border b-line px-2 py-1 text-right text-2xl font-bold">
          {txt || '0'}
          <span className="ml-1 text-sm c-dim">{modal.unit}</span>
        </div>
        <div className="text-[11px] c-dim">
          Rango: {modal.min ?? '−∞'} … {modal.max ?? '∞'} {modal.unit}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-1">
          <Key onClick={close}>ESC</Key>
          <Key onClick={ok} className="on">ENTER</Key>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-4 gap-1">
        {['7', '8', '9', '⌫', '4', '5', '6', 'C', '1', '2', '3', '-', '0', '.'].map((c) => (
          <Key
            key={c}
            wide={c === '0'}
            onClick={() => {
              if (c === '⌫') {
                setFresh(false)
                setTxt((t) => t.slice(0, -1))
              } else if (c === 'C') {
                setFresh(false)
                setTxt('')
              } else push(c)
            }}
          >
            {c}
          </Key>
        ))}
        <Key onClick={ok} className="col-span-1">↵</Key>
      </div>
    </div>
  )
}

const ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM-/.']
const SYMS = ['!"#$%&()=?', '@*+:;<>_[]', '\'´`^~{}|\\°', ',¿¡€£¥§¬ºª']

function Keyboard({ modal, close }) {
  const [txt, setTxt] = useState(String(modal.value ?? ''))
  const [shift, setShift] = useState(false)
  const [sym, setSym] = useState(false)
  const max = modal.maxLen ?? 40
  const add = (c) => setTxt((t) => (t + c).slice(0, max))
  const ok = () => {
    const v = modal.upper ? txt.toUpperCase() : txt
    if (modal.validate && !modal.validate(v)) return
    modal.onOk(v)
    close()
  }
  useKeyHandler((k) => {
    if (k === 'ENTER') {
      ok()
      return true
    }
    return false
  }, true, true)
  const rows = sym ? SYMS : ROWS
  return (
    <div className="p-1.5">
      <div className="lcd-font mb-1 flex items-center rounded border b-line px-2 py-0.5 text-lg font-bold">
        <span className="truncate">{txt}</span>
        <span className="blink">_</span>
        <span className="ml-auto text-[11px] font-normal c-dim">
          {txt.length}/{max}
        </span>
      </div>
      <div className="flex flex-col gap-[3px]">
        {rows.map((r) => (
          <div key={r} className="grid grid-cols-10 gap-[3px]">
            {[...r].map((c) => {
              const ch = shift || sym || modal.upper ? c : c.toLowerCase()
              return (
                <Key key={c} onClick={() => add(ch)} className="!min-h-[30px] !px-0 !text-[14px]">
                  {ch}
                </Key>
              )
            })}
          </div>
        ))}
        <div className="grid grid-cols-10 gap-[3px]">
          <Key onClick={() => setShift((v) => !v)} className={`!min-h-[30px] !text-[11px] ${shift ? 'on' : ''}`}>⇧</Key>
          <Key onClick={() => setSym((v) => !v)} className={`!min-h-[30px] !text-[11px] ${sym ? 'on' : ''}`}>#+=</Key>
          <Key onClick={() => add(' ')} className="col-span-3 !min-h-[30px] !text-[11px]">ESPACIO</Key>
          <Key onClick={() => setTxt((t) => t.slice(0, -1))} className="!min-h-[30px]">⌫</Key>
          <Key onClick={() => setTxt('')} className="!min-h-[30px] !text-[11px]">CLR</Key>
          <Key onClick={close} className="!min-h-[30px] !text-[11px]">ESC</Key>
          <Key onClick={ok} className="on col-span-2 !min-h-[30px] !text-[12px]">ENTER ↵</Key>
        </div>
      </div>
    </div>
  )
}

function Choice({ modal, close }) {
  const [idx, setIdx] = useState(Math.max(0, modal.options.findIndex((o) => o.value === modal.value)))
  const pick = (o) => {
    modal.onOk(o.value)
    close()
  }
  useKeyHandler((k) => {
    if (k === 'UP') setIdx((i) => Math.max(0, i - 1))
    else if (k === 'DOWN') setIdx((i) => Math.min(modal.options.length - 1, i + 1))
    else if (k === 'ENTER') pick(modal.options[idx])
    else return false
    return true
  }, true, true)
  return (
    <div className="scroll-y max-h-[62vh] p-1.5">
      <div className={`grid gap-1 ${modal.options.length > 6 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {modal.options.map((o, i) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => pick(o)}
            className={`lcd-btn lcd-font !justify-start text-left text-[13px] ${i === idx ? 'on' : ''}`}
          >
            <span className="w-4">{o.value === modal.value ? '●' : '○'}</span>
            <span className="truncate">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Confirm({ modal, close }) {
  const yes = () => {
    modal.onOk()
    close()
  }
  useKeyHandler((k) => {
    if (k === 'ENTER') {
      yes()
      return true
    }
    return false
  }, true, true)
  return (
    <div className="p-3 text-[13px]">
      <p className="mb-3">{modal.text}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="lcd-btn px-4" onClick={close}>NO</button>
        <button type="button" className="lcd-btn on px-4" onClick={yes}>SÍ</button>
      </div>
    </div>
  )
}
