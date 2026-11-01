// Pantalla LCD del 9040: 640 × 200 px monocromo, dibujada píxel a píxel en un canvas.
// Regiones (manual A36952): fila de estado 0–9, barra de menús 11–24, zona de edición 26–163,
// barra de iconos 165–199 con separadores en x = 35 + 71·n.
import { useEffect, useRef } from 'react'
import { useStore } from '../../state/store.jsx'
import { glyphColumns } from '../../engine/font5x7.js'
import { SPECIAL } from '../LcdDots.jsx'
import { rtcNow, pad } from '../../engine/rtc.js'
import { rasterMessage } from '../../engine/render.js'
import { MENUS, FORMS, view, cellLabel, jetStateLabel, DEFECT_TEXT, FONTS_9040 } from './firmware.js'

const W = 640
const H = 200
const INK = '#141a22'
const BG = '#e6ecef'

const ACC = { Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }

function makeG(ctx) {
  const px = (x, y, w = 1, h = 1, c = INK) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }
  const glyph = (ch) => {
    const sp = SPECIAL[ch]
    if (sp) return sp
    const base = ACC[ch]
    return { g: glyphColumns(base || ch), accent: Boolean(base) }
  }
  // texto con la fuente 5×7; sx = escala horizontal, sy = escala vertical
  const text = (x, y, str, { inv = false, sx = 1, sy = 1, bold = false, under = -1 } = {}) => {
    let cx = x
    const chars = [...String(str)]
    if (inv) px(x - 1, y - 1, chars.length * 6 * sx + 1, 7 * sy + 2)
    const col = inv ? BG : INK
    chars.forEach((ch, i) => {
      const gl = glyph(ch)
      for (let gx = 0; gx < 5; gx++)
        for (let gy = 0; gy < 7; gy++) {
          let on = ((gl.g[gx] >> gy) & 1) === 1
          if (gl.inv) on = !on
          if (on) {
            px(cx + gx * sx, y + gy * sy, sx, sy, col)
            if (bold) px(cx + gx * sx + 1, y + gy * sy, sx, sy, col)
          }
        }
      if (gl.accent) px(cx + 2 * sx, y - 1, sx + 1, 1, col)
      if (i === under) px(cx, y + 7 * sy + 1, 5 * sx, 1, col)
      cx += 6 * sx
    })
    return cx
  }
  const tw = (str, sx = 1) => [...String(str)].length * 6 * sx
  const rect = (x, y, w, h, dotted = false) => {
    if (!dotted) {
      px(x, y, w, 1)
      px(x, y + h - 1, w, 1)
      px(x, y, 1, h)
      px(x + w - 1, y, 1, h)
    } else {
      for (let i = 0; i < w; i += 2) {
        px(x + i, y)
        px(x + i, y + h - 1)
      }
      for (let i = 0; i < h; i += 2) {
        px(x, y + i)
        px(x + w - 1, y + i)
      }
    }
  }
  const box = (x, y, w, h) => {
    px(x, y, w, h, BG)
    rect(x, y, w, h)
  }
  return { px, text, tw, rect, box }
}

