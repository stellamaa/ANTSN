import { getSpotifyToken } from './auth'
import { startSpotifyPlayback, transferPlayback } from './api'

let sdkPromise = null
let playerInstance = null
let deviceId = null
let sdkSlotId = null
let initGeneration = 0

const BROWSER_HINT =
  'Open http://127.0.0.1:5173 in Chrome or Safari for full Spotify tracks.'

export function isSpotifyPlaybackSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator.requestMediaKeySystemAccess === 'function'
  )
}

export function getSpotifySdkSlot() {
  return sdkSlotId
}

export function setSpotifySdkSlot(slotId) {
  sdkSlotId = slotId
}

export function clearSpotifySdkSlot(slotId) {
  if (sdkSlotId === slotId) sdkSlotId = null
}

function loadSpotifySDK() {
  if (window.Spotify) return Promise.resolve(window.Spotify)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (window.Spotify) resolve(window.Spotify)
      else reject(new Error('Spotify SDK unavailable'))
    }

    if (!document.getElementById('spotify-sdk')) {
      const script = document.createElement('script')
      script.id = 'spotify-sdk'
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      script.onerror = () => reject(new Error('Failed to load Spotify SDK'))
      document.head.appendChild(script)
    }
  })

  return sdkPromise
}

function formatPlayerError(message) {
  if (!message) return BROWSER_HINT
  if (/failed to initialize/i.test(message)) return BROWSER_HINT
  if (/premium/i.test(message)) return message
  return message
}

export async function initSpotifyPlayer({ onReady, onStateChange, onError }) {
  if (!isSpotifyPlaybackSupported()) {
    const message = BROWSER_HINT
    onError?.(message)
    throw new Error(message)
  }

  const generation = ++initGeneration

  if (playerInstance && deviceId) {
    onReady?.({ player: playerInstance, deviceId })
    return playerInstance
  }

  await loadSpotifySDK()
  if (generation !== initGeneration) return null

  const token = await getSpotifyToken()
  if (generation !== initGeneration) return null
  if (!token) {
    const message = 'Spotify session missing — connect again'
    onError?.(message)
    throw new Error(message)
  }

  const player = new window.Spotify.Player({
    name: 'ANTSN Player',
    volume: 0.7,
    getOAuthToken: async (cb) => {
      const nextToken = await getSpotifyToken()
      if (generation !== initGeneration) return
      if (nextToken) cb(nextToken)
      else onError?.('Spotify session expired — connect again')
    },
  })

  player.addListener('ready', ({ device_id }) => {
    if (generation !== initGeneration) {
      player.disconnect()
      return
    }
    deviceId = device_id
    playerInstance = player
    onReady?.({ player, deviceId: device_id })
  })

  player.addListener('not_ready', () => {
    if (generation !== initGeneration) return
    deviceId = null
  })

  player.addListener('player_state_changed', (state) => {
    if (generation !== initGeneration) return
    onStateChange?.(state)
  })

  player.addListener('initialization_error', ({ message }) => {
    if (generation !== initGeneration) return
    onError?.(formatPlayerError(message))
  })
  player.addListener('authentication_error', ({ message }) => {
    if (generation !== initGeneration) return
    onError?.(message)
  })
  player.addListener('account_error', ({ message }) => {
    if (generation !== initGeneration) return
    onError?.(message || 'Spotify Premium required for full playback')
  })
  player.addListener('playback_error', ({ message }) => {
    if (generation !== initGeneration) return
    onError?.(message)
  })

  const connected = await player.connect()
  if (generation !== initGeneration) {
    player.disconnect()
    return null
  }
  if (!connected) {
    const message = BROWSER_HINT
    onError?.(message)
    throw new Error(message)
  }

  return player
}

export async function playSpotifyFull(slotId, track, volume = 0.7) {
  const player = playerInstance
  if (!player || !deviceId) {
    throw new Error('Spotify player not ready — ensure Premium and log in')
  }

  sdkSlotId = slotId
  await transferPlayback(deviceId)
  await startSpotifyPlayback(deviceId, track.uri)
  player.setVolume(volume)

  return {
    type: 'spotify-sdk',
    setVolume: (v) => player.setVolume(v),
    setPan: () => {},
    play: async () => {
      await startSpotifyPlayback(deviceId, track.uri)
    },
    pause: () => player.pause(),
    resume: () => player.resume(),
    getCurrentTime: async () => {
      const state = await player.getCurrentState()
      return state ? state.position / 1000 : 0
    },
    getDuration: async () => {
      const state = await player.getCurrentState()
      return state?.duration ? state.duration / 1000 : 0
    },
    isPlaying: async () => {
      const state = await player.getCurrentState()
      return Boolean(state && !state.paused)
    },
    destroy: () => {
      player.pause()
      if (sdkSlotId === slotId) sdkSlotId = null
    },
  }
}

export function createPreviewPlayer(previewUrl, volume = 0.7) {
  const audio = new Audio(previewUrl)
  audio.volume = volume
  audio.loop = true
  audio.crossOrigin = 'anonymous'

  return {
    type: 'spotify-preview',
    setVolume: (v) => {
      audio.volume = v
    },
    setPan: () => {},
    play: async () => {
      await audio.play()
    },
    pause: () => audio.pause(),
    resume: async () => {
      await audio.play()
    },
    getCurrentTime: () => audio.currentTime,
    getDuration: () => audio.duration || 30,
    isPlaying: () => !audio.paused,
    destroy: () => {
      audio.pause()
      audio.src = ''
    },
  }
}

export function destroySpotifyPlayer() {
  initGeneration += 1
  if (playerInstance) {
    try {
      playerInstance.disconnect()
    } catch {
      /* already disconnected */
    }
    playerInstance = null
    deviceId = null
    sdkSlotId = null
  }
}
