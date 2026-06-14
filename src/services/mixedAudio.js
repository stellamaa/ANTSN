import {
  attachToMixer,
  detachFromMixer,
  getAudioContext,
  setMixerVolume,
} from './audioMixer'
import { prefersYouTubeAudioMix } from '../utils/device'

function waitForMediaReady(audio, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve()
      return
    }

    const timer = setTimeout(() => {
      cleanup()
      if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve()
        return
      }
      reject(new Error('Audio load timeout'))
    }, timeoutMs)

    const onReady = () => {
      cleanup()
      resolve()
    }

    const onError = () => {
      cleanup()
      const code = audio.error?.code
      const detail =
        code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? 'stream format not supported'
          : code === MediaError.MEDIA_ERR_NETWORK
            ? 'network error loading stream'
            : audio.error?.message || 'unknown media error'
      reject(new Error(`Audio load failed: ${detail}`))
    }

    const cleanup = () => {
      clearTimeout(timer)
      audio.removeEventListener('loadeddata', onReady)
      audio.removeEventListener('canplay', onReady)
      audio.removeEventListener('error', onError)
    }

    audio.addEventListener('loadeddata', onReady)
    audio.addEventListener('canplay', onReady)
    audio.addEventListener('error', onError)
  })
}

export function createMixedAudioPlayer(
  audioUrl,
  slotId,
  volume = 0.7,
  callbacks = {},
  { loop = true } = {},
) {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.loop = loop
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')

  let usesMixer = false

  audio.addEventListener('play', () => callbacks.onPlay?.())
  audio.addEventListener('pause', () => callbacks.onPause?.())
  audio.addEventListener('ended', () => {
    if (!audio.loop) callbacks.onEnded?.()
  })
  audio.addEventListener('error', () =>
    callbacks.onError?.(new Error('Audio playback failed')),
  )

  return {
    type: 'mixed-audio',
    setVolume: (v) => {
      if (usesMixer) setMixerVolume(slotId, v)
      else audio.volume = v
    },
    play: async () => {
      await getAudioContext()

      audio.src = audioUrl
      audio.load()

      if (prefersYouTubeAudioMix()) {
        await attachToMixer(slotId, audio, volume)
        usesMixer = true
      } else {
        audio.volume = volume
      }

      const timeoutMs = prefersYouTubeAudioMix() ? 60_000 : 25_000
      await waitForMediaReady(audio, timeoutMs)

      try {
        await audio.play()
      } catch (err) {
        if (err?.name === 'NotAllowedError') {
          throw new Error('Audio blocked — tap the page and try again')
        }
        throw err
      }
    },
    pause: () => audio.pause(),
    resume: async () => {
      await getAudioContext()
      await audio.play()
    },
    getCurrentTime: () => audio.currentTime,
    getDuration: () => audio.duration || 0,
    isPlaying: () => !audio.paused && !audio.ended,
    destroy: () => {
      detachFromMixer(slotId)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    },
  }
}
