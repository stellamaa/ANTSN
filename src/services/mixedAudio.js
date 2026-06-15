import {
  attachToMixer,
  detachFromMixer,
  getAudioContext,
  hasMixerNode,
  setMixerPan,
  setMixerVolume,
} from './audioMixer'

/** Spotify preview clips and other direct audio URLs. */
export function createMixedAudioPlayer(
  audioUrl,
  slotId,
  volume = 0.7,
  callbacks = {},
  { loop = true, pan = 0 } = {},
) {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = audioUrl
  audio.loop = loop
  audio.crossOrigin = 'anonymous'
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')

  let usesMixer = false
  let currentVolume = volume
  let currentPan = pan

  audio.addEventListener('play', () => callbacks.onPlay?.())
  audio.addEventListener('pause', () => callbacks.onPause?.())
  audio.addEventListener('ended', () => {
    if (!audio.loop) callbacks.onEnded?.()
  })

  return {
    type: 'mixed-audio',
    setVolume: (v) => {
      currentVolume = v
      if (usesMixer || hasMixerNode(slotId)) {
        usesMixer = true
        setMixerVolume(slotId, v)
      } else {
        audio.volume = v
      }
    },
    setPan: (p) => {
      currentPan = p
      if (usesMixer || hasMixerNode(slotId)) {
        setMixerPan(slotId, p)
      }
    },
    play: async () => {
      await getAudioContext()
      await attachToMixer(slotId, audio, currentVolume, currentPan)
      usesMixer = true
      await audio.play()
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
