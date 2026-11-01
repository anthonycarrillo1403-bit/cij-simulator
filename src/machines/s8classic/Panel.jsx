// Panel de operador del Imaje S8 Classic, dibujado a escala a partir de la figura del manual
// (A20733, §1.2 Operator interface): teclado de membrana negro, teclas grises con muesca oscura
// en la esquina inferior derecha, LCD de 1 × 40 caracteres, LEDs POWER/READY/FAULT/ALARM.
import { useStore } from '../../state/store.jsx'
import { PanelKey, usePress, Led } from '../common.jsx'
import LcdDots from '../LcdDots.jsx'
import { view, leds } from './firmware.js'

// Coordenadas medidas en la figura (px de la imagen a 200 ppp) → unidades de diseño
const OX = 322
const OY = 385
const F = 1200 / 748
const R = (x0, y0, x1, y1) => ({ x: (x0 - OX) * F, y: (y0 - OY) * F, w: (x1 - x0) * F, h: (y1 - y0) * F })

const W = 1200
const css = (r) => ({ left: r.x, top: r.y, width: r.w, height: r.h })
const H = Math.round(582 * F)

const keys = []
const add = (id, r, extra = {}) => keys.push({ id, ...r, ...extra })

add('ONOFF', R(466, 479, 500, 513), { kind: 'onoff' })
// fila de funciones
add('ALT', R(466, 694, 500, 728), { kind: 'alt' })
add('F', R(506, 694, 540, 728), { kind: 'f' })
add('FAULT', R(547, 694, 620, 728), { kind: 'fn', icon: 'fault' })
add('EDIT', R(628, 694, 662, 728), { kind: 'fn', icon: 'edit' })
add('AA', R(669, 694, 703, 728), { kind: 'fn', icon: 'aa' })
add('DATE', R(709, 694, 765, 728), { kind: 'fn', icon: 'date' })
add('CNT', R(770, 694, 804, 728), { kind: 'fn', icon: 'cnt' })
add('PARAM', R(810, 694, 865, 728), { kind: 'fn', icon: 'param' })
// flechas
add('UP', R(961, 577, 995, 608), { kind: 'nav', icon: 'up' })
add('LEFT', R(930, 612, 960, 647), { kind: 'tri', icon: 'left' })
add('RIGHT', R(996, 612, 1026, 647), { kind: 'tri', icon: 'right' })
add('DOWN', R(961, 650, 995, 684), { kind: 'nav', icon: 'down' })
add('CYCLE', R(961, 694, 995, 728), { kind: 'fn', icon: 'cycle' })

