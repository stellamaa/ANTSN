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
      'position:fixed;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none;left:0;top:0;z-index:-1'
    document.body.appendChild(host)
  }
  return host
}

function createMediaElement(useVideo) {
  if (useVideo) {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.playsInline = true
    video.controls = false
    video.width = 2
    video.height = 2
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

async function probeStream(url) {
  const response = await fetch(url, {
    headers: { Range: 'bytes=0-1023' },
  })
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('json') || !response.ok) {
    let message = `stream unavailable (${response.status})`
    try {
      const body = await response.text()
      const parsed = JSON.parse(body)
      if (parsed.error) message = parsed.error
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message)
  }

  return contentType
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
          ? 'stream format not supported by this device'
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
  let media = null
  let usesMixer = false

  const bindMediaEvents = (element) => {
    element.addEventListener('play', () => callbacks.onPlay?.())
    element.addEventListener('pause', () => callbacks.onPause?.())
    element.addEventListener('ended', () => {
      if (!element.loop) callbacks.onEnded?.()
    })
    element.addEventListener('error', () =>
      callbacks.onError?.(new Error('Audio playback failed')),
    )
  }

  return {
    type: 'mixed-audio',
    setVolume: (v) => {
      if (usesMixer) setMixerVolume(slotId, v)
      else if (media) media.volume = v
    },
    play: async () => {
      await getAudioContext()

      const contentType = await probeStream(audioUrl)
      const useVideo =
        prefersYouTubeAudioMix() || contentType.toLowerCase().includes('video/')

      media = createMediaElement(useVideo)
      media.loop = loop
      bindMediaEvents(media)

      media.src = audioUrl
      media.load()

      const timeoutMs = prefersYouTubeAudioMix() ? 60_000 : 25_000
      await waitForMediaReady(media, timeoutMs)

      if (prefersYouTubeAudioMix()) {
        await attachToMixer(slotId, media, volume)
        usesMixer = true
      } else {
        media.volume = volume
      }

      try {
        await media.play()
      } catch (err) {
        if (err?.name === 'NotAllowedError') {
          throw new Error('Audio blocked — tap the page and try again')
        }
        throw err
      }
    },
    pause: () => media?.pause(),
    resume: async () => {
      await getAudioContext()
      await media?.play()
    },
    getCurrentTime: () => media?.currentTime ?? 0,
    getDuration: () => media?.duration || 0,
    isPlaying: () => Boolean(media && !media.paused && !media.ended),
    destroy: () => {
      detachFromMixer(slotId)
      if (!media) return
      media.pause()
      media.removeAttribute('src')
      media.load()
      media.remove()
      media = null
    },
  }
}
