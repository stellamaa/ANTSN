export const MAX_TRACKS = 4

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function volumeToPercent(volume) {
  return Math.round(clamp(volume, 0, 1) * 100)
}

export function normalizePan(pan) {
  if (pan == null || Number.isNaN(Number(pan))) return null
  return clamp(Number(pan), -1, 1)
}

export function panToPercent(pan) {
  return Math.round(clamp(pan, -1, 1) * 100)
}

export function panLabel(pan) {
  if (pan < -0.15) return 'L'
  if (pan > 0.15) return 'R'
  return 'C'
}

export function supportsTrackPan(track) {
  return track.playbackMode === 'audio' || track.playbackMode === 'preview'
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
