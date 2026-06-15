import {
  attachToMixer,
  detachFromMixer,
  getAudioContext,
  setMixerVolume,
} from './audioMixer'
import { prefersYouTubeAudioMix } from '../utils/device'

/** Spotify preview clips and other direct audio URLs. */
export function createMixedAudioPlayer(
  audioUrl,
  slotId,
  volume = 0.7,
  callbacks = {},
  { loop = true } = {},
) {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = audioUrl
  audio.loop = loop
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')

  let usesMixer = false

  audio.addEventListener('play', () => callbacks.onPlay?.())
  audio.addEventListener('pause', () => callbacks.onPause?.())
  audio.addEventListener('ended', () => {
    if (!audio.loop) callbacks.onEnded?.()
  })

  return {
    type: 'mixed-audio',
    setVolume: (v) => {
      if (usesMixer) setMixerVolume(slotId, v)
      else audio.volume = v
    },
    play: async () => {
      if (prefersYouTubeAudioMix()) {
        await getAudioContext()
        await attachToMixer(slotId, audio, volume)
        usesMixer = true
      } else {
        audio.volume = volume
      }
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
