// Codificadores de códigos de barras usados por la pantalla WYSIWYG.
// Code 128 (juegos B y C) y DataMatrix ECC200 (cuadrado, 10x10 a 26x26).

// ---------------------------------------------------------------- Code 128
// Anchos barra/espacio de cada símbolo 0..105, y STOP (106).
export const C128_PATTERNS = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
  '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
  '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
  '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
  '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
  '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112'
).split(' ')

const START_B = 104
const START_C = 105
const CODE_B = 100
const CODE_C = 99
const STOP = 106

// Devuelve la lista de valores de símbolo (incluye start, checksum y stop).
export function code128Values(text) {
  const s = String(text)
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c < 32 || c > 126) throw new Error(`Carácter no válido en Code 128: "${ch}"`)
  }
  const values = []
  const isDigitRun = (i, n) => /^\d+$/.test(s.slice(i, i + n)) && s.length >= i + n
  // Estrategia: juego C para tramos de 4+ dígitos pares (o todo numérico par), si no juego B.
  let i = 0
  let set = null
  const allNumericEven = /^\d+$/.test(s) && s.length % 2 === 0 && s.length >= 2
  if (allNumericEven) {
    values.push(START_C)
    set = 'C'
  } else {
    values.push(START_B)
    set = 'B'
  }
  while (i < s.length) {
    let run = 0
    while (i + run < s.length && /\d/.test(s[i + run])) run++
    if (set === 'B' && run >= 4) {
      // usar sólo un número par de dígitos en C
      const even = run - (run % 2)
      if (run % 2 === 1) {
        values.push(s.charCodeAt(i) - 32)
        i++
      }
      values.push(CODE_C)
      set = 'C'
      for (let k = 0; k < even; k += 2) values.push(parseInt(s.slice(i + k, i + k + 2), 10))
      i += even
      continue
    }
    if (set === 'C') {
      if (isDigitRun(i, 2)) {
        values.push(parseInt(s.slice(i, i + 2), 10))
        i += 2
        continue
      }
      values.push(CODE_B)
      set = 'B'
    }
    values.push(s.charCodeAt(i) - 32)
    i++
  }
  let sum = values[0]
  for (let k = 1; k < values.length; k++) sum += values[k] * k
  values.push(sum % 103)
  values.push(STOP)
  return values
}

// Devuelve array de módulos (true = barra) incluyendo zonas de silencio opcionales.
export function code128Modules(text, quiet = 0) {
  const mods = new Array(quiet).fill(false)
  for (const v of code128Values(text)) {
    const p = C128_PATTERNS[v]
    for (let k = 0; k < p.length; k++) {
      const w = Number(p[k])
      for (let j = 0; j < w; j++) mods.push(k % 2 === 0)
    }
  }
  for (let k = 0; k < quiet; k++) mods.push(false)
  return mods
}

// ------------------------------------------------------- DataMatrix ECC200
const DM_SIZES = [
  { size: 10, data: 3, ecc: 5 },
  { size: 12, data: 5, ecc: 7 },
  { size: 14, data: 8, ecc: 10 },
  { size: 16, data: 12, ecc: 12 },
  { size: 18, data: 18, ecc: 14 },
  { size: 20, data: 22, ecc: 18 },
  { size: 22, data: 30, ecc: 20 },
  { size: 24, data: 36, ecc: 24 },
  { size: 26, data: 44, ecc: 28 },
]

// Tablas GF(256) con polinomio primitivo 0x12D
const EXP = new Array(512)
const LOG = new Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x12d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function rsEncode(data, nEcc) {
  // polinomio generador con raíces α^1..α^n
  let gen = [1]
  for (let i = 1; i <= nEcc; i++) {
    const next = new Array(gen.length + 1).fill(0)
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j]
      next[j + 1] ^= gmul(gen[j], EXP[i])
    }
    gen = next
  }
  const ecc = new Array(nEcc).fill(0)
  for (const d of data) {
    const factor = d ^ ecc[0]
    ecc.shift()
    ecc.push(0)
    for (let j = 0; j < nEcc; j++) ecc[j] ^= gmul(gen[j + 1], factor)
  }
  return ecc
}

function dmAsciiEncode(text) {
  const out = []
  const s = String(text)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    const n = s.charCodeAt(i + 1)
    if (c >= 48 && c <= 57 && n >= 48 && n <= 57) {
      out.push(130 + (c - 48) * 10 + (n - 48))
      i++
    } else if (c < 128) {
      out.push(c + 1)
    } else if (c < 256) {
      out.push(235, c - 127)
    } else {
      out.push('?'.charCodeAt(0) + 1)
    }
  }
  return out
}

