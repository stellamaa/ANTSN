import { isMobileDevice } from './device'

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

let switchLabel = null

function getSwitchLabel() {
  if (switchLabel) return switchLabel

  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.display = 'none'

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  label.appendChild(input)

  document.head.appendChild(label)
  switchLabel = label
  return label
}

/** iOS Safari 17.4+ Taptic Engine via checkbox switch toggle. */
function iosSwitchPulse() {
  if (typeof document === 'undefined') return false

  try {
    const label = getSwitchLabel()
    label.click()
    return true
  } catch {
    return false
  }
}

function vibrate(pattern) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  try {
    navigator.vibrate(pattern)
    return true
  } catch {
    return false
  }
}

function pulse() {
  if (isIOS()) {
    iosSwitchPulse()
    return
  }
  if (vibrate(50)) return
  if (isMobileDevice()) iosSwitchPulse()
}

function doublePulse() {
  if (isIOS()) {
    iosSwitchPulse()
    return
  }
  if (vibrate([40, 60, 40])) return
  if (isMobileDevice()) iosSwitchPulse()
}

/** Call synchronously from touchstart / pointerdown (user gesture required). */
export function hapticListeningStart() {
  pulse()
}

/** Call synchronously from touchstart / pointerdown when possible. */
export function hapticListeningStop() {
  doublePulse()
}