// ------------------------------------------------------------------ iconos (32 × 28)
function icon(g, id, x, y) {
  const { px, rect, text } = g
  const page = (ox, oy, w = 14, h = 18) => {
    px(ox, oy, w, h, BG)
    rect(ox, oy, w, h)
  }
  switch (id) {
    case 'select':
      page(x + 2, y + 2, 10, 13)
      page(x + 9, y + 6, 10, 13)
      page(x + 16, y + 10, 10, 13)
      px(x + 12, y + 24, 10, 2)
      px(x + 12, y + 20, 2, 6)
      break
    case 'new':
      page(x + 8, y + 3, 16, 22)
      px(x + 18, y + 3, 6, 6, BG)
      px(x + 18, y + 3, 1, 6)
      px(x + 18, y + 8, 6, 1)
      break
    case 'modify':
      page(x + 6, y + 4, 16, 21)
      for (let i = 0; i < 4; i++) px(x + 9, y + 9 + i * 4, 10, 1)
      for (let i = 0; i < 12; i++) px(x + 14 + i, y + 18 - i, 3, 2)
      break
    case 'params':
    case 'wparam':
      for (let i = 0; i < 4; i++) px(x + 4, y + 4 + i * 4, 18, 2)
      px(x + 4, y + 22, 18, 1)
      px(x + 4, y + 21, 1, 3)
      px(x + 21, y + 21, 1, 3)
      px(x + 26, y + 3, 1, 19)
      px(x + 25, y + 3, 3, 1)
      px(x + 25, y + 21, 3, 1)
      if (id === 'wparam') rect(x + 1, y + 1, 30, 26)
      break
    case 'counter':
      for (let i = 0; i < 3; i++) {
        rect(x + 3 + i * 9, y + 6, 8, 14)
        text(x + 5 + i * 9, y + 10, i === 2 ? '1' : '0')
      }
      break
    case 'user':
      px(x + 5, y + 5, 6, 6)
      px(x + 3, y + 12, 10, 12)
      px(x + 14, y + 13, 5, 2)
      page(x + 20, y + 6, 11, 16)
      text(x + 21, y + 11, 'AB', { sx: 1 })
      break
    case 'pause':
      px(x + 8, y + 5, 4, 18)
      px(x + 15, y + 5, 4, 18)
      for (let i = 0; i < 8; i++) px(x + 22 + i / 2, y + 22 - i, 1, 1)
      break
    case 'play':
      for (let i = 0; i < 9; i++) px(x + 9 + i, y + 5 + i, 1, 18 - i * 2)
      for (let i = 0; i < 8; i++) px(x + 22 + i / 2, y + 22 - i, 1, 1)
      break
    case 'others':
      rect(x + 4, y + 6, 14, 20)
      px(x + 15, y + 15, 2, 2)
      px(x + 22, y + 4, 6, 6)
      px(x + 24, y + 2, 2, 10)
      px(x + 20, y + 6, 10, 2)
      break
    case 'open':
      rect(x + 3, y + 9, 24, 15)
      px(x + 3, y + 6, 9, 3)
      for (let i = 0; i < 8; i++) px(x + 18 + i, y + 3 + i / 2, 1, 1)
      break
    case 'font':
      text(x + 4, y + 6, 'A', { sx: 2, sy: 2, bold: true })
      text(x + 17, y + 10, 'A', { sx: 1, sy: 2 })
      break
    case 'varpen':
    case 'vargear':
      text(x + 2, y + 3, '00')
      rect(x + 16, y + 2, 11, 11)
      px(x + 21, y + 4, 1, 4)
      px(x + 21, y + 7, 3, 1)
      if (id === 'varpen') for (let i = 0; i < 10; i++) px(x + 8 + i, y + 25 - i, 3, 2)
      else {
        rect(x + 10, y + 15, 10, 10)
        px(x + 14, y + 13, 2, 14)
        px(x + 8, y + 19, 14, 2)
      }
      break
    case 'load':
      page(x + 10, y + 2, 12, 12)
      rect(x + 3, y + 18, 9, 7)
      rect(x + 18, y + 18, 9, 7)
      px(x + 1, y + 26, 30, 1)
      px(x + 5, y + 8, 5, 1)
      px(x + 5, y + 8, 1, 8)
      break
    case 'house':
      for (let i = 0; i < 12; i++) px(x + 16 - i, y + 3 + i, i * 2, 1)
      rect(x + 7, y + 14, 18, 12)
      px(x + 14, y + 19, 4, 7)
      break
    case 'gears':
      rect(x + 4, y + 6, 12, 12)
      px(x + 9, y + 3, 2, 18)
      px(x + 1, y + 11, 18, 2)
      rect(x + 18, y + 14, 9, 9)
      px(x + 21, y + 12, 2, 13)
      break
    case 'logo':
      rect(x + 3, y + 4, 26, 20)
      for (let i = 0; i < 8; i++) px(x + 6 + i, y + 20 - i, 1, i)
      px(x + 21, y + 8, 4, 4)
      break
    case 'wmsg':
    case 'wfont':
    case 'wvar':
      rect(x + 1, y + 1, 30, 26)
      px(x + 1, y + 1, 30, 4)
      if (id === 'wmsg') for (let i = 0; i < 4; i++) px(x + 5, y + 9 + i * 4, 20, 1)
      if (id === 'wfont') text(x + 6, y + 10, 'A', { sx: 2, sy: 2 })
      if (id === 'wvar') text(x + 6, y + 12, '00')
      break
    default:
  }
}

