import {
  attachToMixer,
  detachFromMixer,
  getAudioContext,
  setMixerVolume,
} from './audioMixer'
import { prefersYouTubeAudioMix } from '../utils/device'

function getMediaHost() {
  let host = document.getElementById('antsn-media-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'antsn-media-host'
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText =
      'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;left:0;top:0'
    document.body.appendChild(host)
  }
  return host
}

function createMediaElement() {
  if (prefersYouTubeAudioMix()) {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.playsInline = true
    video.controls = false
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    getMediaHost().appendChild(video)
    return video
  }

  const audio = new Audio()
  audio.preload = 'auto'
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')
  return audio
}

function waitForMediaReady(media, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve()
      return
    }

    const timer = setTimeout(() => {
      cleanup()
      if (media.readyState >= HTMLMediaElement.HAVE_METADATA) {
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
      const code = media.error?.code
      const detail =
        code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? 'stream format not supported'
          : code === MediaError.MEDIA_ERR_NETWORK
            ? 'network error loading stream'
            : media.error?.message || 'unknown media error'
      reject(new Error(`Audio load failed: ${detail}`))
    }

    const cleanup = () => {
      clearTimeout(timer)
      media.removeEventListener('loadeddata', onReady)
      media.removeEventListener('canplay', onReady)
      media.removeEventListener('error', onError)
    }

    media.addEventListener('loadeddata', onReady)
    media.addEventListener('canplay', onReady)
    media.addEventListener('error', onError)
  })
}

export function createMixedAudioPlayer(
  audioUrl,
  slotId,
  volume = 0.7,
  callbacks = {},
  { loop = true } = {},
) {
  const media = createMediaElement()
  media.loop = loop

  let usesMixer = false

  media.addEventListener('play', () => callbacks.onPlay?.())
  media.addEventListener('pause', () => callbacks.onPause?.())
  media.addEventListener('ended', () => {
    if (!media.loop) callbacks.onEnded?.()
  })
  media.addEventListener('error', () =>
    callbacks.onError?.(new Error('Audio playback failed')),
  )

  return {
    type: 'mixed-audio',
    setVolume: (v) => {
      if (usesMixer) setMixerVolume(slotId, v)
      else media.volume = v
    },
    play: async () => {
      await getAudioContext()

      media.src = audioUrl
      media.load()

      if (prefersYouTubeAudioMix()) {
        await attachToMixer(slotId, media, volume)
        usesMixer = true
      } else {
        media.volume = volume
      }

      const timeoutMs = prefersYouTubeAudioMix() ? 60_000 : 25_000
      await waitForMediaReady(media, timeoutMs)

      try {
        await media.play()
      } catch (err) {
        if (err?.name === 'NotAllowedError') {
          throw new Error('Audio blocked — tap the page and try again')
        }
        throw err
      }
    },
    pause: () => media.pause(),
    resume: async () => {
      await getAudioContext()
      await media.play()
    },
    getCurrentTime: () => media.currentTime,
    getDuration: () => media.duration || 0,
    isPlaying: () => !media.paused && !media.ended,
    destroy: () => {
      detachFromMixer(slotId)
      media.pause()
      media.removeAttribute('src')
      media.load()
      media.remove()
    },
  }
}
