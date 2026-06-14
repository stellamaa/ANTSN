export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

/** Mobile browsers mix multiple HTML5 audio streams better than YouTube iframes. */
export function prefersYouTubeAudioMix() {
  return isMobileDevice()
}
