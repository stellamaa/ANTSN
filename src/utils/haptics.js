function vibrate(pattern) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* unsupported or blocked */
  }
}

/** Short tap when mic opens / listening begins */
export function hapticListeningStart() {
  vibrate(14)
}

/** Softer double-tap when listening ends */
export function hapticListeningStop() {
  vibrate([10, 35, 10])
}
