import { getSpotifyToken, invalidateAccessToken } from './auth'

function isLocalDev() {
  if (typeof window === 'undefined') return false
  return /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
}

async function spotifyFetch(path, { retry = true } = {}) {
  const token = await getSpotifyToken()
  if (!token) throw new Error('Log in to Spotify first')

  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 401 && retry) {
    invalidateAccessToken()
    const nextToken = await getSpotifyToken({ forceRefresh: true })
    if (nextToken) {
      return spotifyFetch(path, { retry: false })
    }
    const { clearSpotifySession } = await import('./auth')
    clearSpotifySession()
    throw new Error('Spotify session expired — connect again')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const message =
      error?.error?.message ||
      (response.status === 403
        ? 'Spotify access denied — add your account in the Spotify Developer Dashboard'
        : null)
    throw new Error(message || `Spotify request failed (${response.status})`)
  }

  return response
}

async function searchViaServer(query, limit) {
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(limit),
  })

  const token = await getSpotifyToken()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const response = await fetch(`/api/spotify-search?${params}`, { headers })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `Spotify search failed (${response.status})`)
  }

  const data = await response.json()
  return data.tracks || []
}

export async function searchSpotify(query, limit = 5) {
  if (!isLocalDev()) {
    return searchViaServer(query, limit)
  }

  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(limit),
  })

  const response = await spotifyFetch(`/search?${params}`)
  const data = await response.json()
  return (data.tracks?.items || []).map((track) => ({
    id: track.id,
    uri: track.uri,
    title: track.name,
    artist: track.artists?.map((a) => a.name).join(', ') || 'Unknown',
    previewUrl: track.preview_url,
    durationMs: track.duration_ms,
  }))
}

export async function startSpotifyPlayback(deviceId, uri) {
  const token = await getSpotifyToken()
  if (!token) throw new Error('Spotify not authenticated')

  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [uri] }),
    },
  )

  if (response.status === 204) return

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error?.message || 'Spotify playback failed')
  }
}

export async function transferPlayback(deviceId) {
  const token = await getSpotifyToken()
  if (!token) return

  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  })
}

export async function getPlaybackState() {
  const token = await getSpotifyToken()
  if (!token) return null

  const response = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 204) return null
  if (!response.ok) return null
  return response.json()
}
