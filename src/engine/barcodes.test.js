import { describe, it, expect } from 'vitest'
import bwipjs from 'bwip-js'
import { code128Modules, code128Values, C128_PATTERNS, dataMatrix } from './barcodes.js'

const bwipRaw = (bcid, text) => bwipjs.raw({ bcid, text })[0]

describe('Code 128', () => {
  it('todos los patrones suman 11 módulos (stop 13)', () => {
    C128_PATTERNS.slice(0, 106).forEach((p) => expect([...p].reduce((a, b) => a + +b, 0)).toBe(11))
    expect([...C128_PATTERNS[106]].reduce((a, b) => a + +b, 0)).toBe(13)
  })
  it('checksum conocido para "PJJ123C" (ejemplo estándar)', () => {
    const v = code128Values('PJJ123C')
    expect(v[0]).toBe(104)
    expect(v.at(-1)).toBe(106)
    const sum = v.slice(0, -2).reduce((a, x, i) => a + (i === 0 ? x : x * i), 0)
    expect(v.at(-2)).toBe(sum % 103)
  })
  for (const txt of ['LOTE-A1', 'ABC', 'X1Y2', 'HELLO WORLD']) {
    it(`coincide con bwip-js para "${txt}"`, () => {
      const ours = code128Modules(txt).map((b) => (b ? 1 : 0)).join('')
      const ref = bwipRaw('code128', txt)
      const bbs = ref.sbs
      let mods = ''
      bbs.forEach((w, i) => (mods += (i % 2 === 0 ? '1' : '0').repeat(w)))
      expect(ours).toBe(mods)
    })
  }
})

describe('DataMatrix ECC200', () => {
  for (const txt of ['A', '123456', 'LOTE_A1', 'L2026303-T1', 'GTIN 0123456789012 EXP 261030']) {
    it(`coincide con bwip-js para "${txt}"`, () => {
      const ours = dataMatrix(txt)
      const ref = bwipRaw('datamatrix', txt)
      expect(ours.size).toBe(ref.pixx)
      const flat = ours.matrix.flat().map((b) => (b ? 1 : 0))
      expect(flat).toEqual(Array.from(ref.pixs))
    })
  }
})
