import { getSpotifyToken } from './auth'

export async function searchSpotify(query, limit = 5) {
  const token = await getSpotifyToken()
  if (!token) throw new Error('Log in to Spotify first')

  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(limit),
  })

  const response = await fetch(
    `https://api.spotify.com/v1/search?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    if (response.status === 401) {
      const { clearSpotifySession } = await import('./auth')
      clearSpotifySession()
      throw new Error('Spotify session expired — connect again')
    }
    throw new Error(error?.error?.message || 'Spotify search failed')
  }

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
