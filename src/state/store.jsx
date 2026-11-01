import { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react'
import { reducer } from './reducer.js'
import { createInitialState } from '../engine/sim.js'
import { applyMachine } from '../machines/firmware.js'

const KEY = 'cij-sim-v2'
const StoreCtx = createContext(null)

function deepMerge(base, saved) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return saved ?? base
  const out = { ...base }
  for (const k of Object.keys(saved || {})) {
    const b = base[k]
    const v = saved[k]
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(b, v) : v
  }
  return out
}

function load() {
  const init = createInitialState()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      applyMachine(init)
      return init
    }
    const saved = JSON.parse(raw)
    if (saved.version !== init.version) return init
    const merged = deepMerge(init, saved)
    // los mensajes se guardan tal cual (no se mezclan con los de ejemplo)
    if (saved.messages) merged.messages = saved.messages
    merged.ui.screen = 'HOME'
    merged.lesson = null
    merged.mission = null
    merged.toast = null
    applyMachine(merged)
    return merged
  } catch {
    applyMachine(init)
    return init
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const last = useRef(performance.now())

  // Bucle de simulación (4 Hz)
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now()
      const dt = Math.min(1000, now - last.current)
      last.current = now
      dispatch({ type: 'TICK', dt })
    }, 250)
    return () => clearInterval(id)
  }, [])

  // Persistencia (cada 2 s como máximo)
  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    const save = () => {
      try {
        const { toast, prints, ...rest } = stateRef.current
        localStorage.setItem(KEY, JSON.stringify(rest))
      } catch {
        /* almacenamiento no disponible */
      }
    }
    const id = setInterval(save, 2000)
    window.addEventListener('pagehide', save)
    return () => {
      clearInterval(id)
      window.removeEventListener('pagehide', save)
    }
  }, [])

  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

export function useStore() {
  return useContext(StoreCtx)
}

// ---------- Bus de teclas físicas (flechas / ENTER / ESC)
// Los componentes registran manejadores; el último registrado tiene prioridad.
const handlers = []
// `modal`: mientras exista un manejador modal, sólo los modales reciben teclas.
export function useKeyHandler(fn, active = true, modal = false) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!active) return
    const h = { fn: (k) => ref.current(k), modal }
    handlers.push(h)
    return () => {
      const i = handlers.indexOf(h)
      if (i >= 0) handlers.splice(i, 1)
    }
  }, [active, modal])
}

export function pressKey(key) {
  const modalOpen = handlers.some((h) => h.modal)
  for (let i = handlers.length - 1; i >= 0; i--) {
    const h = handlers[i]
    if (modalOpen && !h.modal) continue
    if (h.fn(key) === true) return true
  }
  return modalOpen
}

export function useDispatchers() {
  const { dispatch } = useStore()
  return useCallback((type, payload = {}) => dispatch({ type, ...payload }), [dispatch])
}
