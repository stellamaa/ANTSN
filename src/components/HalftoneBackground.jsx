import { useEffect, useRef } from 'react'
import { useHalftoneAudio } from '../hooks/useHalftoneAudio'

const DOT_SPACING = 6

function viewportSize() {
  return {
    w: window.visualViewport?.width ?? window.innerWidth,
    h: window.visualViewport?.height ?? window.innerHeight,
  }
}

export default function HalftoneBackground({ activeTracks }) {
  const canvasRef = useRef(null)
  const energyRef = useHalftoneAudio(activeTracks)

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

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      const maxDist = Math.sqrt(cx * cx + cy * cy)

      for (let y = 0; y < h; y += DOT_SPACING) {
        for (let x = 0; x < w; x += DOT_SPACING) {
          const dx = x - cx
          const dy = y - cy
          const dist = Math.sqrt(dx * dx + dy * dy) / maxDist

          const wave =
            Math.sin(dist * 12 - time * 0.001) * 0.5 +
            Math.sin(x * 0.02 + time * 0.0008) * 0.25

          const gradient = 1 - dist * 0.85
          const intensity = Math.max(0, gradient * 0.35 + wave * 0.12)
          const reactive = energy > 0 ? energy * 0.5 * (1 - dist * 0.5) : 0
          const alpha = Math.min(0.55, intensity + reactive)

          if (alpha < 0.03) continue

          const radius =
            DOT_SPACING * 0.18 +
            alpha * DOT_SPACING * 0.28 +
            (energy > 0 ? energy * DOT_SPACING * 0.14 * (1 - dist) : 0)

          const grey = Math.floor(40 + alpha * 180)
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
