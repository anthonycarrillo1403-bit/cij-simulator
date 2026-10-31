// Vista esquemática del cabezal: boquilla, punto de quiebra, electrodo de carga,
// placas de deflexión y canal de recuperación (estroboscopio simulado).
import { CHARGE_ELECTRODE, GUTTER_TOL_UM } from '../engine/jet.js'

const X0 = 34
const P = 13 // px por gota

export default function JetView({ live, running, eht, printing, className = '' }) {
  const b = running ? live.breakoff : 0
  const ok = b >= CHARGE_ELECTRODE.from && b <= CHARGE_ELECTRODE.to
  const devPx = Math.max(-16, Math.min(16, (live.devY || 0) * 0.18))
  const devXok = Math.abs(live.devX || 0) <= GUTTER_TOL_UM
  const endY = 40 + devPx
  const total = 26
  const drops = []
  const t = Date.now() / 120
  if (running) {
    for (let i = Math.ceil(b); i < total; i++) {
      const x = X0 + i * P
      const frac = (x - X0) / (total * P)
      let y = 40 + devPx * frac
      const charged = printing && x > 190 && i % 3 === 0
      if (charged) y -= Math.min(26, (x - 190) * 0.22 * (eht / 7200))
      drops.push(<circle key={i} cx={x} cy={y} r={3.3} className={charged ? 'fill-[var(--lcd-ok)]' : ''} fill="currentColor" />)
    }
  }
  // filamento continuo hasta el punto de quiebra con ondulación creciente
  let path = ''
  if (running && b > 0) {
    const L = Math.min(total, b) * P
    path = `M ${X0} 40`
    for (let x = 0; x <= L; x += 2) {
      const amp = 0.4 + (x / L) * 2.6
      path += ` L ${X0 + x} ${40 + Math.sin(x / (P / (2 * Math.PI)) + t) * amp * 0.5}`
    }
  }
  const eFrom = X0 + CHARGE_ELECTRODE.from * P - P / 2
  const eTo = X0 + CHARGE_ELECTRODE.to * P + P / 2
  return (
    <svg viewBox="0 0 400 80" className={`w-full ${className}`} preserveAspectRatio="xMidYMid meet">
      {/* boquilla */}
      <rect x="4" y="26" width="26" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="17" y="70" fontSize="8" textAnchor="middle" fill="currentColor">BOQ.</text>
      {/* electrodo de carga */}
      <rect x={eFrom} y="28" width={eTo - eFrom} height="24" fill={ok ? 'var(--lcd-ok)' : 'var(--lcd-warn)'} opacity="0.18" />
      <rect x={eFrom} y="28" width={eTo - eFrom} height="24" fill="none" stroke="currentColor" strokeDasharray="3 2" />
      <text x={(eFrom + eTo) / 2} y="20" fontSize="8" textAnchor="middle" fill="currentColor">ELECTRODO CARGA 8-10</text>
      {/* placas de deflexión */}
      <line x1="200" y1="14" x2="300" y2="6" stroke="currentColor" strokeWidth="3" />
      <line x1="200" y1="58" x2="300" y2="58" stroke="currentColor" strokeWidth="3" />
      <text x="250" y="72" fontSize="8" textAnchor="middle" fill="currentColor">PLACAS {Math.round(eht)} V</text>
      {/* canal de recuperación */}
      <path d="M 352 30 L 368 30 L 368 50 L 352 50" fill="none" stroke={live.gutterOk || !running ? 'currentColor' : 'var(--lcd-bad)'} strokeWidth="3" />
      <text x="372" y="70" fontSize="8" textAnchor="middle" fill="currentColor">CANAL</text>
      {path && <path d={path} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />}
      <g fill="currentColor">{drops}</g>
      {running && (
        <>
          <line x1={X0 + b * P} y1="24" x2={X0 + b * P} y2="56" stroke={ok ? 'var(--lcd-ok)' : 'var(--lcd-bad)'} strokeWidth="1.5" />
          <text x={X0 + b * P} y="10" fontSize="9" fontWeight="bold" textAnchor="middle" fill={ok ? 'var(--lcd-ok)' : 'var(--lcd-bad)'}>
            {b.toFixed(1)} g
          </text>
        </>
      )}
      {running && !devXok && (
        <text x="360" y="22" fontSize="8" textAnchor="middle" fill="var(--lcd-bad)">X {Math.round(live.devX)}µm</text>
      )}
      {running && <circle cx="360" cy={endY} r="1.5" fill="var(--lcd-bad)" />}
    </svg>
  )
}