// ------------------------------------------------------------------ dibujo
function draw(ctx, s, blinkOn) {
  const g = makeG(ctx)
  const { px, text, tw, rect, box } = g
  const v = view(s)
  const fw = v.fw
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  if (s.power === 'OFF' || s.power === 'BOOT') {
    if (s.power === 'BOOT') {
      text(250, 80, 'Markem-Imaje 9040', { sx: 2, sy: 2 })
      text(268, 110, 'Inicializacion...')
    }
    return
  }
  const menu = MENUS[fw.mode]
  // fila de estado
  text(15, 1, s.power === 'ON' ? 'ON' : s.power === 'STOPPING' ? 'OFF' : 'ON', { inv: true })
  if (fw.status) text(320 - tw('ESTADO / CABEZAL(ES)') / 2, 1, 'ESTADO / CABEZAL(ES)')
  else text(320 - tw(menu.title) / 2, 1, menu.title)
  if (fw.mode === 'EDIT') {
    const nm = s.editing?.message.name || ''
    text(632 - tw(nm), 1, nm)
  } else {
    const d = rtcNow(s.rtcOffset)
    const t = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear() % 100)}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    text(632 - tw(t), 1, t)
  }
  px(0, 10, W, 1)
  // barra de menús
  const barX = []
  let x = 8
  menu.bar.forEach((b, i) => {
    barX.push(x)
    const sel = (fw.focus === 'bar' || fw.focus === 'pull') && fw.bar === i && !fw.status
    text(x + 3, 14, b.label, { inv: sel, bold: true, under: sel ? -1 : 0 })
    x += tw(b.label) + 24
  })
  px(0, 25, W, 1)

  // zona de edición
  if (fw.status) drawStatus(g, s, fw)
  else if (fw.mode === 'PROD') drawProd(g, s)
  else if (fw.mode === 'EDIT') drawEdit(g, s, fw, blinkOn)
  else if (fw.mode === 'PREP') text(320 - tw('PREPARACION DE IMPRESORA') / 2, 90, 'PREPARACION DE IMPRESORA', { sx: 1, sy: 2 })
  else text(320 - tw('EDICION DE LOGOS') / 2, 90, 'EDICION DE LOGOS', { sx: 1, sy: 2 })

  // desplegable
  if (fw.focus === 'pull' && !fw.status) {
    const items = menu.bar[fw.bar].items
    const bw = Math.max(...items.map((it) => tw(it))) + 14
    const bx = Math.min(barX[fw.bar], W - bw - 2)
    const bh = items.length * 11 + 4
    box(bx, 25, bw, bh)
    items.forEach((it, i) => text(bx + 7, 28 + i * 11, it, { inv: i === fw.pull, under: i === fw.pull ? -1 : 0 }))
  }

  // barra de iconos
  px(0, 164, W, 1)
  for (let n = 0; n <= 8; n++) px(35 + 71 * n, 165, 2, 35)
  v.icons.forEach((id, i) => id && icon(g, id, 37 + 71 * i + 18, 168))
  // estado del teclado (abajo a la izquierda)
  if (fw.shift || fw.caps) {
    for (let i = 0; i < 5; i++) px(16 - i, 172 + i, i * 2 + 1, 1)
    rect(14, 177, 5, 6)
  }
  if (!fw.ins && fw.mode === 'EDIT') text(4, 188, 'SUP')
  if (fw.alt) text(4, 188, 'ALT', { inv: true })
  if (fw.ctrl) text(4, 188, 'CTL', { inv: true })

  if (fw.dlg) (fw.dlg.form ? drawForm : drawList)(g, s, fw, blinkOn)
  if (fw.defects) drawDefects(g, s, fw)
  if (fw.info) drawBoxLines(g, fw.info.lines, ['ENTER'], 0)
  if (fw.confirm) drawBoxLines(g, fw.confirm.lines, ['NO', 'SÍ'], fw.confirm.sel)
}

