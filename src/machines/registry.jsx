// Registro de equipos: panel, pantalla, disposición y nombres de teclas para el tutor.
import PanelS8, { LAYOUT_S8, DisplayS8 } from './s8classic/Panel.jsx'
import Panel9040, { LAYOUT_9040, Display9040 } from './m9040/Panel.jsx'

const S8_NAMES = {
  ONOFF: 'ON/OFF', ALT: 'ALT', F: 'F', FAULT: '☹? Defectos', EDIT: '✎ Edición', AA: 'Aa', DATE: '📅 Fecha/hora', CNT: '001 Contador', PARAM: '↔ Parámetros',
  UP: '▲ Salir/Borrar', DOWN: '▼ Entrar/Seleccionar', LEFT: '◄', RIGHT: '►', CYCLE: '⟳ Ciclo', CAPS: 'CAPS M/m', SPACE: 'Espacio', F_KEY: 'F (letra)',
  COLON: ':', LT: '<', GT: '>', SLASH: '/', MINUS: '–', EQUAL: '=', QUOTE: "'", LBR: '[',
}
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

function Thumb({ Panel, layout }) {
  const w = 80
  const scale = w / layout.width
  return (
    <div className="pointer-events-none relative shrink-0 overflow-hidden rounded-md bg-slate-900" style={{ width: w, height: layout.height * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
        <Panel />
      </div>
    </div>
  )
}

export const MACHINES = {
  S8_CLASSIC: {
    id: 'S8_CLASSIC',
    label: 'Imaje S8 Classic',
    tag: 'Equipo A · chorro simple',
    jetsLabel: '1 chorro · pantalla de 1 línea (40 caracteres)',
    layout: LAYOUT_S8,
    Panel: PanelS8,
    Display: DisplayS8,
    keyName: (id) => S8_NAMES[id] ?? id,
    Thumb: () => <Thumb Panel={PanelS8} layout={LAYOUT_S8} />,
  },
  M9040: {
    id: 'M9040',
    label: 'Markem-Imaje 9040',
    tag: 'Equipo B · doble chorro',
    jetsLabel: 'Bichorro (2 chorros) · pantalla gráfica con menús',
    layout: LAYOUT_9040,
    Panel: Panel9040,
    Display: Display9040,
    keyName: name9040,
    Thumb: () => <Thumb Panel={Panel9040} layout={LAYOUT_9040} />,
  },
}
export const MACHINE_IDS = ['S8_CLASSIC', 'M9040']