function dmPlacement(nrow, ncol) {
  const arr = new Array(nrow * ncol).fill(0)
  const module = (row, col, chr, bit) => {
    if (row < 0) {
      row += nrow
      col += 4 - ((nrow + 4) % 8)
    }
    if (col < 0) {
      col += ncol
      row += 4 - ((ncol + 4) % 8)
    }
    arr[row * ncol + col] = 10 * chr + bit
  }
  const utah = (row, col, chr) => {
    module(row - 2, col - 2, chr, 1)
    module(row - 2, col - 1, chr, 2)
    module(row - 1, col - 2, chr, 3)
    module(row - 1, col - 1, chr, 4)
    module(row - 1, col, chr, 5)
    module(row, col - 2, chr, 6)
    module(row, col - 1, chr, 7)
    module(row, col, chr, 8)
  }
  const corner = (chr, cells) => cells.forEach(([r, c], k) => module(r, c, chr, k + 1))
  let chr = 1
  let row = 4
  let col = 0
  do {
    if (row === nrow && col === 0)
      corner(chr++, [[nrow - 1, 0], [nrow - 1, 1], [nrow - 1, 2], [0, ncol - 2], [0, ncol - 1], [1, ncol - 1], [2, ncol - 1], [3, ncol - 1]])
    if (row === nrow - 2 && col === 0 && ncol % 4)
      corner(chr++, [[nrow - 3, 0], [nrow - 2, 0], [nrow - 1, 0], [0, ncol - 4], [0, ncol - 3], [0, ncol - 2], [0, ncol - 1], [1, ncol - 1]])
    if (row === nrow - 2 && col === 0 && ncol % 8 === 4)
      corner(chr++, [[nrow - 3, 0], [nrow - 2, 0], [nrow - 1, 0], [0, ncol - 2], [0, ncol - 1], [1, ncol - 1], [2, ncol - 1], [3, ncol - 1]])
    if (row === nrow + 4 && col === 2 && !(ncol % 8))
      corner(chr++, [[nrow - 1, 0], [nrow - 1, ncol - 1], [0, ncol - 3], [0, ncol - 2], [0, ncol - 1], [1, ncol - 3], [1, ncol - 2], [1, ncol - 1]])
    do {
      if (row < nrow && col >= 0 && !arr[row * ncol + col]) utah(row, col, chr++)
      row -= 2
      col += 2
    } while (row >= 0 && col < ncol)
    row += 1
    col += 3
    do {
      if (row >= 0 && col < ncol && !arr[row * ncol + col]) utah(row, col, chr++)
      row += 2
      col -= 2
    } while (row < nrow && col >= 0)
    row += 3
    col += 1
  } while (row < nrow || col < ncol)
  if (!arr[nrow * ncol - 1]) {
    arr[nrow * ncol - 1] = 1
    arr[nrow * ncol - ncol - 2] = 1
  }
  return arr
}

// Devuelve { size, matrix } con matrix[fila][col] (fila 0 = superior).
export function dataMatrix(text) {
  const data = dmAsciiEncode(text)
  const spec = DM_SIZES.find((d) => d.data >= data.length)
  if (!spec) throw new Error('Datos demasiado largos para DataMatrix (máx. 26x26)')
  const cw = data.slice()
  // relleno (pad) con aleatorización 253-state
  if (cw.length < spec.data) cw.push(129)
  while (cw.length < spec.data) {
    const pos = cw.length + 1
    let v = 129 + ((149 * pos) % 253) + 1
    if (v > 254) v -= 254
    cw.push(v)
  }
  const all = cw.concat(rsEncode(cw, spec.ecc))
  const n = spec.size - 2
  const place = dmPlacement(n, n)
  const matrix = []
  for (let r = 0; r < spec.size; r++) matrix.push(new Array(spec.size).fill(false))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = place[r * n + c]
      let dark = false
      if (v === 1) dark = true
      else if (v >= 10) {
        const chr = Math.floor(v / 10) - 1
        const bit = v % 10
        dark = Boolean(all[chr] & (1 << (8 - bit)))
      }
      matrix[r + 1][c + 1] = dark
    }
  }
  // patrón de localización: L sólida izquierda/abajo, reloj arriba/derecha
  const S = spec.size
  for (let i = 0; i < S; i++) {
    matrix[i][0] = true
    matrix[S - 1][i] = true
    matrix[0][i] = i % 2 === 0
    matrix[i][S - 1] = (S - 1 - i) % 2 === 0
  }
  matrix[S - 1][S - 1] = true
  return { size: S, matrix, codewords: all }
}
