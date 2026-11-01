// Panel de operador del Markem-Imaje 9040, a escala según la foto del manual (A36952 p. 30):
// banda gris superior (ON/OFF naranja, LEDs de tinta/aditivo), banda morada (LEDs HEAD,
// llave, (i), pantalla, F1–F8, cruceta redonda, ESC/ENTER/TAB) y teclado gris con teclas blancas.
import { useStore } from '../../state/store.jsx'
import { PanelKey, usePress, Led } from '../common.jsx'
import Screen9040 from './Screen9040.jsx'
import { leds } from './firmware.js'

const W = 1640
const H = 1100
const KY = 550 // desplazamiento de la parte del teclado (segunda mitad de la foto)

const keys = []
const add = (id, x, y, w, h, extra = {}) => keys.push({ id, x, y, w, h, ...extra })

// zona de servicio
add('ONOFF', 284, 62, 72, 72, { kind: 'onoff' })
add('WRENCH', 284, 207, 72, 72, { kind: 'round', icon: 'wrench', title: 'Estado / Cabezal (llave)' })
add('INFO', 284, 376, 72, 72, { kind: 'round', icon: 'info', title: 'Defectos y alarmas (i)' })
// F1…F8 bajo cada casilla de icono de la pantalla
const LCD = { x: 415, y: 190, w: 833, h: 260 }
for (let n = 1; n <= 8; n++) {
  const cx = LCD.x + (71 * n) * (LCD.w / 640)
  add(`F${n}`, cx - 33, 478, 66, 57, { kind: 'fkey', label: `F${n}` })
}
// navegación
add('UP', 1390, 98, 70, 62, { kind: 'pad', icon: 'up' })
add('DOWN', 1390, 240, 70, 62, { kind: 'pad', icon: 'down' })
add('LEFT', 1318, 165, 62, 70, { kind: 'pad', icon: 'left' })
add('RIGHT', 1470, 165, 62, 70, { kind: 'pad', icon: 'right' })
add('CENTER', 1381, 156, 88, 88, { kind: 'center' })
add('ESC', 1288, 313, 70, 70, { kind: 'round', label: 'ESC' })
add('ENTER', 1490, 320, 70, 70, { kind: 'round', label: 'ENTER' })
add('TAB', 1390, 365, 70, 70, { kind: 'round', icon: 'tab', label: 'TAB' })