// teclado alfanumérico: [id, legenda directa, legenda ALT (abajo-izq.), legenda F (abajo-der.)]
const ROWS = [
  [['Q', 'Q'], ['W', 'W'], ['E', 'E'], ['R', 'R'], ['T', 'T'], ['Y', 'Y', '¥'], ['U', 'U'], ['I', 'I'], ['O', 'O', 'Ø'], ['P', 'P', '°']],
  [['A', 'A', 'Å'], ['S', 'S', 'Ä'], ['D', 'D', 'Dm'], ['F_', 'F'], ['G', 'G', 'ü'], ['H', 'H', 'Ü'], ['J', 'J', 'Ö'], ['K', 'K', 'ø'], ['L', 'L', '£'], ['COLON', ':', '', ';']],
  [['Z', 'Z', 'Æ'], ['X', 'X'], ['C', 'C', '¢'], ['V', 'V'], ['B', 'B'], ['N', 'N', 'Ñ'], ['M', 'M'], ['LT', '<', '', ','], ['GT', '>', '', '.'], ['SLASH', '/', '', '?']],
]
const ROW_Y = [760, 800, 840]
ROWS.forEach((row, r) =>
  row.forEach(([id, main, alt, f], i) => {
    const x0 = 466 + 40.8 * i
    add(id === 'F_' ? 'F_KEY' : id, R(x0, ROW_Y[r], x0 + 34, ROW_Y[r] + 32), { kind: 'char', main, alt, f })
  }),
)
add('CAPS', R(466, 878, 540, 912), { kind: 'char', main: 'CAPS', sub: 'M/m', wide: true })
add('SPACE', R(547, 878, 784, 912), { kind: 'char', main: '' })
add('MINUS', R(790, 878, 824, 912), { kind: 'char', main: '–', f: '_' })
add('EQUAL', R(831, 878, 865, 912), { kind: 'char', main: '=', f: '+' })
const PAD = [
  [['7', '٧', '&'], ['8', '٨', '*'], ['9', '٩', '(']],
  [['4', '٤', '$'], ['5', '٥', '%'], ['6', '٦', '€']],
  [['1', '١', '!'], ['2', '٢', '@'], ['3', '٣', '#']],
  [["'", '■', '"', 'QUOTE'], ['0', '٠', ')'], ['[', '', ']', 'LBR']],
]
PAD.forEach((row, r) =>
  row.forEach(([main, alt, f, id], i) => {
    const x0 = 920 + 41 * i
    const y0 = [760, 800, 840, 878][r]
    add(id || main, R(x0, y0, x0 + 34, y0 + 32), { kind: 'char', main, alt, f })
  }),
)
// La tecla F del QWERTY se llama 'F' en el firmware igual que la tecla de función F:
// para no confundirlas, la letra usa el id F_KEY y se traduce al pulsar.

export const LAYOUT_S8 = {
  width: W,
  height: H,
  keys,
  regions: {
    screen: { ...R(450, 560, 1040, 700) },
    keyboard: { ...R(455, 685, 1045, 922) },
    leds: R(560, 465, 820, 525),
  },
}

