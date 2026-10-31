// Representación WYSIWYG de un mensaje como matriz de gotas.
import { useEffect, useRef, useState } from 'react'

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return size
}

// Pseudo-aleatorio determinista para que el "ruido" de impresión no parpadee.
const rnd = (i) => {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * props:
 *  - cols: boolean[][] (x, y desde abajo)  o  bits/w/h (cadena compacta)
 *  - wf, hf: factores de anchura/altura (deformación del marcaje)
 *  - quality: 0..1 (gotas mal cargadas => dispersión)
 *  - maxPitch: tamaño máximo de punto en px
 *  - color: color de las gotas
 *  - split: { atLine, offsetPx } desplazamiento del chorro 2 (bichorro)
 */
export default function DotMatrix({ cols, bits, w, h, wf = 1, hf = 1, quality = 1, maxPitch = 6, color, align = 'center', twin, className = '' }) {
  const box = useRef(null)
  const canvas = useRef(null)
  const size = useSize(box)
  const width = cols ? cols.length : w || 0
  const height = cols ? cols[0]?.length || 0 : h || 0

  useEffect(() => {
    const c = canvas.current
    if (!c || !size.w || !size.h) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(size.w * dpr)
    c.height = Math.round(size.h * dpr)
    const g = c.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, size.w, size.h)
    if (!width || !height) return
    const twinShift = twin ? Math.abs(twin.offsetDots) : 0
    const pitch = Math.min(maxPitch, (size.w - 4) / (width * wf + twinShift + 1), (size.h - 4) / (height * hf + 1))
    const px = pitch * wf
    const py = pitch * hf
    const r = Math.max(0.6, pitch * 0.42)
    const totalW = width * px + twinShift * pitch
    const x0 = align === 'left' ? 2 : (size.w - totalW) / 2
    const y0 = (size.h + height * py) / 2
    const fill = color || getComputedStyle(c).getPropertyValue('--dot') || '#000'
    g.fillStyle = fill.trim() || '#000'
    let i = 0
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const on = cols ? cols[x][y] : bits.charCodeAt(x * height + y) === 49
        i++
        if (!on) continue
        let dx = 0
        let dy = 0
        if (quality < 1) {
          const q = 1 - quality
          if (rnd(i) < q * 0.35) continue
          dx = (rnd(i + 7) - 0.5) * pitch * q * 2.2
          dy = (rnd(i + 13) - 0.5) * pitch * q * 3
        }
        let sx = 0
        if (twin && y < twin.splitY) sx = twin.offsetDots * pitch
        const cx = x0 + (twin && twin.offsetDots < 0 ? twinShift * pitch : 0) + x * px + px / 2 + dx + sx
        const cy = y0 - y * py - py / 2 + dy
        g.beginPath()
        g.ellipse(cx, cy, Math.max(0.6, r * Math.min(wf, 1.6)), Math.max(0.6, r * Math.min(hf, 1.4)), 0, 0, Math.PI * 2)
        g.fill()
      }
    }
  }, [cols, bits, width, height, size.w, size.h, wf, hf, quality, maxPitch, color, align, twin])

  return (
    <div ref={box} className={`relative h-full w-full ${className}`}>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