// teclado alfanumérico
const P = 77.7
const KW = 64
const RY = [583, 652, 720, 787, 855].map((y) => y)
const KH = 55
const row1 = [['GRAVE', '`', '~'], ['D1', '1', '!'], ['D2', '2', '@'], ['D3', '3', '#'], ['D4', '4', '$'], ['D5', '5', '%'], ['D6', '6', '€'], ['D7', '7', '&'], ['D8', '8', '*'], ['D9', '9', '('], ['D0', '0', ')'], ['MINUS', '-', '_'], ['EQUAL', '=', '+']]
row1.forEach(([id, a, b], i) => add(id, 95 + P * i, RY[0], KW, KH, { kind: 'key', main: a, sec: b }))
add('BKSP', 1104, RY[0], 139, KH, { kind: 'key', main: 'Backspace', arrow: '←', wide: true })
add('TABK', 95, RY[1], 141, KH, { kind: 'key', main: '⇤', sec: '⇥', wide: true, tabk: true })
'QWERTYUIOP'.split('').forEach((c, i) => add(c, 250 + P * i, RY[1], KW, KH, { kind: 'key', main: c }))
add('LBR', 250 + P * 10, RY[1], KW, KH, { kind: 'key', main: '[', sec: '{' })
add('RBR', 250 + P * 11, RY[1], 62, KH, { kind: 'key', main: ']', sec: '}' })
add('ENTERK', 1180, RY[1], 63, RY[2] + KH - RY[1], { kind: 'key', main: 'Enter', arrow: '↵', tall: true })
add('CAPS', 95, RY[2], 141, KH, { kind: 'key', main: 'Caps lock', wide: true })
'ASDFGHJKL'.split('').forEach((c, i) => add(c, 250 + P * i, RY[2], KW, KH, { kind: 'key', main: c }))
add('SEMI', 250 + P * 9, RY[2], KW, KH, { kind: 'key', main: ';', sec: ':' })
add('QUOTE', 250 + P * 10, RY[2], KW, KH, { kind: 'key', main: "'", sec: '"' })
add('YEN', 250 + P * 11, RY[2], 62, KH, { kind: 'key', main: '¥', sec: '|' })
add('SHIFT', 95, RY[3], 141, KH, { kind: 'key', main: 'Shift', arrow: '↑', wide: true })
'ZXCVBNM'.split('').forEach((c, i) => add(c, 250 + P * i, RY[3], KW, KH, { kind: 'key', main: c }))
add('COMMA', 250 + P * 7, RY[3], KW, KH, { kind: 'key', main: ',', sec: '<' })
add('PERIOD', 250 + P * 8, RY[3], KW, KH, { kind: 'key', main: '.', sec: '>' })
add('SLASH', 250 + P * 9, RY[3], KW, KH, { kind: 'key', main: '/', sec: '?' })
add('SHIFTR', 1026, RY[3], 217, KH, { kind: 'key', main: 'Shift', arrow: '↑', wide: true })
add('CTRL', 95, RY[4], 141, KH, { kind: 'key', main: 'Ctrl', wide: true })
add('ALT', 250, RY[4], 142, KH, { kind: 'key', main: 'Alt', wide: true })
add('SPACE', 405, RY[4], 528, KH, { kind: 'key', main: '' })
add('ALTR', 946, RY[4], 141, KH, { kind: 'key', main: 'Alt', wide: true })
add('CTRLR', 1101, RY[4], 142, KH, { kind: 'key', main: 'Ctrl', wide: true })
// teclado numérico
const NX = [1342, 1420, 1497]
add('NUMLOCK', NX[0], RY[0], 63, KH, { kind: 'key', main: 'Num', main2: 'lock', wide: true })
;[
  [['N7', '7', 'HOME'], ['N8', '8'], ['N9', '9', 'PGUP']],
  [['N4', '4'], ['N5', '5'], ['N6', '6']],
  [['N1', '1', 'END'], ['N2', '2'], ['N3', '3', 'PGDN']],
  [['N0', '0', 'INS'], ['NDOT', '.', 'DEL'], ['NENTER', 'Enter']],
].forEach((row, r) => row.forEach(([id, a, b], c) => add(id, NX[c], RY[r + 1], 63, KH, { kind: 'key', main: a, low: b, wide: a === 'Enter' })))

export const LAYOUT_9040 = {
  width: W,
  height: H,
  keys,
  regions: {
    screen: { x: 380, y: 170, w: 900, h: 380 },
    keyboard: { x: 80, y: 565, w: 1500, h: 360 },
    leds: { x: 60, y: 60, w: 760, h: 400 },
    nav: { x: 1270, y: 80, w: 330, h: 370 },
  },
}

// ------------------------------------------------------------------ dibujo de teclas
const VIOLET = '#7a1f8c'
const KEYBG = 'linear-gradient(180deg,#f4f3ef 0%,#e6e5df 70%,#d6d5cf 100%)'

