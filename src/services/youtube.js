const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY

export async function searchYouTube(query, maxResults = 3) {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your_youtube_api_key_here') {
    throw new Error('YouTube API key not configured. Add VITE_YOUTUBE_API_KEY to .env.local')
  }

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(maxResults),
    videoEmbeddable: 'true',
    key: YOUTUBE_API_KEY,
  })

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error?.message || 'YouTube search failed')
  }

  const data = await response.json()
  return (data.items || []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url,
  }))
}

let apiReadyPromise = null

export function loadYouTubeAPI() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }

  if (apiReadyPromise) return apiReadyPromise

  apiReadyPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }

    if (!document.getElementById('youtube-iframe-api')) {
      const script = document.createElement('script')
      script.id = 'youtube-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  })

  return apiReadyPromise
}

export function getYouTubeAudioStreamSrc(videoId) {
  return `/api/youtube-audio?videoId=${encodeURIComponent(videoId)}`
}

export async function canStreamYouTubeAudio(videoId) {
  try {
    const response = await fetch(getYouTubeAudioStreamSrc(videoId), {
      headers: { Range: 'bytes=0-0' },
    })
    const contentType = response.headers.get('content-type') || ''
    return response.ok && !contentType.includes('json')
  } catch {
    return false
  }
}

export function createYouTubeAudioPlayer(audioUrl, volume = 0.7, callbacks = {}) {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = audioUrl
  audio.volume = volume
  audio.setAttribute('playsinline', 'true')

  audio.addEventListener('play', () => callbacks.onPlay?.())
  audio.addEventListener('pause', () => callbacks.onPause?.())
  audio.addEventListener('ended', () => callbacks.onEnded?.())
  audio.addEventListener('error', () =>
    callbacks.onError?.(new Error('Audio playback failed')),
  )

  return {
    type: 'youtube-audio',
    setVolume: (v) => {
      audio.volume = v
    },
    play: async () => {
      await audio.play()
    },
    pause: () => audio.pause(),
    resume: async () => {
      await audio.play()
    },
    getCurrentTime: () => audio.currentTime,
    getDuration: () => audio.duration || 0,
    isPlaying: () => !audio.paused && !audio.ended,
    destroy: () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    },
  }
}

export function createYouTubePlayer(containerId, videoId, { volume = 70, onStateChange, onReady } = {}) {
  return new window.YT.Player(containerId, {
    height: '200',
    width: '200',
    videoId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      enablejsapi: 1,
    },
    events: {
      onReady: (event) => {
        event.target.setVolume(volume)
        event.target.playVideo()
        onReady?.(event.target)
      },
      onStateChange: (event) => {
        onStateChange?.(event.data, event.target)
      },
    },
  })
}

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
}
