function isTouchDevice() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/**
 * iOS Safari 17.4+ — toggling `<input type="checkbox" switch>` fires the Taptic Engine.
 * No public haptics API exists on iOS web; this is the standard workaround.
 */
function iosSwitchPulse() {
  if (typeof document === 'undefined') return false

  try {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    label.appendChild(input)

    document.body.appendChild(label)
    label.click()
    document.body.removeChild(label)
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
  if (vibrate(45)) return
  if (isTouchDevice()) iosSwitchPulse()
}

function doublePulse() {
  if (vibrate([35, 55, 35])) return
  if (!isTouchDevice()) return

  iosSwitchPulse()
  window.setTimeout(iosSwitchPulse, 110)
}

/** Call synchronously from pointerdown / click (user gesture required). */
export function hapticListeningStart() {
  pulse()
}

/** Call synchronously from pointerdown / click when possible. */
export function hapticListeningStop() {
  doublePulse()
}