function drawProd(g, s) {
  const { px, text, tw, rect } = g
  const m = s.messages[s.activeMessage]
  if (m) {
    const r = rasterMessage(m, { now: rtcNow(s.rtcOffset), opvars: s.opvars, v24: s.hw.v24 })
    const dot = Math.max(1, Math.min(3, Math.floor(Math.min(600 / Math.max(1, r.width), 110 / Math.max(1, r.height)))))
    const ox = Math.round(320 - (r.width * dot) / 2)
    const oy = Math.round(32 + (112 - r.height * dot) / 2)
    r.cols.forEach((col, cx) => col.forEach((on, cy) => on && px(ox + cx * dot, oy + (r.height - 1 - cy) * dot, dot, dot)))
  }
  const label = 'Cabezal 1: '
  const name = s.activeMessage || ''
  const w = tw(label) + tw(name) + 12
  const x = 320 - w / 2
  px(x, 150, w, 13, '#e6ecef')
  rect(x, 150, w, 13)
  text(x + 5, 153, label)
  text(x + 5 + tw(label), 153, name, { inv: true })
  if (s.paused) text(8, 153, 'PAUSA', { inv: true })
}

function drawEdit(g, s, fw, blinkOn) {
  const { px, text, tw, rect } = g
  const m = s.editing?.message
  if (!m) return
  // delimitadores de los dos chorros
  px(1, 28, 2, 58)
  px(1, 90, 2, 58)
  const n = Math.max(2, m.lines.length)
  const zoneH = 120 / n
  m.lines.forEach((line, li) => {
    const y = 30 + li * zoneH + (zoneH - 16) / 2
    let cx = 10
    const cells = []
    for (const f of line) {
      if (f.type === 'text') for (const c of [...f.value]) cells.push({ c })
      else cells.push({ f })
    }
    cells.forEach((c, i) => {
      const lab = cellLabel(c, s)
      if (li === fw.line && i === fw.pos && blinkOn && fw.focus === 'main' && !fw.dlg) drawCursor(g, cx, y, fw.ins)
      text(cx, y, lab, { sx: 2, sy: 2 })
      if (c.f) px(cx, y + 16, tw(lab, 2) - 2, 1)
      cx += tw(lab, 2)
    })
    if (li === fw.line && fw.pos >= cells.length && blinkOn && fw.focus === 'main' && !fw.dlg) drawCursor(g, cx, y, true)
  })
  if (m.lines.length === 0 && blinkOn) drawCursor(g, 10, 140, true)
  // línea de estado de edición
  const font = FONTS_9040.find((f) => f[1] === fw.font)?.[0] || 'SIN07118'
  const st = `Cho.: ${fw.line % 2 === 0 ? 1 : 2}/2 - 1 Cab.(s) - Fuente: ${font}`
  px(0, 151, W, 1)
  text(320 - tw(st) / 2, 154, st)
}

function drawCursor(g, x, y, ins) {
  if (ins) g.px(x - 1, y - 1, 2, 17)
  else g.px(x, y + 17, 10, 2)
}

function drawStatus(g, s, fw) {
  const { px, text, tw, rect, box } = g
  const L = s.live
  const st = fw.status
  px(0, 11, W, 153, BG)
  const hdr = '------------  Cabezal:   1  ------------'
  text(320 - tw(hdr) / 2, 14, hdr)
  const rowL = (i, label, value, focus) => {
    text(20, 28 + i * 13, label, { inv: focus })
    text(150, 28 + i * 13, value)
  }
  const running = s.jetState === 'RUNNING'
  const ph = running ? L.phase : '00000000'
  const ph2 = running ? (L.phaseOk ? L.phase : L.phase.split('').reverse().join('')) : '00000000'
  text(20, 28, 'Estado chorros:', { inv: st.cur === 0 })
  rect(148, 26, 130, 11)
  text(152, 28, jetStateLabel(s))
  rowL(1, 'Veloc. chorro1:', `${L.velocity.toFixed(2).replace('.', ',')} m/s`)
  rowL(2, 'Fase chorro1:', ph)
  rowL(3, 'Veloc. chorro2:', `${L.velocity.toFixed(2).replace('.', ',')} m/s`)
  rowL(4, 'Fase chorro2:', ph2)
  rowL(5, 'Presion:', `${L.pressure.toFixed(2).replace('.', ',')} bars`)
  rowL(6, 'Viscosidad:', '29 s / 4,1 cPs')
  rowL(7, 'Temperatura:', `${Math.round(L.temp)} °C`)
  rowL(8, 'Temp. tinta:', '37 °C')
  const R = (i, label, value) => {
    text(340, 28 + i * 13, label)
    text(480, 28 + i * 13, value)
  }
  R(0, 'Veloc. motor:', '2000 t/mn')
  R(1, 'Visco. referencia:', '29 s / 4,1 cPs')
  R(2, 'Adiciones:', '04')
  text(340, 28 + 3 * 13, 'DEFECTOS:', { inv: st.cur === 1 })
  text(480, 28 + 3 * 13, Object.keys(s.faults).length ? '☒' : '☐')
  if (s.adjustMode) text(340, 28 + 6 * 13, 'AJUSTE: defectos chorro inhibidos', { inv: true })
  if (st.listOpen != null) {
    const items = ['PARO CHORRO', 'ARRANQUE CHORRO', 'REFRESCO DE TINTA', 'ESTABILIDAD CHORRO', 'INTRO.DISOLVENTE', 'DESOBTURACION BUS', 'AJUSTE CHORRO']
    box(148, 37, 130, items.length * 11 + 4)
    items.forEach((it, i) => text(152, 40 + i * 11, it, { inv: i === st.listOpen }))
  }
}

