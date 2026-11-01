// Ayudas del tutor: qué tecla señalar para llegar a una pantalla o completar una acción.
import * as S8 from './s8classic/firmware.js'
import * as M9 from './m9040/firmware.js'

const editMsg = (s) => s.editing?.message

// ---------------------------------------------------------------- ayudas de teclas S8
export const s8 = (s) => s.fw.S8_CLASSIC || S8.initFw()
// mensaje del S8 que se está viendo/editando
export const s8msg = (s) => editMsg(s) || s.messages[s8(s).msg]
export function s8Select(num) {
  return (s) => {
    const fw = s8(s)
    if (s.power === 'OFF') return 'ONOFF'
    if (fw.scr !== 'HDR') return S8.navKey(s, 'select')
    if (fw.msg !== num) return +fw.msg < +num ? 'RIGHT' : 'LEFT'
    return 'DOWN'
  }
}
export function s8Open(num, then) {
  return (s) => {
    const fw = s8(s)
    if (s.power === 'OFF') return 'ONOFF'
    if (fw.scr === 'HOME') return 'EDIT'
    if (fw.scr === 'HDR' && fw.msg !== num) return +fw.msg < +num ? 'RIGHT' : 'LEFT'
    if (fw.scr === 'HDR') return then || null
    if (fw.scr === 'TXT') return 'EDIT'
    return S8.backKey(s)
  }
}
// entrar en una función del mensaje `num` (PARAM/CNT/DATE) y luego ► n veces
export function s8MsgFunc(num, key, endScr, rights = 0) {
  return (s) => {
    const fw = s8(s)
    if (fw.scr === endScr) return null
    if (s.power === 'OFF') return 'ONOFF'
    if (fw.scr === 'HOME') return 'EDIT'
    if (fw.scr === 'HDR') return fw.msg !== num ? (+fw.msg < +num ? 'RIGHT' : 'LEFT') : key
    const list = Object.values(S8.GROUPS).find((l) => l.includes(fw.scr) && l.includes(endScr))
    if (list && !fw.mod) return list.indexOf(fw.scr) < list.indexOf(endScr) ? 'RIGHT' : 'LEFT'
    return S8.backKey(s)
  }
}
export const s8Nav = (name) => (s) => S8.navKey(s, name)

// ---------------------------------------------------------------- ayudas de teclas 9040
export const m9 = (s) => s.fw.M9040 || M9.initFw()
export const m9Nav = (name) => (s) => M9.navKey(s, name)
export function m9Select(name) {
  return (s) => {
    const fw = m9(s)
    if (fw.dlg?.list !== 'select') return M9.navKey(s, 'select')
    const i = fw.dlg.items.indexOf(name)
    if (fw.dlg.cur !== i) return fw.dlg.cur < i ? 'DOWN' : 'UP'
    return 'ENTER'
  }
}
// En un diálogo: ir al campo k
export function m9Field(target, k) {
  return (s) => {
    const fw = m9(s)
    if (!M9.atTarget(s, target)) return M9.navKey(s, target)
    const d = fw.dlg
    const i = M9.FORMS[d.form].fields.findIndex((f) => f.k === k)
    if (d.listOpen != null || d.edit) return null
    if (d.cur !== i) return d.cur < i ? 'DOWN' : 'UP'
    return 'TAB'
  }
}
export function m9JetFunc(fn) {
  return (s) => {
    const fw = m9(s)
    if (!fw.status) return M9.navKey(s, 'status')
    const funcs = ['PARO CHORRO', 'ARRANQUE CHORRO', 'REFRESCO DE TINTA', 'ESTABILIDAD CHORRO', 'INTRO.DISOLVENTE', 'DESOBTURACION BUS', 'AJUSTE CHORRO']
    if (fw.status.listOpen == null) return fw.status.cur === 0 ? 'TAB' : 'UP'
    const i = funcs.indexOf(fn)
    if (fw.status.listOpen !== i) return fw.status.listOpen < i ? 'DOWN' : 'UP'
    return 'ENTER'
  }
}
export const m9Edit = (s) => {
  const fw = m9(s)
  if (fw.mode === 'EDIT') return null
  return M9.navKey(s, 'text')
}


// Elegir una opción de una lista desplegable de un diálogo del 9040
export function m9Choose(target, k, value) {
  return (s) => {
    const fw = m9(s)
    if (!M9.atTarget(s, target)) return M9.navKey(s, target)
    const d = fw.dlg
    const F = M9.FORMS[d.form]
    const i = F.fields.findIndex((f) => f.k === k)
    const f = F.fields[i]
    if (d.edit) return 'ENTER'
    if (d.listOpen == null) {
      if (d.v[k] === value) return null
      if (d.cur !== i) return d.cur < i ? 'DOWN' : 'UP'
      return 'TAB'
    }
    const j = f.opts.findIndex((o) => o[0] === value)
    if (d.listOpen !== j) return d.listOpen < j ? 'DOWN' : 'UP'
    return 'TAB'
  }
}

// Escribir `text` en el campo k de un diálogo del 9040; `then` = tecla al terminar (DOWN pasa al siguiente campo, ENTER valida el cuadro)
export function m9Type(target, k, text, then = 'DOWN') {
  return (s) => {
    const fw = m9(s)
    if (!M9.atTarget(s, target)) return M9.navKey(s, target)
    const d = fw.dlg
    const F = M9.FORMS[d.form]
    const i = F.fields.findIndex((f) => f.k === k)
    if (!d.edit) {
      const shown = String(d.v[k])
      if ((shown === text || shown.replace(/[:/]/g, '') === text) && then === 'DOWN') return null
      if (d.cur !== i) return d.cur < i ? 'DOWN' : 'UP'
      return 'TAB'
    }
    if (d.buf === text) return then
    return M9.typingKey(s, text)
  }
}

