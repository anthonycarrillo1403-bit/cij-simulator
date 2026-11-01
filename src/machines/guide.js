// Ayudas del tutor: qué tecla señalar para llegar a una pantalla o completar una acción.
import * as M9 from './m9040/firmware.js'

// ---------------------------------------------------------------- ayudas de teclas 9040
export const m9 = (s) => s.fw[s.ui.machine] || M9.initFw()
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