function RoundIcon({ icon }) {
  if (icon === 'wrench')
    return (
      <svg viewBox="0 0 40 40" className="h-[78%] w-[78%]">
        <path d="M12 26 L24 14 m0 0 a6 6 0 1 0 5 -10 l-4 4 -3 -1 -1 -3 4 -4 a6 6 0 0 0 -8 7" stroke="#6b6b6b" strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <path d="M26 24 v8 M20 33 h12" stroke="#6b6b6b" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M26 26 v1 M26 29 v1" stroke="#6b6b6b" strokeWidth="2" />
      </svg>
    )
  if (icon === 'info') return <span className="font-serif text-[46px] font-bold leading-none text-[#6a6a6a]">i</span>
  if (icon === 'tab')
    return (
      <svg viewBox="0 0 40 40" className="h-[62%] w-[62%]">
        <rect x="4" y="6" width="12" height="12" fill="none" stroke="#8a8a8a" strokeWidth="2" />
        <path d="M6 8 l8 8 m0 -8 l-8 8" stroke="#8a8a8a" strokeWidth="1.6" />
        <rect x="20" y="6" width="16" height="22" fill="none" stroke="#8a8a8a" strokeWidth="2" />
        <path d="M23 12h10M23 17h10M23 22h10" stroke="#8a8a8a" strokeWidth="1.6" />
      </svg>
    )
  return null
}

function PadArrow({ dir }) {
  const d = { up: 'M20 8 L32 28 L8 28z', down: 'M20 32 L32 12 L8 12z', left: 'M8 20 L28 8 L28 32z', right: 'M32 20 L12 8 L12 32z' }[dir]
  return (
    <svg viewBox="0 0 40 40" className="h-[60%] w-[60%]">
      <path d={d} fill="#fff" />
    </svg>
  )
}

function Key9040({ k, press }) {
  if (k.kind === 'onoff')
    return (
      <PanelKey k={k} press={press} title="ON / OFF" className="rounded-full" style={{ background: 'radial-gradient(circle at 40% 35%, #ffad4a, #f87800 60%, #d96400)', boxShadow: '0 3px 0 #8a4100, inset 0 2px 2px rgba(255,255,255,.5)' }}>
        <span className="absolute left-[12px] top-[12px] font-sans text-[21px] font-bold leading-none text-white">ON</span>
        <span className="absolute bottom-[13px] right-[9px] font-sans text-[21px] font-bold leading-none text-white">OFF</span>
      </PanelKey>
    )
  if (k.kind === 'round')
    return (
      <PanelKey k={k} press={press} title={k.title || k.label} className="flex flex-col items-center justify-center rounded-full" style={{ background: KEYBG, border: '3px solid #560057', boxShadow: '0 3px 0 #2c002c' }}>
        {k.icon && <RoundIcon icon={k.icon} />}
        {k.label && <span className={`font-sans font-bold leading-none text-[#7a7a7a] ${k.icon ? 'text-[13px]' : 'text-[18px]'}`}>{k.label}</span>}
      </PanelKey>
    )
  if (k.kind === 'fkey')
    return (
      <PanelKey k={k} press={press} title={k.label} className="rounded-[14px]" style={{ background: KEYBG, boxShadow: '0 3px 0 #3a003a, inset 0 1px 0 #fff' }}>
        <span className="absolute bottom-[5px] right-[8px] font-sans text-[20px] font-bold text-[#8a8a8a]">{k.label}</span>
      </PanelKey>
    )
  if (k.kind === 'pad')
    return (
      <PanelKey k={k} press={press} title={k.icon} className="flex items-center justify-center" style={{ background: 'transparent' }}>
        <PadArrow dir={k.icon} />
      </PanelKey>
    )
  if (k.kind === 'center') return <PanelKey k={k} press={press} title="Centro" className="rounded-full" style={{ background: 'radial-gradient(circle at 45% 40%, #ffffff, #ecebe7 60%, #d2d1cc)', boxShadow: 'inset 0 -3px 4px rgba(0,0,0,.18)' }} />
  // teclas del teclado
  return (
    <PanelKey k={k} press={press} title={k.main || 'Espacio'} className="rounded-[11px]" style={{ background: KEYBG, boxShadow: '0 3px 0 #4a4a4c, inset 0 1px 0 #fff' }}>
      <span className={`absolute left-[8px] top-[4px] font-sans leading-none text-[#6e6e6e] ${k.wide ? 'text-[22px] font-bold' : 'text-[27px]'}`}>{k.main}</span>
      {k.main2 && <span className="absolute left-[8px] top-[28px] font-sans text-[22px] font-bold leading-none text-[#6e6e6e]">{k.main2}</span>}
      {k.sec && <span className="absolute bottom-[4px] right-[8px] font-sans text-[20px] font-bold leading-none" style={{ color: VIOLET }}>{k.sec}</span>}
      {k.arrow && <span className="absolute bottom-[3px] right-[12px] font-sans text-[26px] font-black leading-none" style={{ color: k.main === 'Shift' ? VIOLET : '#6e6e6e' }}>{k.arrow}</span>}
      {k.low && <span className="absolute bottom-[4px] left-[8px] font-sans text-[16px] font-black leading-none" style={{ color: VIOLET }}>{k.low}</span>}
      {k.tabk && <span className="absolute bottom-[4px] left-[8px] font-sans text-[22px] font-black leading-none" style={{ color: VIOLET }}>⇥</span>}
    </PanelKey>
  )
}