// Marcar una casilla de un diálogo del 9040
export function m9Check(target, k) {
  return (s) => {
    const fw = m9(s)
    if (!M9.atTarget(s, target)) return M9.navKey(s, target)
    const d = fw.dlg
    if (d.v[k]) return null
    const i = M9.FORMS[d.form].fields.findIndex((f) => f.k === k)
    if (d.cur !== i) return d.cur < i ? 'DOWN' : 'UP'
    return 'TAB'
  }
}

// Pantalla actual del S8 Classic
export const s8scr = (s) => s8(s).scr

// ---------------------------------------------------------------- S8: valores y textos completos
// Ir a la función `scr` del mensaje `num` (entrando con fkey) y escribir `digits` (luego ▲ confirma)
export function s8SlotsAt(num, fkey, scr, digits) {
  return (s) => {
    const f = s8(s)
    if (f.scr !== scr) return s8MsgFunc(num, fkey, scr)(s)
    if (!f.mod) return 'DOWN'
    const want = typeof digits === 'function' ? digits(s) : digits
    if (f.buf !== want) return S8.typingKey(s, want)
    return 'UP'
  }
}

const S8_PH = [
  ['ccccccccc', 'CNT'],
  ['jjj', ['DATE', 'J']],
  ['pju', ['DATE', 'P', 'J']],
  ['pd', ['DATE', 'P', 'D']],
  ['pm', ['DATE', 'P', 'M']],
  ['py', ['DATE', 'P', 'Y']],
  ['dd', ['DATE', 'D']],
  ['mm', ['DATE', 'M']],
  ['yy', ['DATE', 'Y']],
  ['hh', ['DATE', 'H']],
  ['nn', ['DATE', 'N']],
  ['ss', ['DATE', 'S']],
  ['ee', ['DATE', 'E']],
  ['e', ['DATE', 'E']],
]

// Contador del mensaje `num`: rellena batch, step, start y final en orden
export function s8Counter(num, vals) {
  const order = [['batch', 'M24', 6], ['step', 'M25', 2], ['start', 'M26', 9], ['end', 'M27', 9]]
  return (s) => {
    const m = s8msg(s)
    for (const [k, scr, w] of order) {
      const want = String(vals[k]).padStart(w, '0')
      if (m && s8(s).msg === num && m.counter[k] === +vals[k] && !(s8(s).scr === scr && s8(s).mod)) continue
      return s8SlotsAt(num, 'CNT', scr, want)(s)
    }
    return null
  }
}

// Dejar la línea 1 del mensaje `num` exactamente como `target` (texto + variables) y guardar con [EDIT]
export function s8Compose(num, targetArg) {
  return (s) => {
    const f = s8(s)
    const target = typeof targetArg === 'function' ? targetArg(s) : targetArg
    if (f.scr !== 'TXT' || f.msg !== num) {
      if (f.scr === 'HDR' && f.msg === num) return 'CYCLE'
      if (S8.FUNCS[f.scr] && f.mod) return 'UP'
      if (S8.FUNCS[f.scr]) return 'UP'
      return s8Open(num, 'CYCLE')(s)
    }
    const cur = S8.input(s) ?? ''
    if (cur === target) return 'EDIT'
    // variable pendiente de completar
    if (f.var === 'DATE' || f.var === 'POST') {
      let i = 0
      while (i < cur.length && cur[i] === target[i]) i++
      const ph = S8_PH.find(([p]) => target.startsWith(p, i))
      if (ph && Array.isArray(ph[1])) return f.var === 'DATE' ? ph[1][1] : ph[1][2]
      return 'EDIT'
    }
    let i = 0
    while (i < cur.length && i < target.length && cur[i] === target[i]) i++
    if (i >= cur.length) {
      const ph = S8_PH.find(([p]) => target.startsWith(p, i))
      if (ph) {
        const cells = S8.lineToCells(s.editing.message.lines[f.line])
        if (f.pos < cells.length) return 'RIGHT'
        return Array.isArray(ph[1]) ? ph[1][0] : ph[1]
      }
    }
    return S8.typingKey(s, target)
  }
}

// ---------------------------------------------------------------- 9040: cadenas de campos
// Rellena varios campos en orden y valida con ENTER: steps = [[k, 'type'|'choose'|'check', valor]]
export function m9Fill(target, steps) {
  return (s) => {
    const fw = m9(s)
    if (!M9.atTarget(s, target)) return M9.navKey(s, target)
    const d = fw.dlg
    for (const [k, how, val] of steps) {
      const v = d.v[k]
      const ok = how === 'check' ? Boolean(v) : how === 'choose' ? v === val : String(v) === String(val) || String(v).replace(/[:/]/g, '') === String(val)
      if (ok && !(d.edit && d.cur === M9.FORMS[d.form].fields.findIndex((f) => f.k === k))) continue
      if (how === 'type') return m9Type(target, k, String(val))(s) || 'DOWN'
      if (how === 'choose') return m9Choose(target, k, val)(s)
      return m9Check(target, k)(s)
    }
    return d.edit ? 'ENTER' : 'ENTER'
  }
}
