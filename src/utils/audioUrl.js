const PROXY_HOSTS = new Set(['p.scdn.co', 'audio-ssl.itunes.apple.com'])

/** Same-origin URL so Web Audio can mix Spotify previews on iOS. */
export function resolveMixerAudioUrl(url) {
  if (!url || typeof window === 'undefined') return url

  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.origin === window.location.origin) return parsed.toString()
    if (!PROXY_HOSTS.has(parsed.hostname)) return url
    return `/api/audio-proxy?url=${encodeURIComponent(parsed.toString())}`
  } catch {
    return url
  }
}
