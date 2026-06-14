export function fadeVolume(player, from, to, durationMs, onUpdate) {
  return new Promise((resolve) => {
    const start = performance.now()
    const delta = to - from

    function step(now) {
      const progress = clamp((now - start) / durationMs, 0, 1)
      const eased = 1 - Math.pow(1 - progress, 2)
      const value = from + delta * eased

      onUpdate(value)

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        resolve()
      }
    }

    requestAnimationFrame(step)
  })
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function scheduleFadeBeforeEnd({
  getCurrentTime,
  getDuration,
  fadeSeconds,
  setVolume,
  getVolume,
  onFadeStart,
}) {
  let faded = false

  return function tick() {
    if (faded) return

    const duration = getDuration()
    const current = getCurrentTime()

    if (!duration || duration <= 0) return

    const remaining = duration - current
    if (remaining <= fadeSeconds && remaining > 0) {
      faded = true
      onFadeStart?.()
      fadeVolume(
        null,
        getVolume(),
        0,
        remaining * 1000,
        setVolume,
      )
    }
  }
}
