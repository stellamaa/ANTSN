let tickContext = null

function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

function vibrate(pattern) {
  if (!canVibrate()) return false
  try {
    navigator.vibrate(pattern)
    return true
  } catch {
    return false
  }
}

/** iOS Safari has no Vibration API — tiny inaudible pulse via Web Audio instead. */
async function audioTick({ frequency = 160, duration = 0.022, gain = 0.035 } = {}) {
  if (typeof window === 'undefined') return

  try {
    const ctx = tickContext || new AudioContext()
    tickContext = ctx
    if (ctx.state === 'suspended') await ctx.resume()

    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    amp.gain.value = gain
    osc.connect(amp)
    amp.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch {
    /* ignored */
  }
}

/** Call synchronously from a user gesture (tap). */
export function hapticListeningStart() {
  if (!vibrate(16)) audioTick({ frequency: 180, duration: 0.02 })
}

/** Call synchronously from a user gesture when possible. */
export function hapticListeningStop() {
  if (!vibrate([12, 40, 12])) audioTick({ frequency: 120, duration: 0.028, gain: 0.03 })
}
