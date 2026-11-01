// Visualizador LCD de caracteres (matriz de puntos 5×7 + fila de cursor), dibujado en canvas.
// Sirve para el S8 Classic (1 × 40) y como base de cualquier LCD de caracteres.
import { useEffect, useRef } from 'react'
import { glyphColumns } from '../engine/font5x7.js'

// Glifos especiales del visualizador (columnas, bit 0 = fila superior)
export const SPECIAL = {
  '◆': { inv: true, g: [0x08, 0x1c, 0x3e, 0x1c, 0x08] }, // rombo blanco en cuadro negro
  '⊞': { inv: true, g: [0x08, 0x08, 0x3e, 0x08, 0x08] }, // "+" blanco en cuadro negro
  '□': { g: [0x7f, 0x41, 0x41, 0x41, 0x7f] },
  '→': { g: [0x08, 0x08, 0x2a, 0x1c, 0x08] },
  '←': { g: [0x08, 0x1c, 0x2a, 0x08, 0x08] },
  '↑': { g: [0x04, 0x02, 0x7f, 0x02, 0x04] },
  '↓': { g: [0x10, 0x20, 0x7f, 0x20, 0x10] },
  '⇕': { g: [0x14, 0x36, 0x7f, 0x36, 0x14] },
  'µ': { g: [0x7e, 0x20, 0x20, 0x10, 0x3e] },
  '€': { g: [0x14, 0x3e, 0x55, 0x41, 0x22] },
  '¥': { g: [0x15, 0x16, 0x7c, 0x16, 0x15] },
  'Ø': { g: [0x5e, 0x31, 0x49, 0x46, 0x3d] },
  '£': { g: [0x48, 0x7e, 0x49, 0x41, 0x42] },
  '¢': { g: [0x18, 0x24, 0x66, 0x24, 0x00] },
  'Å': { g: [0x78, 0x15, 0x17, 0x15, 0x78] },
  'Ä': { g: [0x7d, 0x12, 0x12, 0x12, 0x7d] },
  'Æ': { g: [0x7e, 0x09, 0x7f, 0x49, 0x41] },
  'Ö': { g: [0x3d, 0x42, 0x42, 0x42, 0x3d] },
  'Ü': { g: [0x3d, 0x40, 0x40, 0x40, 0x3d] },
  'ø': { g: [0x58, 0x24, 0x54, 0x48, 0x34] },
  '☒': { g: [0x7f, 0x63, 0x55, 0x63, 0x7f] },
  '☐': { g: [0x7f, 0x41, 0x41, 0x41, 0x7f] },
  '▲': { g: [0x10, 0x18, 0x1c, 0x18, 0x10] },
  '▼': { g: [0x04, 0x0c, 0x1c, 0x0c, 0x04] },
  '·': { g: [0x00, 0x00, 0x08, 0x00, 0x00] },
  '¿': { g: [0x30, 0x48, 0x45, 0x40, 0x20] },
  '¡': { g: [0x00, 0x00, 0x7d, 0x00, 0x00] },
  'º': { g: [0x00, 0x06, 0x09, 0x06, 0x00] },
}

export default function LcdDots({ lines, cols = 40, cursor = null, blink = null, bg = '#b7c95a', on = '#16200b', off = 'rgba(40,60,10,0.10)', className = '', style }) {
  const ref = useRef(null)
  const P = 4 // paso de punto (px de canvas)
  const D = 3 // tamaño del punto
  const CW = 6 // columnas de puntos por carácter (5 + separación)
  const CH = 9 // filas por carácter (7 + 1 separación + 1 cursor)
  const rows = lines.length
  const W = cols * CW * P + P * 2
  const H = rows * CH * P + P * 2

  useEffect(() => {
    let raf
    let last = -1
    const draw = () => {
      const phase = Math.floor(Date.now() / 450) % 2
      if (phase !== last || !raf) {
        last = phase
        const ctx = ref.current?.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, W, H)
        for (let r = 0; r < rows; r++) {
          const text = [...String(lines[r] ?? '')].slice(0, cols)
          for (let c = 0; c < cols; c++) {
            const ch = text[c] ?? ' '
            const sp = SPECIAL[ch]
            const g = sp ? sp.g : glyphColumns(ch)
            const hidden = blink && r === (blink.row ?? 0) && c >= blink[0] && c < blink[1] && phase === 1
            const x0 = P + c * CW * P
            const y0 = P + r * CH * P
            for (let gx = 0; gx < 5; gx++) {
              for (let gy = 0; gy < 7; gy++) {
                let lit = ((g[gx] >> gy) & 1) === 1
                if (sp?.inv) lit = !lit
                if (hidden) lit = false
                ctx.fillStyle = lit ? on : off
                ctx.fillRect(x0 + gx * P, y0 + gy * P, D, D)
              }
            }
            // fila del cursor (subrayado)
            const cur = cursor != null && cursor >= 0 && c === cursor && (cursor.row ?? 0) === 0 && r === 0
            for (let gx = 0; gx < 5; gx++) {
              ctx.fillStyle = cur && phase === 0 ? on : off
              ctx.fillRect(x0 + gx * P, y0 + 7 * P + 2, D, D)
            }
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [lines.join('\n'), cols, cursor, blink?.[0], blink?.[1], bg, on, off, W, H, rows])

  return <canvas ref={ref} width={W} height={H} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} />
}
