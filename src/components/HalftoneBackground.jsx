import { useEffect, useRef } from 'react'
import { useHalftoneAudio } from '../hooks/useHalftoneAudio'

const DOT_SPACING = 6

function viewportSize() {
  return {
    w: window.visualViewport?.width ?? window.innerWidth,
    h: window.visualViewport?.height ?? window.innerHeight,
  }
}

export default function HalftoneBackground({ activeTracks, layeringPulseRef }) {
  const canvasRef = useRef(null)
  const energyRef = useHalftoneAudio(activeTracks, layeringPulseRef)
  const pulseRef = useRef(layeringPulseRef)

  useEffect(() => {
    pulseRef.current = layeringPulseRef
  }, [layeringPulseRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const { w, h } = viewportSize()
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)

    const draw = (time) => {
      const { w, h } = viewportSize()
      const energy = energyRef.current
      const layer = pulseRef.current?.current

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      const maxDist = Math.sqrt(cx * cx + cy * cy)
      const waveSpeed = layer ? 0.0022 : 0.001

      for (let y = 0; y < h; y += DOT_SPACING) {
        for (let x = 0; x < w; x += DOT_SPACING) {
          const dx = x - cx
          const dy = y - cy
          const dist = Math.sqrt(dx * dx + dy * dy) / maxDist

          const wave =
            Math.sin(dist * 12 - time * waveSpeed) * 0.5 +
            Math.sin(x * 0.02 + time * waveSpeed * 0.8) * 0.25

          let confirm = 0
          if (layer) {
            const ring = Math.max(
              0,
              1 - Math.abs(dist - layer.progress * 1.05) / 0.14,
            )
            const ripple = Math.sin(dist * 22 - time * 0.003 - layer.progress * 8)
            confirm =
              (ring * 0.75 + (ripple * 0.5 + 0.5) * 0.2) *
              layer.strength *
              (1 - dist * 0.35)
          }

          const gradient = 1 - dist * 0.85
          const intensity = Math.max(0, gradient * 0.35 + wave * 0.12)
          const reactive = energy > 0 ? energy * 0.5 * (1 - dist * 0.5) : 0
          const alpha = Math.min(0.72, intensity + reactive + confirm * 0.45)

          if (alpha < 0.03) continue

          const radius =
            DOT_SPACING * 0.18 +
            alpha * DOT_SPACING * 0.28 +
            (energy > 0 ? energy * DOT_SPACING * 0.14 * (1 - dist) : 0) +
            confirm * DOT_SPACING * 0.22

          const grey = Math.floor(40 + alpha * 180 + confirm * 40)
          ctx.beginPath()
          ctx.arc(x, y, Math.max(0.5, radius), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, ${alpha})`
          ctx.fill()
        }
      }

      animationId = requestAnimationFrame(draw)
    }

    animationId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize)
    }
  }, [energyRef])

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 z-0 pointer-events-none w-screen h-[100dvh]"
      aria-hidden="true"
    />
  )
}
