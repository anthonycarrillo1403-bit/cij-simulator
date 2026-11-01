// Registro de equipos: panel, pantalla, disposición y nombres de teclas para el tutor.
// Los dos equipos son Markem-Imaje 9040: Equipo A monochorro y Equipo B bichorro.
import Panel9040, { LAYOUT_9040, Display9040 } from './m9040/Panel.jsx'

const M9_NAMES = {
  ONOFF: 'ON/OFF', WRENCH: '🔧 Llave', INFO: 'ⓘ', UP: '▲', DOWN: '▼', LEFT: '◀', RIGHT: '▶', CENTER: '●', ESC: 'ESC', ENTER: 'ENTER', TAB: 'TAB',
  BKSP: 'Backspace', TABK: '⇤⇥', ENTERK: 'Enter', CAPS: 'Caps lock', SHIFT: 'Shift', SHIFTR: 'Shift', CTRL: 'Ctrl', CTRLR: 'Ctrl', ALT: 'Alt', ALTR: 'Alt', SPACE: 'Espacio',
  NUMLOCK: 'Num lock', NDOT: '. DEL', NENTER: 'Enter', GRAVE: '`', MINUS: '-', EQUAL: '=', LBR: '[', RBR: ']', SEMI: ';', QUOTE: "'", YEN: '¥', COMMA: ',', PERIOD: '.', SLASH: '/',
}
const name9040 = (id) => {
  if (M9_NAMES[id]) return M9_NAMES[id]
  if (/^D\d$/.test(id)) return id[1]
  if (/^N\d$/.test(id)) return `${id[1]} (numérico)`
  return id
}

function Thumb() {
  const w = 80
  const scale = w / LAYOUT_9040.width
  return (
    <div className="pointer-events-none relative shrink-0 overflow-hidden rounded-md bg-slate-900" style={{ width: w, height: LAYOUT_9040.height * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
        <Panel9040 />
      </div>
    </div>
  )
}

const base = { layout: LAYOUT_9040, Panel: Panel9040, Display: Display9040, keyName: name9040, Thumb }

export const MACHINES = {
  M9040_1: {
    ...base,
    id: 'M9040_1',
    label: 'Markem-Imaje 9040',
    tag: 'Equipo A · chorro simple',
    jetsLabel: 'Monochorro (1 chorro) · configuración 9040 1.1',
  },
  M9040: {
    ...base,
    id: 'M9040',
    label: 'Markem-Imaje 9040',
    tag: 'Equipo B · doble chorro',
    jetsLabel: 'Bichorro (2 chorros) · 1 cabezal',
  },
}
export const MACHINE_IDS = ['M9040_1', 'M9040']
