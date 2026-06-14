import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import ytdl from '@distube/ytdl-core'

const INVIDIOUS_INSTANCES = [
  'https://invidious.fdn.fr',
  'https://vid.puffyan.us',
  'https://invidious.protokolla.fi',
  'https://inv.tux.pizza',
  'https://yt.artemislena.eu',
]

async function invidiousAudioUrl(videoId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(
        `${base}/api/v1/videos/${videoId}?fields=adaptiveFormats,liveNow`,
        { signal: AbortSignal.timeout(6000) },
      )
      if (!response.ok) continue

      const data = await response.json()
      if (data.liveNow) continue

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

async function pipeRemoteUrl(url, res) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ANTSN/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Upstream ${response.status}`)
  }

  res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mp4')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Access-Control-Allow-Origin', '*')

  await pipeline(Readable.fromWeb(response.body), res)
}

async function pipeFromYtdl(videoId, res) {
  const info = await ytdl.getInfo(String(videoId))

  if (info.videoDetails.isLiveContent || info.videoDetails.isLive) {
    throw new Error('Live streams cannot be layered — try a regular video')
  }

  const format = ytdl.chooseFormat(info.formats, {
    filter: 'audioonly',
    quality: 'lowestaudio',
  })

  if (!format) throw new Error('No audio format found')

  res.setHeader('Content-Type', format.mimeType || 'audio/mp4')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Access-Control-Allow-Origin', '*')

  await new Promise((resolve, reject) => {
    const stream = ytdl.downloadFromInfo(info, { format, quality: 'lowestaudio' })
    stream.on('error', reject)
    res.on('close', () => stream.destroy())
    stream.on('end', resolve)
    stream.pipe(res)
  })
}

export async function pipeYouTubeAudio(videoId, res) {
  if (!videoId) throw new Error('videoId required')

  const invidiousUrl = await invidiousAudioUrl(videoId)
  if (invidiousUrl) {
    try {
      await pipeRemoteUrl(invidiousUrl, res)
      return
    } catch {
      /* fall through to ytdl */
    }
  }

  await pipeFromYtdl(videoId, res)
}

export async function handleYouTubeAudioRequest(videoId, res) {
  try {
    await pipeYouTubeAudio(videoId, res)
  } catch (error) {
    if (res.headersSent) {
      res.end()
      return
    }

    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify({ error: error.message || 'Audio stream failed' }))
  }
}
