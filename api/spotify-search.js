const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API_BASE = 'https://api.spotify.com/v1'

let appToken = null
let appTokenExpiry = 0

function getClientId() {
  return process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID
}

function getBearerToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7).trim()
}

function formatSpotifyError(status, errorBody) {
  const spotifyMessage = errorBody?.error?.message
  if (spotifyMessage) return spotifyMessage

  if (status === 403) {
    return 'Spotify denied access — disconnect, reconnect, and confirm your Spotify email is in the app User Management list'
  }

  return `Spotify search failed (${status})`
}

async function getAppAccessToken() {
  const clientId = getClientId()
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (appToken && Date.now() < appTokenExpiry - 60_000) {
    return appToken
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) return null

  const data = await response.json()
  appToken = data.access_token
  appTokenExpiry = Date.now() + data.expires_in * 1000
  return appToken
}

function mapTracks(items = []) {
  return items.map((track) => ({
    id: track.id,
    uri: track.uri,
    title: track.name,
    artist: track.artists?.map((a) => a.name).join(', ') || 'Unknown',
    previewUrl: track.preview_url,
    durationMs: track.duration_ms,
  }))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const query = req.query?.q
  if (!query || !String(query).trim()) {
    return res.status(400).json({ error: 'q required' })
  }

  const limit = Math.min(Number(req.query?.limit) || 5, 20)
  const params = new URLSearchParams({
    q: String(query),
    type: 'track',
    limit: String(limit),
  })

  const userToken = getBearerToken(req)
  const token = userToken || (await getAppAccessToken())

  if (!token) {
    return res.status(401).json({
      error: 'Log in to Spotify first (disconnect and connect again if needed)',
    })
  }

  const response = await fetch(`${API_BASE}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    return res.status(response.status).json({
      error: formatSpotifyError(response.status, error),
      usedUserToken: Boolean(userToken),
    })
  }

  const data = await response.json()
  return res.status(200).json({ tracks: mapTracks(data.tracks?.items) })
}
