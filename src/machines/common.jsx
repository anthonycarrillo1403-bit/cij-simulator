// Piezas comunes de los paneles: tecla presionable y LED.
import { useStore } from '../state/store.jsx'

export function usePress() {
  const { dispatch } = useStore()
  return (key) => {
    try {
      navigator.vibrate?.(12)
    } catch {
      /* sin vibración */
    }
    dispatch({ type: 'KEY', key })
  }
}

// Tecla en posición absoluta (coordenadas de diseño del panel)
export function PanelKey({ k, press, className = '', style, children, title }) {
  return (
    <button
      type="button"
      data-key={k.id}
      title={title}
      aria-label={title || k.id}
      onClick={() => press(k.id)}
      className={`pkey absolute select-none ${className}`}
      style={{ left: k.x, top: k.y, width: k.w, height: k.h, ...style }}
    >
      {children}
    </button>
  )
}

export function Led({ x, y, w = 18, h = 8, on, color, blink, round }) {
  const c = { green: '#7dff4a', yellow: '#ffe14a', red: '#ff3a3a', amber: '#ffb020' }[color] || color
  return (
    <div
      className={`absolute ${on && blink ? 'blink' : ''}`}
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: round ? '50%' : 3,
        background: on ? c : 'rgba(40,40,40,.85)',
        boxShadow: on ? `0 0 10px 3px ${c}99, inset 0 1px 1px #fff8` : 'inset 0 1px 2px #000a',
      }}
    />
  )
}
