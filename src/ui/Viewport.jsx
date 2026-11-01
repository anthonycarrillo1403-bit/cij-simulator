// Visor con zoom y desplazamiento para el panel de la máquina.
// - El contenido se dibuja a tamaño de diseño fijo (width × height) y se escala.
// - Pellizco con dos dedos o rueda del ratón = zoom; arrastrar con un dedo = mover.
// - Doble toque = acercar ×2 en ese punto (o volver a la vista completa).
// - zoomTo(rect) centra y amplía una zona (pantalla, teclado, una tecla…).
// Un arrastre de más de unos píxeles cancela la pulsación de la tecla que estaba debajo,
// así se puede mover la vista sin pulsar teclas por accidente.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const DRAG_PX = 8

export const Viewport = forwardRef(function Viewport({ width, height, children, overlay, onViewChange, maxZoom = 5 }, ref) {
  const boxRef = useRef(null)
  const [box, setBox] = useState({ w: 1, h: 1 })
  const [view, setView] = useState({ s: 1, x: 0, y: 0, anim: false })
  const viewRef = useRef(view)
  viewRef.current = view
  const fitRef = useRef(1)

  useLayoutEffect(() => {
    const el = boxRef.current
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const fit = Math.min(box.w / width, box.h / height)
  fitRef.current = fit

  // Mantener el contenido dentro de la ventana
  const constrain = useCallback(
    (v) => {
      const s = clamp(v.s, fitRef.current, fitRef.current * maxZoom)
      const cw = width * s
      const ch = height * s
      const x = cw <= box.w ? (box.w - cw) / 2 : clamp(v.x, box.w - cw, 0)
      const y = ch <= box.h ? (box.h - ch) / 2 : clamp(v.y, box.h - ch, 0)
      return { ...v, s, x, y }
    },
    [box.w, box.h, width, height, maxZoom],
  )

  const reset = useCallback(() => setView(constrain({ s: fitRef.current, x: 0, y: 0, anim: true })), [constrain])

  // Ajustar a la vista completa cuando cambia el tamaño de la ventana
  const measured = useRef(false)
  useEffect(() => {
    if (box.w <= 1) return
    if (!measured.current) {
      measured.current = true
      setView(constrain({ s: fit, x: 0, y: 0, anim: false }))
      return
    }
    setView((v) => constrain({ ...v, s: v.s < fit * 1.02 ? fit : v.s }))
  }, [fit, constrain, box.w])

  const zoomTo = useCallback(
    (r, { pad = 0.08, max } = {}) => {
      const pw = r.w * (1 + pad * 2)
      const ph = r.h * (1 + pad * 2)
      let s = Math.min(box.w / pw, box.h / ph)
      s = clamp(s, fitRef.current, max ? Math.min(max, fitRef.current * maxZoom) : fitRef.current * maxZoom)
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      setView(constrain({ s, x: box.w / 2 - cx * s, y: box.h / 2 - cy * s, anim: true }))
    },
    [box.w, box.h, constrain, maxZoom],
  )

  // ¿La zona r (coordenadas de diseño) está visible y a un tamaño razonable?
  const isVisible = useCallback(
    (r, minPx = 26) => {
      const v = viewRef.current
      const x0 = r.x * v.s + v.x
      const y0 = r.y * v.s + v.y
      const x1 = x0 + r.w * v.s
      const y1 = y0 + r.h * v.s
      const inside = x0 >= -2 && y0 >= -2 && x1 <= box.w + 2 && y1 <= box.h + 2
      return inside && Math.min(r.w, r.h) * v.s >= minPx
    },
    [box.w, box.h],
  )

  useImperativeHandle(ref, () => ({ zoomTo, reset, isVisible, get view() { return viewRef.current }, get fit() { return fitRef.current }, get box() { return box } }), [zoomTo, reset, isVisible, box])

  useEffect(() => {
    onViewChange?.({ ...view, fit, zoomed: view.s > fit * 1.05 })
  }, [view, fit, onViewChange])

  // ---------- gestos
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const moved = useRef(false)
  const lastTap = useRef({ t: 0, x: 0, y: 0 })

  const local = (e) => {
    const r = boxRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const startGesture = () => {
    const pts = [...pointers.current.values()]
    const v = viewRef.current
    if (pts.length >= 2) {
      const [a, b] = pts
      gesture.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: v }
    } else if (pts.length === 1) {
      gesture.current = { kind: 'pan', p0: pts[0], v0: v }
    } else gesture.current = null
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointers.current.set(e.pointerId, local(e))
    if (pointers.current.size === 1) moved.current = false
    startGesture()
  }

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, local(e))
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pan') {
      const p = pointers.current.get(e.pointerId)
      const dx = p.x - g.p0.x
      const dy = p.y - g.p0.y
      if (!moved.current && Math.hypot(dx, dy) < DRAG_PX) return
      if (!moved.current) {
        moved.current = true
        // capturar para seguir recibiendo eventos aunque el dedo salga de la tecla
        try {
          boxRef.current.setPointerCapture(e.pointerId)
        } catch {
          /* */
        }
      }
      setView(constrain({ ...g.v0, x: g.v0.x + dx, y: g.v0.y + dy, anim: false }))
    } else if (g.kind === 'pinch') {
      moved.current = true
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const s = clamp(g.v0.s * (d / Math.max(1, g.d0)), fitRef.current, fitRef.current * maxZoom)
      // el punto de diseño bajo el centro inicial queda bajo el centro actual
      const wx = (g.c0.x - g.v0.x) / g.v0.s
      const wy = (g.c0.y - g.v0.y) / g.v0.s
      setView(constrain({ s, x: c.x - wx * s, y: c.y - wy * s, anim: false }))
    }
  }

  const onPointerUp = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = pointers.current.get(e.pointerId)
    pointers.current.delete(e.pointerId)
    const wasMoved = moved.current
    startGesture()
    if (pointers.current.size === 0 && !wasMoved && e.pointerType !== 'mouse') {
      // doble toque en zona sin tecla
      const now = Date.now()
      const lt = lastTap.current
      const onKey = e.target.closest?.('[data-key]')
      if (!onKey && now - lt.t < 320 && Math.hypot(p.x - lt.x, p.y - lt.y) < 30) {
        const v = viewRef.current
        if (v.s > fitRef.current * 1.4) reset()
        else {
          const s = Math.min(fitRef.current * 2.2, fitRef.current * maxZoom)
          const wx = (p.x - v.x) / v.s
          const wy = (p.y - v.y) / v.s
          setView(constrain({ s, x: p.x - wx * s, y: p.y - wy * s, anim: true }))
        }
        lastTap.current = { t: 0, x: 0, y: 0 }
      } else lastTap.current = { t: now, x: p.x, y: p.y }
    }
  }

  // Cancelar el clic de una tecla si hubo arrastre
  const onClickCapture = (e) => {
    if (moved.current) {
      e.stopPropagation()
      e.preventDefault()
      moved.current = false
    }
  }

  const onWheel = (e) => {
    const p = local(e)
    const v = viewRef.current
    const s = clamp(v.s * Math.exp(-e.deltaY * 0.0015), fitRef.current, fitRef.current * maxZoom)
    const wx = (p.x - v.x) / v.s
    const wy = (p.y - v.y) / v.s
    setView(constrain({ s, x: p.x - wx * s, y: p.y - wy * s, anim: false }))
  }

  return (
    <div
      ref={boxRef}
      className="relative h-full w-full touch-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onWheel={onWheel}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width,
          height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
          transition: view.anim ? 'transform 420ms cubic-bezier(.2,.8,.2,1)' : 'none',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
      {overlay}
    </div>
  )
})
