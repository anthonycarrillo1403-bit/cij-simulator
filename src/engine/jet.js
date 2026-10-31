// Modelo físico simplificado del chorro continuo desviado (CIJ).
// Basado en la descripción de los manuales: resonador piezoeléctrico que modula
// el chorro, punto de quiebra dentro del electrodo de carga, detección de fase
// "000111100", recuperación en el canal, alta tensión de deflexión (EHT/THT).

export const NOZZLE_UM = 70 // diámetro de boquilla cabezal G
export const PRESSURE_MIN = 2.4
export const PRESSURE_MAX = 3.6
export const PRESSURE_NOMINAL = 2.9
export const EHT_NOMINAL = 7200
export const EHT_MIN = 3600
export const EHT_MAX = 8100
export const EHT_LEAK_LIMIT = 10 // µA
export const GUTTER_TOL_UM = 20
export const CHARGE_ELECTRODE = { from: 8, to: 10 } // punto de quiebra correcto (gotas)
export const ENCODER_DIVISION_REF = 1500 // división tacométrica que corresponde a la línea simulada

export function jetVelocity(pressure) {
  return 20 * Math.sqrt(Math.max(0, pressure) / PRESSURE_NOMINAL)
}

// Longitud de onda relativa λ/d y ganancia de inestabilidad de Rayleigh.
export function rayleighGain(velocity, freqKHz) {
  const lambdaUm = (velocity / (freqKHz * 1000)) * 1e6
  const ratio = lambdaUm / NOZZLE_UM
  return { ratio, gain: Math.exp(-((ratio - 4.5) ** 2) / (2 * 1.2 ** 2)) }
}

// Punto de quiebra expresado en número de gotas desde la boquilla.
export function breakoffDrops(modulationV, freqKHz, velocity) {
  const { gain } = rayleighGain(velocity, freqKHz)
  const drive = Math.max(1, modulationV) * gain
  return Math.min(40, 2 + 1400 / drive)
}

const NOISY = ['01010011', '10010010', '00100101', '01001001', '10100100', '00000000']

// Patrón de detección de fase (8 fases de prueba). Correcto si hay 3 ó 4 '1' consecutivos.
export function phasePattern(drops, tSec) {
  const bucket = Math.floor(tSec)
  const { from, to } = CHARGE_ELECTRODE
  if (drops >= from && drops <= to) {
    return Math.abs(drops - (from + to) / 2) <= 0.5 ? '00111100' : '00111000'
  }
  if (drops >= from - 1 && drops <= to + 1) {
    return bucket % 2 ? '01110000' : '01011000'
  }
  return NOISY[bucket % NOISY.length]
}

export const phaseOk = (pattern) => /111/.test(pattern)

export function gutterDeviation(jetCfg, hidden, pressure) {
  const devX = hidden.biasX + jetCfg.alignX
  const devY = hidden.biasY + jetCfg.alignY + (pressure - PRESSURE_NOMINAL) * 60
  const maxDev = Math.max(Math.abs(devX), Math.abs(devY))
  const recovery = Math.max(0, Math.min(100, 100 - Math.max(0, maxDev - GUTTER_TOL_UM) * 1.2))
  return { devX, devY, ok: maxDev <= GUTTER_TOL_UM, recovery }
}

export function ehtLeakage(hidden) {
  if (hidden.platesWet) return 34
  return Math.round(hidden.platesDirt * 300) / 10
}

// Rango de regulación del kit de aire: Presión de trabajo + 0,7 bar (-0,1 / +0,3)
export function airKitWindow(workPressure) {
  return { min: workPressure + 0.6, max: workPressure + 1.0 }
}

export function headOverpressure(hw, modelInfo, workPressure) {
  if (!modelInfo.airKit || !hw.airKit.enabled) return false
  const { min, max } = airKitWindow(workPressure)
  const inletOk = hw.airKit.inlet >= 5 && hw.airKit.inlet <= 10
  return inletOk && hw.airKit.regulator >= min - 1e-9 && hw.airKit.regulator <= max + 1e-9
}
