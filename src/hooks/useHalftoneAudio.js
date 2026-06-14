import { useEffect, useRef } from 'react'

export function useHalftoneAudio(isActive) {
  const energyRef = useRef(0)

  useEffect(() => {
    if (!isActive) {
      energyRef.current = 0
      return
    }

    let frame
    let phase = 0

    const animate = () => {
      phase += 0.04
      const beat = Math.sin(phase) * 0.5 + 0.5
      const shimmer = Math.sin(phase * 2.7) * 0.15
      energyRef.current = 0.25 + beat * 0.45 + shimmer
      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [isActive])

  return energyRef
}
