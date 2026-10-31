import { useStore } from '../state/store.jsx'
import DotMatrix from './DotMatrix.jsx'
import { rasterMessage } from '../engine/render.js'
import { rtcNow } from '../engine/rtc.js'

export function MessagePreview({ message, maxPitch = 5, align }) {
  const { state } = useStore()
  if (!message) return <div className="flex h-full items-center justify-center text-xs c-dim">Sin mensaje</div>
  const r = rasterMessage(message, { now: rtcNow(state.rtcOffset), opvars: state.opvars, v24: state.hw.v24 })
  if (!r.width) return <div className="flex h-full items-center justify-center text-xs c-dim">Mensaje vacío</div>
  return <DotMatrix cols={r.cols} maxPitch={maxPitch} align={align} />
}

export default function ActivePreview(props) {
  const { state } = useStore()
  return <MessagePreview message={state.messages[state.activeMessage]} {...props} />
}