// ------------------------------------------------------------------ pictogramas impresos
const Bottle = ({ x, y, full }) => (
  <svg className="absolute" style={{ left: x, top: y }} width="30" height="44" viewBox="0 0 30 44">
    <rect x="9" y="1" width="12" height="6" fill="#fff" />
    <rect x="3" y="8" width="24" height="34" rx="3" fill={full ? '#fff' : 'none'} stroke="#fff" strokeWidth="3" />
    <rect x="3" y="25" width="24" height="17" rx="2" fill={full ? '#3a3a3a' : '#fff'} />
  </svg>
)
const HeadPicto = ({ x, y }) => (
  <svg className="absolute" style={{ left: x, top: y }} width="40" height="40" viewBox="0 0 40 40">
    <path d="M20 2 v8 M20 13 v3 M20 19 v3 M8 30 h24 M20 24 v6" stroke="#fff" strokeWidth="3" />
  </svg>
)

export function Display9040({ mirror }) {
  return (
    <div className={mirror ? 'rounded bg-[#3a0a3a] p-1.5' : 'h-full w-full'}>
      <div style={{ aspectRatio: mirror ? '640 / 200' : undefined, height: mirror ? undefined : '100%' }} className="overflow-hidden">
        <Screen9040 />
      </div>
    </div>
  )
}