function drawDefects(g, s, fw) {
  const { text, box } = g
  const codes = Object.keys(s.faults)
  const lines = codes.length ? codes.map((c) => DEFECT_TEXT[c] || [c, '']) : [['Ningún defecto memorizado', '']]
  const h = Math.max(1, lines.length) * 24 + 34
  box(110, 30, 420, Math.min(130, h))
  text(320 - g.tw('DEFECTOS') / 2, 34, 'DEFECTOS', { inv: true })
  lines.slice(0, 4).forEach(([a, b], i) => {
    text(118, 48 + i * 24, a, { inv: codes.length > 0 && i === fw.defects.cur })
    if (b) text(126, 58 + i * 24, b)
  })
  if (codes.length) text(118, Math.min(150, 30 + h - 12), '(i) = resolver / anular  ESC = salir')
}

function drawBoxLines(g, lines, buttons, sel) {
  const { text, tw, box, rect } = g
  const w = Math.max(220, ...lines.map((l) => tw(l) + 30))
  const h = lines.length * 11 + 34
  const x = 320 - w / 2
  const y = 95 - h / 2
  box(x, y, w, h)
  lines.forEach((l, i) => text(x + 12, y + 7 + i * 11, l))
  const by = y + h - 17
  buttons.forEach((b, i) => {
    const bx = buttons.length === 1 ? 320 - 25 : i === 0 ? x + 30 : x + w - 80
    rect(bx, by, 50, 12)
    text(bx + 25 - tw(b) / 2, by + 3, b, { inv: i === sel && buttons.length > 1 })
  })
}

