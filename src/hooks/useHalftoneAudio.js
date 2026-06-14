import { useEffect, useRef } from 'react'

export function useHalftoneAudio(activeTracks, layeringPulseRef) {
  const energyRef = useRef(0)
  const tracksRef = useRef(activeTracks)
  const pulseRef = useRef(layeringPulseRef)

  useEffect(() => {
    tracksRef.current = activeTracks
  }, [activeTracks])

  useEffect(() => {
    pulseRef.current = layeringPulseRef
  }, [layeringPulseRef])

  useEffect(() => {
    let frame
    let phase = 0

    const animate = () => {
      phase += 0.06
      const playing = tracksRef.current.filter((t) => t.playing)
      const avgVolume =
        playing.length > 0
          ? playing.reduce((sum, t) => sum + t.volume, 0) / playing.length
          : 0

      const pulse =
        playing.length > 0 ? (Math.sin(phase) * 0.5 + 0.5) * 0.4 * avgVolume : 0
      const shimmer =
        playing.length > 0 ? Math.sin(phase * 2.4) * 0.08 * avgVolume : 0

      const layer = pulseRef.current?.current
      const layerBoost = layer
        ? layer.strength * 0.65 + layer.progress * 0.2
        : 0

      energyRef.current = avgVolume * 0.55 + pulse + shimmer + layerBoost
      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  return energyRef
}
