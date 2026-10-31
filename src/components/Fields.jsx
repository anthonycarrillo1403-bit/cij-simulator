// Controles de parámetros del visualizador (compatibles con toque y teclas físicas).
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import { useKeyHandler } from '../state/store.jsx'
import { useModal } from './Modals.jsx'

const FocusCtx = createContext(null)
export function FocusProvider({ children }) {
  const [focused, setFocused] = useState(null)
  return <FocusCtx.Provider value={{ focused, setFocused }}>{children}</FocusCtx.Provider>
}
const useFocus = () => useContext(FocusCtx)

// Repetición automática al mantener pulsado
function useRepeat(fn) {
  const t = useRef(null)
  const stop = () => {
    clearTimeout(t.current)
    clearInterval(t.current)
    t.current = null
  }
  useEffect(() => stop, [])
  return {
    onPointerDown: (e) => {
      e.preventDefault()
      fn()
      stop()
      t.current = setTimeout(() => {
        t.current = setInterval(fn, 70)
      }, 380)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e) => e.preventDefault(),
  }
}

export function NumberField({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, coarse, decimals = 0, unit = '', compact, hint, status }) {
  const id = useId()
  const { focused, setFocused } = useFocus()
  const modal = useModal()
  const isFocused = focused === id
  const valRef = useRef(value)
  valRef.current = value
  const clamp = (v) => Number(Math.min(max, Math.max(min, v)).toFixed(decimals))
  const bump = (d) => {
    const nv = clamp(valRef.current + d)
    valRef.current = nv
    onChange(nv)
  }
  const big = coarse ?? step * 10
  useKeyHandler(
    (k) => {
      if (k === 'UP') bump(step)
      else if (k === 'DOWN') bump(-step)
      else if (k === 'RIGHT') bump(big)
      else if (k === 'LEFT') bump(-big)
      else if (k === 'ENTER' || k === 'ESC') setFocused(null)
      else return false
      return true
    },
    isFocused,
  )
  const dec = useRepeat(() => {
    setFocused(id)
    bump(-step)
  })
  const inc = useRepeat(() => {
    setFocused(id)
    bump(step)
  })
  const openPad = () => {
    setFocused(id)
    modal.numpad({ label, value, min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined, decimals, unit, onOk: onChange })
  }
  return (
    <div className={`flex items-center gap-1 ${compact ? '' : 'lcd-row py-[3px]'}`}>
      <span className="min-w-0 flex-1 truncate text-[12px] leading-tight">
        {label}
        {hint && <span className="block text-[10px] c-dim">{hint}</span>}
      </span>
      <button type="button" className="lcd-btn w-8 !px-0 text-base font-bold" {...dec}>
        −
      </button>
      <button
        type="button"
        onClick={openPad}
        className={`lcd-font min-w-[74px] rounded border px-1 py-0.5 text-right text-[14px] font-bold ${isFocused ? 'bg-sel' : 'b-line'} ${status || ''}`}
      >
        {Number(value).toFixed(decimals)}
        <span className="ml-0.5 text-[10px] font-normal">{unit}</span>
      </button>
      <button type="button" className="lcd-btn w-8 !px-0 text-base font-bold" {...inc}>
        +
      </button>
    </div>
  )
}

export function TextField({ label, value, onChange, maxLen = 30, upper = true, placeholder = '—' }) {
  const modal = useModal()
  return (
    <div className="lcd-row flex items-center gap-1 py-[3px]">
      <span className="flex-1 truncate text-[12px]">{label}</span>
      <button
        type="button"
        className="lcd-font min-w-[110px] max-w-[60%] truncate rounded border b-line px-1.5 py-0.5 text-left text-[13px] font-bold"
        onClick={() => modal.keyboard({ label, value, maxLen, upper, onOk: onChange })}
      >
        {value || <span className="c-dim">{placeholder}</span>}
      </button>
    </div>
  )
}

export function ChoiceField({ label, value, options, onChange, hint }) {
  const modal = useModal()
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }))
  const cur = opts.find((o) => o.value === value)
  return (
    <div className="lcd-row flex items-center gap-1 py-[3px]">
      <span className="min-w-0 flex-1 truncate text-[12px] leading-tight">
        {label}
        {hint && <span className="block text-[10px] c-dim">{hint}</span>}
      </span>
      <button
        type="button"
        className="lcd-font flex min-w-[110px] max-w-[62%] items-center justify-between gap-1 rounded border b-line px-1.5 py-0.5 text-[12px] font-bold"
        onClick={() => modal.choice({ label, value, options: opts, onOk: onChange })}
      >
        <span className="truncate">{cur ? cur.label : String(value)}</span>
        <span className="c-dim">▾</span>
      </button>
    </div>
  )
}

export function Toggle({ label, value, onChange, on = 'SÍ', off = 'NO', hint }) {
  return (
    <div className="lcd-row flex items-center gap-1 py-[3px]">
      <span className="min-w-0 flex-1 truncate text-[12px] leading-tight">
        {label}
        {hint && <span className="block text-[10px] c-dim">{hint}</span>}
      </span>
      <button type="button" onClick={() => onChange(!value)} className={`lcd-btn lcd-font min-w-[70px] text-[12px] font-bold ${value ? 'on' : ''}`}>
        {value ? `■ ${on}` : `□ ${off}`}
      </button>
    </div>
  )
}

export function Readout({ label, value, unit, status }) {
  return (
    <div className="lcd-row flex items-baseline justify-between gap-2 py-[2px] text-[12px]">
      <span className="truncate">{label}</span>
      <span className={`lcd-font whitespace-nowrap font-bold ${status || ''}`}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal">{unit}</span>}
      </span>
    </div>
  )
}

export function Btn({ children, onClick, active, disabled, className = '' }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`lcd-btn text-[12px] font-semibold ${active ? 'on' : ''} ${className}`}>
      {children}
    </button>
  )
}

export function Section({ title, children, className = '' }) {
  return (
    <div className={className}>
      {title && <div className="lcd-font mb-0.5 mt-1 border-b-2 b-line text-[11px] font-bold uppercase tracking-wide c-dim">{title}</div>}
      {children}
    </div>
  )
}
