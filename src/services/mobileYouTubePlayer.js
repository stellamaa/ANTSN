import { attachToMixer, detachFromMixer, getAudioContext, setMixerVolume } from './audioMixer'
import { getYouTubeAudioStreamSrc } from './youtube'

function getMediaHost() {
  let host = document.getElementById('antsn-media-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'antsn-media-host'
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText =
      'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1'
    document.body.appendChild(host)
  }
  return host
}

function waitForMediaReady(media, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    if (media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      resolve()
      return
    }

    const timer = setTimeout(() => {
      cleanup()
      if (media.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve()
        return
      }
      reject(new Error('Stream load timeout'))
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
          ? 'format not supported on this device'
          : code === MediaError.MEDIA_ERR_NETWORK
            ? 'network error'
            : media.error?.message || 'media error'
      reject(new Error(detail))
    }

    const cleanup = () => {
      clearTimeout(timer)
      media.removeEventListener('canplay', onReady)
      media.removeEventListener('error', onError)
    }

    media.addEventListener('canplay', onReady)
    media.addEventListener('error', onError)
  })
}

/**
 * Mobile YouTube playback: same-origin proxied stream + hidden <video>.
 * No cross-origin URLs (those break iOS decode / Web Audio).
 * Web Audio mixer combines multiple tracks (iOS blocks multiple iframes, not this path).
 */
export function createMobileYouTubePlayer(videoId, slotId, volume = 0.7, callbacks = {}) {
  const video = document.createElement('video')
  video.preload = 'auto'
  video.playsInline = true
  video.controls = false
  video.loop = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  getMediaHost().appendChild(video)

  let usesMixer = false

  video.addEventListener('play', () => callbacks.onPlay?.())
  video.addEventListener('pause', () => callbacks.onPause?.())
  video.addEventListener('ended', () => {
    if (!video.loop) callbacks.onEnded?.()
  })

  const playNative = async () => {
    usesMixer = false
    video.volume = volume
    await video.play()
  }

  const playMixed = async () => {
    await getAudioContext()
    await attachToMixer(slotId, video, volume)
    usesMixer = true
    await video.play()
  }

  return {
    type: 'mixed-audio',
    setVolume: (v) => {
      if (usesMixer) setMixerVolume(slotId, v)
      else video.volume = v
    },
    play: async () => {
      video.src = getYouTubeAudioStreamSrc(videoId)
      video.load()
      await waitForMediaReady(video)

      try {
        await playMixed()
      } catch {
        detachFromMixer(slotId)
        await playNative()
      }
    },
    pause: () => video.pause(),
    resume: async () => {
      await getAudioContext()
      await video.play()
    },
    getCurrentTime: () => video.currentTime,
    getDuration: () => video.duration || 0,
    isPlaying: () => !video.paused && !video.ended,
    destroy: () => {
      detachFromMixer(slotId)
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
    },
  }
}
