export const MAX_TRACKS = 4

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function volumeToPercent(volume) {
  return Math.round(clamp(volume, 0, 1) * 100)
}

export function percentToVolume(percent) {
  return clamp(percent / 100, 0, 1)
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function truncate(text, max = 42) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