export default function Panel9040() {
  const { state } = useStore()
  const press = usePress()
  const L = leds(state)
  return (
    <div className="relative" style={{ width: W, height: H }}>
      <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <clipPath id="p9040">
            <path d={`M70 12 H${W - 70} Q${W - 12} 12 ${W - 12} 70 V${H - 70} Q${W - 14} ${H - 52} ${W - 60} ${H - 48} Q${W / 2} ${H + 6} 60 ${H - 48} Q14 ${H - 52} 12 ${H - 70} V70 Q12 12 70 12z`} />
          </clipPath>
        </defs>
        <g clipPath="url(#p9040)">
          <rect x="0" y="0" width={W} height="165" fill="#767479" />
          <rect x="0" y="165" width={W} height="383" fill="#560057" />
          <rect x="0" y="548" width={W} height="8" fill="#d2ccd6" />
          <rect x="0" y="556" width={W} height={H - 556} fill="url(#kbgrey)" />
          {/* separaciones de zonas */}
          <path d="M392 165 V470 H12 M392 165 H1278 M855 12 V165 M1278 12 V470 M462 470 V548 H1282" stroke="#ece7ef" strokeWidth="3" fill="none" opacity=".85" />
        </g>
        <defs>
          <linearGradient id="kbgrey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#747476" />
            <stop offset="1" stopColor="#929093" />
          </linearGradient>
        </defs>
        <path d={`M70 12 H${W - 70} Q${W - 12} 12 ${W - 12} 70 V${H - 70} Q${W - 14} ${H - 52} ${W - 60} ${H - 48} Q${W / 2} ${H + 6} 60 ${H - 48} Q14 ${H - 52} 12 ${H - 70} V70 Q12 12 70 12z`} fill="none" stroke="#3b3b3d" strokeWidth="5" />
        {/* cruceta: anillo gris dividido en 4 sectores */}
        <circle cx="1425" cy="200" r="108" fill="#737176" stroke="#5a585d" strokeWidth="3" />
        <path d="M1349 124 L1393 168 M1501 124 L1457 168 M1349 276 L1393 232 M1501 276 L1457 232" stroke="#c9c7cc" strokeWidth="3" />
      </svg>

      {/* zona de servicio superior */}
      <Led x={88} y={96} w={24} h={9} on={L.power} color="yellow" />
      <span className="absolute text-[40px] leading-none text-[#e8e8e8]" style={{ left: 142, top: 72 }}>~</span>
      <Led x={578} y={96} w={24} h={9} on={L.additive} color="red" />
      <Bottle x={620} y={76} full={false} />
      <Led x={687} y={96} w={24} h={9} on={L.ink} color="red" />
      <Bottle x={730} y={76} full />

      {/* columna de servicio morada */}
      <Led x={88} y={201} w={24} h={9} on={L.head1} color="green" blink={L.head1 && L.head1Blink} />
      <HeadPicto x={140} y={180} />
      <span className="absolute font-sans text-[17px] text-white" style={{ left: 190, top: 197 }}>HEAD 1</span>
      <Led x={88} y={276} w={24} h={9} on={L.head2} color="green" />
      <HeadPicto x={140} y={255} />
      <span className="absolute font-sans text-[17px] text-white" style={{ left: 190, top: 272 }}>HEAD 2</span>
      <Led x={88} y={416} w={24} h={9} on={L.alarm} color="red" />
      <svg className="absolute" style={{ left: 128, top: 386 }} width="64" height="58" viewBox="0 0 64 58">
        <path d="M32 4 L60 54 H4z" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
        <path d="M32 20 v18 M32 44 v4" stroke="#fff" strokeWidth="5" />
      </svg>
      <span className="absolute text-[40px] font-black leading-none text-white" style={{ left: 214, top: 396 }}>→</span>

      {/* pantalla */}
      <div className="absolute" style={{ left: LCD.x - 8, top: LCD.y - 10, width: LCD.w + 16, height: LCD.h + 20, background: '#2a2a2e', borderRadius: 4 }} />
      <div className="absolute overflow-hidden" style={{ left: LCD.x, top: LCD.y, width: LCD.w, height: LCD.h, borderTop: '5px solid #326bb4' }}>
        <Display9040 />
      </div>
      {/* líneas que unen cada F con su casilla */}
      <svg className="pointer-events-none absolute" style={{ left: 0, top: 0 }} width={W} height={H}>
        {keys
          .filter((k) => k.kind === 'fkey')
          .map((k) => (
            <path key={k.id} d={`M${k.x + k.w / 2} ${LCD.y + LCD.h} V${k.y}`} stroke="#d9c9de" strokeWidth="2" />
          ))}
      </svg>

      {/* teclado */}
      {keys.map((k) => (
        <Key9040 key={k.id} k={k} press={press} />
      ))}
      <Led x={1398} y={589} w={14} h={14} round on={L.num} color="#9be050" />

      {/* logotipo */}
      <div className="absolute flex items-center gap-3" style={{ left: 652, top: 1000 }}>
        <div className="grid h-[66px] w-[66px] place-items-center rounded-full bg-[#652667]">
          <svg viewBox="0 0 40 30" width="40" height="30">
            <path d="M6 8 v16 M14 8 v16 M22 8 v16 M30 4 v20" stroke="#fff" strokeWidth="5" />
          </svg>
        </div>
        <span className="font-sans text-[46px] font-light tracking-tight text-[#e2e0e2]">
          markem<span className="text-[#7a1f8c]">·</span>imaje
        </span>
      </div>
    </div>
  )
}