// ------------------------------------------------------------------ iconos de las teclas
function Icon({ name }) {
  const s = { stroke: '#fff', strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'fault':
      return (
        <svg viewBox="0 0 72 34" className="h-full w-full">
          <circle cx="16" cy="15" r="9" {...s} />
          <circle cx="13" cy="12.5" r="1" fill="#fff" />
          <circle cx="19" cy="12.5" r="1" fill="#fff" />
          <path d="M11.5 20 q4.5 -4 9 0" {...s} />
          <text x="27" y="17" fill="#fff" fontSize="12" fontWeight="700" fontFamily="Arial">?</text>
          <path d="M52 30 l9 -9 m0 0 a5 5 0 1 0 4 -8 l-3 3 -2 -1 -1 -2 3 -3 a5 5 0 0 0 -7 6" stroke="#fff" strokeWidth="2" fill="none" />
        </svg>
      )
    case 'edit':
      return (
        <svg viewBox="0 0 34 34" className="h-full w-full">
          <rect x="6" y="15" width="17" height="13" {...s} strokeWidth="1.8" />
          <path d="M9 19h11M9 22.5h11M9 26h7" {...s} strokeWidth="1.2" />
          <path d="M17 18 L28 6 l2.5 2.5 L19 20 l-3.5 1z" {...s} strokeWidth="1.8" />
        </svg>
      )
    case 'aa':
      return (
        <svg viewBox="0 0 34 34" className="h-full w-full">
          <text x="4" y="25" fill="#fff" fontSize="19" fontWeight="700" fontFamily="Arial Narrow, Arial" letterSpacing="-1">
            Aa
          </text>
        </svg>
      )
    case 'date':
      return (
        <svg viewBox="0 0 56 34" className="h-full w-full">
          <rect x="7" y="8" width="17" height="19" {...s} strokeWidth="1.8" />
          <path d="M7 12h17" {...s} strokeWidth="1.5" />
          <text x="11" y="25" fill="#fff" fontSize="12" fontWeight="700" fontStyle="italic" fontFamily="Arial">5</text>
          <circle cx="38" cy="17" r="8" {...s} strokeWidth="1.8" />
          <path d="M38 12v5l3.5 2.5" {...s} strokeWidth="1.6" />
        </svg>
      )
    case 'cnt':
      return (
        <svg viewBox="0 0 34 34" className="h-full w-full">
          <rect x="5" y="10" width="24" height="14" fill="#fff" />
          <text x="7" y="21.5" fill="#333" fontSize="10.5" fontWeight="700" fontFamily="Courier New, monospace">001</text>
        </svg>
      )
    case 'param':
      return (
        <svg viewBox="0 0 56 34" className="h-full w-full">
          <path d="M6 6v22M4 17h11m-3 -3 3 3 -3 3" {...s} strokeWidth="1.8" />
          <rect x="22" y="5" width="16" height="19" {...s} strokeWidth="1.6" fill="#8a8a8a" />
          <rect x="28" y="11" width="16" height="19" {...s} strokeWidth="1.6" fill="#8a8a8a" />
          <path d="M31 16h10M31 20h10M31 24h7" {...s} strokeWidth="1.2" />
        </svg>
      )
    case 'up':
    case 'down':
      return (
        <svg viewBox="0 0 34 34" className="h-full w-full">
          <rect x="6" y="11" width="22" height="12" rx="1" fill="#fff" stroke="#222" strokeWidth="1" />
          <circle cx="11" cy="17" r="2" fill="#222" />
          <circle cx="18" cy="17" r="2" fill="#222" />
          <circle cx="24" cy="17" r="2" fill="#222" />
          {name === 'up' ? <path d="M11 11 V3 m-3 3 3 -3 3 3" stroke="#fff" strokeWidth="2" fill="none" /> : <path d="M11 23 V32 m-3 -6 3 -3 3 3" stroke="#fff" strokeWidth="2" fill="none" />}
        </svg>
      )
    case 'left':
    case 'right':
      return (
        <svg viewBox="0 0 30 34" className="h-full w-full">
          <path d={name === 'left' ? 'M27 3 L3 17 L27 31z' : 'M3 3 L27 17 L3 31z'} fill="#8f8f8f" stroke="#a8a8a8" strokeWidth="1" />
        </svg>
      )
    case 'cycle':
      return (
        <svg viewBox="0 0 34 34" className="h-full w-full">
          <path d="M10 10 a10 10 0 0 1 14 0 M26 15 a10 10 0 0 1 -5 12 M14 27 a10 10 0 0 1 -6 -11" stroke="#fff" strokeWidth="2.4" fill="none" />
          <path d="M24 6 l1 5 -5 0z M24 25 l-4 3 -1 -5z M6 18 l2 -5 3 4z" fill="#fff" />
        </svg>
      )
    default:
      return null
  }
}

const GREY = 'linear-gradient(160deg,#a3a3a3 0%,#8a8a8a 55%,#7c7c7c 100%)'
// Muesca oscura (curva cóncava) en la esquina inferior derecha de las teclas de carácter
const NOTCH = 'radial-gradient(circle at 118% 128%, #161616 0 44%, transparent 45%)'