function drawForm(g, s, fw, blinkOn) {
  const { px, text, tw, rect, box } = g
  const d = fw.dlg
  const F = FORMS[d.form]
  const fields = F.fields.map((f, i) => ({ f, i })).filter(({ f }) => !f.hide?.(d) || true)
  const cols = F.cols || 1
  const rows = Math.ceil(fields.length / cols)
  const colW = cols === 2 ? 300 : 360
  const w = cols === 2 ? 620 : 380
  const h = Math.min(136, rows * 13 + 26 + (d.err ? 11 : 0))
  const x = 320 - w / 2
  const y = 27
  box(x, y, w, h)
  const title = F.title(s, fw, d)
  text(x + w / 2 - tw(title) / 2, y + 3, title)
  px(x, y + 12, w, 1)
  const labelW = cols === 2 ? 150 : 190
  fields.forEach(({ f, i }, k) => {
    const c = cols === 2 ? k % 2 : 0
    const r = cols === 2 ? Math.floor(k / 2) : k
    const fx = x + 6 + c * colW
    const fy = y + 16 + r * 13
    const hidden = f.hide?.(d)
    text(fx, fy, f.label + (f.type === 'chk' || f.type === 'btn' || f.label.includes(':') ? '' : ':'), { inv: i === d.cur })
    const vx = fx + labelW
    const val = d.v[f.k]
    if (hidden) {
      text(vx + 3, fy, '---')
      return
    }
    if (f.type === 'chk') {
      text(vx + 3, fy, val ? '☒' : '☐')
      if (f.code) text(vx + 14, fy, f.code)
    } else if (f.type === 'ro') text(vx + 3, fy, String(val ?? ''))
    else if (f.type === 'sel') {
      const lab = (f.opts.find((o) => o[0] === val) || f.opts[0])[1]
      const bw = Math.max(60, ...f.opts.map((o) => tw(o[1]) + 8))
      rect(vx, fy - 2, bw, 11)
      text(vx + 3, fy, lab)
    } else {
      const shown = d.edit && i === d.cur ? d.buf + (blinkOn ? '_' : ' ') : String(val ?? '')
      const bw = Math.max(30, (f.len || 6) * 6 + 8)
      rect(vx, fy - 2, bw, 11, f.type === 'text')
      text(vx + 3, fy, shown)
    }
  })
  if (d.err) text(x + 8, y + h - 11, d.err, { inv: true })
  // lista desplegable de un campo de selección
  if (d.listOpen != null) {
    const f = F.fields[d.cur]
    const k = fields.findIndex((e) => e.i === d.cur)
    const c = cols === 2 ? k % 2 : 0
    const r = cols === 2 ? Math.floor(k / 2) : k
    const vx = x + 6 + c * colW + labelW
    const fy = y + 16 + r * 13 + 10
    const bw = Math.max(60, ...f.opts.map((o) => tw(o[1]) + 8))
    const ly = Math.min(fy, 160 - f.opts.length * 11)
    box(vx, ly, bw, f.opts.length * 11 + 3)
    f.opts.forEach((o, j) => text(vx + 3, ly + 2 + j * 11, o[1], { inv: j === d.listOpen }))
  }
}

function drawList(g, s, fw, blinkOn) {
  const { text, tw, box, rect } = g
  const d = fw.dlg
  const titles = { select: 'SELECCION MENSAJES', open: 'ABRIR', font: 'SELECCION FUENTE', user: 'CAMPOS DE USUARIO', bctype: 'CODIGO DE BARRAS' }
  const vis = 9
  const start = Math.max(0, Math.min(d.cur - 4, d.items.length - vis))
  const items = d.items.slice(start, start + vis)
  const w = d.list === 'user' ? 300 : 200
  const h = items.length * 11 + 34
  const x = d.list === 'select' || d.list === 'open' ? 380 : 320 - w / 2
  const y = 28
  box(x, y, w, h)
  text(x + w / 2 - tw(titles[d.list]) / 2, y + 3, titles[d.list])
  if (d.list === 'select' || d.list === 'open') {
    text(x + 8, y + 15, 'Mensaje:')
    rect(x + 62, y + 13, 70, 11, true)
    text(x + 65, y + 15, (d.typed || '') + (d.typing && blinkOn ? '_' : ''))
  }
  items.forEach((it, j) => {
    const i = start + j
    const yy = y + 28 + j * 11 - (d.list === 'select' || d.list === 'open' ? 0 : 10)
    const mark = d.list === 'select' && it === s.activeMessage ? '*' : ' '
    if (d.list === 'user') {
      const ov = s.opvars.find((o) => o.name === it)
      text(x + 8, yy, it, { inv: i === d.cur })
      rect(x + 120, yy - 2, 160, 11, true)
      text(x + 123, yy, d.edit && i === d.cur ? d.buf + (blinkOn ? '_' : '') : ov ? ov.value || ov.def : '')
    } else text(x + 8, yy, `${mark}${it}`, { inv: i === d.cur })
  })
  // vista previa del nombre (a la izquierda) al seleccionar
  if (d.list === 'select') {
    const nm = d.items[d.cur]
    text(40, 80, nm || '', { sx: 2, sy: 2 })
  }
}

export default function Screen9040({ className = '' }) {
  const { state } = useStore()
  const ref = useRef(null)
  const stRef = useRef(state)
  stRef.current = state
  useEffect(() => {
    let raf
    let last = ''
    const loop = () => {
      const s = stRef.current
      const blink = Math.floor(Date.now() / 450) % 2 === 0
      const key = `${s.seq}|${blink}|${Math.floor(Date.now() / 500)}`
      if (key !== last) {
        last = key
        const ctx = ref.current?.getContext('2d')
        if (ctx) draw(ctx, s, blink)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} width={W} height={H} className={className} style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }} />
}
