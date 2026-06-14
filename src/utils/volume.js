export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Accept 0–1 or 0–100 from the LLM */
export function normalizeVolume(volume) {
  if (volume == null || Number.isNaN(Number(volume))) return null
  const v = Number(volume)
  if (v > 1) return clamp(v / 100, 0, 1)
  return clamp(v, 0, 1)
}

export function normalizeActions(actions = []) {
  return actions.map((action) => {
    if (action.type === 'play' && action.volume != null) {
      return { ...action, volume: normalizeVolume(action.volume) }
    }
    if (action.type === 'set_volume' && action.volume != null) {
      return { ...action, volume: normalizeVolume(action.volume) }
    }
    if (action.type === 'adjust_volume' && action.delta != null) {
      let delta = Number(action.delta)
      if (Math.abs(delta) > 1) delta = delta / 100
      return { ...action, delta: clamp(delta, -1, 1) }
    }
    return action
  })
}