function S8Key({ k, press }) {
  const base = { borderRadius: 7, boxShadow: '0 2px 0 #050505, inset 0 1px 0 rgba(255,255,255,.35)' }
  if (k.kind === 'onoff')
    return (
      <PanelKey k={k} press={press} title="ON / OFF" style={{ ...base, background: '#222', border: '3px solid #9a9a9a', borderRadius: 3 }}>
        <span className="block text-center font-sans text-[15px] font-bold leading-[1.05] text-white">
          ON
          <br />
          OFF
        </span>
      </PanelKey>
    )
  if (k.kind === 'alt')
    return (
      <PanelKey k={k} press={press} title="ALT" style={{ ...base, background: 'linear-gradient(160deg,#5e5e5e,#474747)' }}>
        <span className="absolute bottom-[3px] left-[4px] font-sans text-[19px] font-black text-[#2a2a2a]" style={{ WebkitTextStroke: '1px #8b8b8b' }}>
          ALT
        </span>
      </PanelKey>
    )
  if (k.kind === 'f')
    return (
      <PanelKey k={k} press={press} title="F" style={{ ...base, background: `${NOTCH}, linear-gradient(160deg,#f2f2f2,#cfcfcf)` }}>
        <span className="absolute bottom-[1px] right-[5px] font-sans text-[22px] font-bold text-white">F</span>
      </PanelKey>
    )
  if (k.kind === 'tri')
    return (
      <PanelKey k={k} press={press} title={k.icon === 'left' ? '◄' : '►'} style={{ background: 'transparent' }}>
        <Icon name={k.icon} />
      </PanelKey>
    )
  if (k.kind === 'nav')
    return (
      <PanelKey k={k} press={press} title={k.icon === 'up' ? 'Salir / Borrar' : 'Insertar / Seleccionar'} style={{ background: 'transparent' }}>
        <Icon name={k.icon} />
      </PanelKey>
    )
  if (k.kind === 'fn')
    return (
      <PanelKey k={k} press={press} title={k.icon} style={{ ...base, background: k.icon === 'fault' ? `radial-gradient(circle at 106% 125%, #161616 0 40%, transparent 41%), ${GREY}` : GREY, padding: 3 }}>
        <Icon name={k.icon} />
      </PanelKey>
    )
  // teclas de carácter
  return (
    <PanelKey k={k} press={press} title={k.main || 'SPACE'} style={{ ...base, background: `${NOTCH}, ${GREY}` }}>
      <span className="absolute left-[5px] top-[1px] font-sans font-bold leading-none text-white" style={{ fontSize: k.wide ? 15 : 19 }}>
        {k.main}
      </span>
      {k.sub && <span className="absolute left-[5px] top-[19px] font-sans text-[15px] font-bold leading-none text-white">{k.sub}</span>}
      {k.alt && <span className="absolute bottom-[2px] left-[5px] font-sans text-[11px] leading-none text-[#4b4b4b]">{k.alt}</span>}
      {k.f && <span className="absolute bottom-[1px] right-[4px] font-sans text-[14px] font-bold leading-none text-white">{k.f}</span>}
    </PanelKey>
  )
}

// ------------------------------------------------------------------ visualizador
export function DisplayS8({ mirror }) {
  const { state } = useStore()
  const v = view(state)
  return (
    <div className={mirror ? 'rounded bg-[#7d7d7d] p-1.5' : 'h-full w-full'} style={mirror ? undefined : {}}>
      <div style={{ aspectRatio: mirror ? '960 / 40' : undefined, height: mirror ? undefined : '100%' }} className="overflow-hidden rounded-[2px] shadow-[inset_0_0_8px_rgba(0,0,0,.45)]">
        <LcdDots lines={[v.text]} cols={40} cursor={v.cursor} blink={v.blink} />
      </div>
    </div>
  )
}

const LED_POS = {
  power: { x: (668 - OX) * F, y: (477 - OY) * F },
  ready: { x: (668 - OX) * F, y: (508 - OY) * F },
  fault: { x: (712 - OX) * F, y: (477 - OY) * F },
  alarm: { x: (712 - OX) * F, y: (508 - OY) * F },
}

function LedPair({ pos, on, color, blink }) {
  return (
    <>
      <Led x={pos.x} y={pos.y} w={11} h={11} round on={on} color={color} blink={blink} />
      <Led x={pos.x + 10} y={pos.y} w={11} h={11} round on={on} color={color} blink={blink} />
    </>
  )
}

const Dots = ({ x, y }) => (
  <div className="absolute flex gap-[9px]" style={{ left: x, top: y }}>
    {[0, 1, 2].map((i) => (
      <span key={i} className="h-[4px] w-[4px] rounded-full bg-white" />
    ))}
  </div>
)

