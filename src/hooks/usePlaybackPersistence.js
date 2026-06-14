import { useEffect } from 'react'
import { resumeAudioContext } from '../services/audioMixer'

export function usePlaybackPersistence({ tracksRef, playersRef }) {
  useEffect(() => {
    async function resumePlayingTracks() {
      if (document.visibilityState !== 'visible') return

      await resumeAudioContext().catch(() => {})

      for (const track of tracksRef.current) {
        if (!track.source || !track.mediaId || !track.playing) continue
        const adapter = playersRef.current[track.id]
        if (!adapter) continue

        try {
          const playing =
            typeof adapter.isPlaying === 'function'
              ? await adapter.isPlaying()
              : adapter.isPlaying?.()

          if (!playing) {
            await adapter.resume?.()
          }
        } catch {
          /* autoplay policy may block until next tap */
        }
      }
    }

    document.addEventListener('visibilitychange', resumePlayingTracks)
    window.addEventListener('pageshow', resumePlayingTracks)
    window.addEventListener('focus', resumePlayingTracks)

    return () => {
      document.removeEventListener('visibilitychange', resumePlayingTracks)
      window.removeEventListener('pageshow', resumePlayingTracks)
      window.removeEventListener('focus', resumePlayingTracks)
    }
  }, [playersRef, tracksRef])
}

let wakeLock = null

export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
  } catch {
    /* ignored */
  }
}

export async function releaseWakeLock() {
  try {
    await wakeLock?.release()
  } catch {
    /* ignored */
  }
  wakeLock = null
}

export function useWakeLockWhilePlaying(isPlaying) {
  useEffect(() => {
    if (isPlaying) {
      requestWakeLock()
      return () => {
        releaseWakeLock()
      }
    }
    releaseWakeLock()
  }, [isPlaying])
}
