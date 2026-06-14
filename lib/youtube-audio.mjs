const INVIDIOUS_INSTANCES = [
  'https://invidious.fdn.fr',
  'https://inv.tux.pizza',
  'https://yt.artemislena.eu',
  'https://inv.nadebo.de',
]

async function fromInvidious(videoId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(
        `${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (!response.ok) continue

      const data = await response.json()
      const audio = (data.adaptiveFormats || [])
        .filter((format) => format.type?.includes('audio'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]

      if (audio?.url) return audio.url
    } catch {
      /* try next instance */
    }
  }

  return null
}

async function fromYtdl(videoId) {
  try {
    const ytdl = await import('@distube/ytdl-core')
    const info = await ytdl.default.getInfo(videoId)
    const format = ytdl.default.chooseFormat(info.formats, { quality: 'lowestaudio' })
    return format?.url || null
  } catch {
    return null
  }
}

export async function getYouTubeAudioStreamUrl(videoId) {
  if (!videoId) throw new Error('videoId required')

  const invidiousUrl = await fromInvidious(videoId)
  if (invidiousUrl) return invidiousUrl

  const ytdlUrl = await fromYtdl(videoId)
  if (ytdlUrl) return ytdlUrl

  throw new Error('Could not resolve YouTube audio stream')
}
