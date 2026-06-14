const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
].join(' ')

function getRedirectUri() {
  const envUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI
  if (envUri) return envUri.replace(/\/$/, '')

  if (typeof window === 'undefined') return ''

  const { protocol, hostname, port } = window.location
  const host = hostname === 'localhost' ? '127.0.0.1' : hostname
  return `${protocol}//${host}${port ? `:${port}` : ''}`.replace(/\/$/, '')
}

const STORAGE = {
  verifier: 'antsn_spotify_verifier',
  token: 'antsn_spotify_token',
  expiry: 'antsn_spotify_expiry',
  refresh: 'antsn_spotify_refresh',
}

let pendingCallback = null

function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

async function sha256Base64url(value) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function isSpotifyConfigured() {
  return Boolean(CLIENT_ID && CLIENT_ID !== 'your_spotify_client_id_here')
}

export function getStoredToken() {
  const token = sessionStorage.getItem(STORAGE.token)
  const expiry = Number(sessionStorage.getItem(STORAGE.expiry) || 0)
  if (!token || Date.now() >= expiry - 60_000) return null
  return token
}

export function clearSpotifySession() {
  Object.values(STORAGE).forEach((key) => sessionStorage.removeItem(key))
}

async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error_description || 'Spotify token exchange failed')
  }

  return response.json()
}

async function refreshToken(refresh) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refresh,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    clearSpotifySession()
    throw new Error('Spotify session expired — log in again')
  }

  return response.json()
}

function storeTokens(data) {
  sessionStorage.setItem(STORAGE.token, data.access_token)
  sessionStorage.setItem(STORAGE.expiry, String(Date.now() + data.expires_in * 1000))
  if (data.refresh_token) {
    sessionStorage.setItem(STORAGE.refresh, data.refresh_token)
  }
}

export async function getSpotifyToken() {
  const cached = getStoredToken()
  if (cached) return cached

  const refresh = sessionStorage.getItem(STORAGE.refresh)
  if (!refresh) return null

  const data = await refreshToken(refresh)
  storeTokens(data)
  return data.access_token
}

export async function startSpotifyLogin() {
  if (!isSpotifyConfigured()) {
    throw new Error('Add VITE_SPOTIFY_CLIENT_ID to .env.local')
  }

  const verifier = randomString(64)
  const challenge = await sha256Base64url(verifier)
  sessionStorage.setItem(STORAGE.verifier, verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function handleSpotifyCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const error = params.get('error')

  if (error) throw new Error(`Spotify login cancelled: ${error}`)
  if (!code) return false

  if (pendingCallback) return pendingCallback

  const verifier = sessionStorage.getItem(STORAGE.verifier)
  if (!verifier) throw new Error('Spotify login state missing — try again')

  // Strip ?code= before exchange so StrictMode remounts cannot reuse it
  window.history.replaceState({}, '', window.location.pathname)

  pendingCallback = (async () => {
    try {
      const data = await exchangeCode(code, verifier)
      storeTokens(data)
      sessionStorage.removeItem(STORAGE.verifier)
      return true
    } finally {
      pendingCallback = null
    }
  })()

  return pendingCallback
}

export async function logoutSpotify() {
  clearSpotifySession()
}