export default function PanelS8() {
  const { state } = useStore()
  const press = usePress()
  const L = leds(state)
  const lcd = R(540, 612, 850, 649)
  const bezel = R(466, 603, 865, 658)
  return (
    <div className="relative" style={{ width: W, height: H }}>
      {/* cuerpo del panel con el borde superior curvo */}
      <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="s8body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2a2a" />
            <stop offset="1" stopColor="#151515" />
          </linearGradient>
        </defs>
        <path d={`M14 ${H * 0.118} Q ${W * 0.42} ${H * 0.0} ${W - 16} 2 Q ${W - 2} 2 ${W - 2} 18 L ${W - 2} ${H - 16} Q ${W - 2} ${H - 2} ${W - 16} ${H - 2} L 16 ${H - 2} Q 2 ${H - 2} 2 ${H - 16} L 2 ${H * 0.118 + 14} Q 2 ${H * 0.118} 14 ${H * 0.118}z`} fill="url(#s8body)" stroke="#000" strokeWidth="3" />
      </svg>

      {/* logotipo Imaje */}
      <div className="absolute rounded-full" style={{ left: (355 - OX) * F, top: (508 - OY) * F, width: 30 * F, height: 30 * F, background: 'radial-gradient(circle at 40% 40%, #6a6a6a, #3d3d3d)' }} />
      <div className="absolute font-serif italic text-white" style={{ left: (358 - OX) * F, top: (532 - OY) * F, fontSize: 56, fontFamily: '"Brush Script MT", "Segoe Script", cursive', lineHeight: 1 }}>
        Imaje
      </div>

      {/* placa S8 CLASSIC */}
      <div className="absolute flex items-center gap-4 pl-3" style={{ ...css(R(848, 417, 1050, 460)), background: 'linear-gradient(180deg,#c8c8c8,#a9a9a9)' }}>
        <span className="font-sans text-[44px] font-black italic leading-none text-white" style={{ textShadow: '-2px 0 #555, 0 2px #555' }}>
          S8
        </span>
        <span className="font-sans text-[17px] italic tracking-[0.5em] text-[#e6e6e6]">CLASSIC</span>
      </div>

      {/* LEDs */}
      <Dots x={(580 - OX) * F} y={(480 - OY) * F} />
      <Dots x={(580 - OX) * F} y={(511 - OY) * F} />
      <Dots x={(772 - OX) * F} y={(480 - OY) * F} />
      <Dots x={(772 - OX) * F} y={(511 - OY) * F} />
      <span className="absolute font-sans text-[15px] text-white" style={{ left: (624 - OX) * F, top: (474 - OY) * F }}>POWER</span>
      <span className="absolute font-sans text-[15px] text-white" style={{ left: (627 - OX) * F, top: (505 - OY) * F }}>READY</span>
      <span className="absolute font-sans text-[15px] text-white" style={{ left: (731 - OX) * F, top: (474 - OY) * F }}>FAULT</span>
      <span className="absolute font-sans text-[15px] text-white" style={{ left: (731 - OX) * F, top: (505 - OY) * F }}>ALARM</span>
      <LedPair pos={LED_POS.power} on={L.power} color="amber" />
      <LedPair pos={LED_POS.ready} on={L.ready} color="green" blink={L.readyBlink} />
      <LedPair pos={LED_POS.fault} on={L.fault} color="red" />
      <LedPair pos={LED_POS.alarm} on={L.alarm} color="red" />

      {/* visualizador */}
      <div className="absolute rounded-[3px]" style={{ ...css(bezel), background: 'linear-gradient(180deg,#9a9a9a,#7a7a7a)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,.5)' }} />
      <div className="absolute overflow-hidden rounded-[2px] border-2 border-[#3a3a3a]" style={css(lcd)}>
        <DisplayS8 />
      </div>

      {keys.map((k) => (
        <S8Key key={k.id} k={k} press={press} />
      ))}
    </div>
  )
}
