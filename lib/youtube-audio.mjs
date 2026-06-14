import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import ytdl from '@distube/ytdl-core'

const PIPED_FALLBACKS = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.nosebs.ru',
]

const INVIDIOUS_INSTANCES = [
  'https://invidious.privacydev.net',
  'https://invidious.fdn.fr',
  'https://vid.puffyan.us',
  'https://invidious.protokolla.fi',
  'https://yt.artemislena.eu',
]

let pipedInstancesCache = null
let pipedInstancesFetchedAt = 0

async function getPipedInstances() {
  if (pipedInstancesCache && Date.now() - pipedInstancesFetchedAt < 300_000) {
    return pipedInstancesCache
  }

  try {
    const response = await fetch('https://piped-instances.kavin.rocks/', {
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) {
      const list = await response.json()
      const urls = list
        .filter((item) => item.api_url && item.uptime_24h > 70)
        .map((item) => item.api_url.replace(/\/$/, ''))
      if (urls.length) {
        pipedInstancesCache = urls
        pipedInstancesFetchedAt = Date.now()
        return urls
      }
    }
  } catch {
    /* use fallbacks */
  }

  pipedInstancesCache = PIPED_FALLBACKS
  pipedInstancesFetchedAt = Date.now()
  return PIPED_FALLBACKS
}

function pickStreamUrl(data) {
  if (data.livestream) return null

  const audio = (data.audioStreams || [])
    .filter((stream) => stream.url)
    .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0]
  if (audio?.url) return audio.url

  const combined = (data.videoStreams || [])
    .filter((stream) => {
      if (!stream.url || stream.videoOnly) return false
      const quality = (stream.quality || '').toUpperCase()
      const fmt = (stream.format || '').toUpperCase()
      const mime = stream.mimeType || ''
      const url = stream.url
      if (quality.includes('LBRY') || quality.includes('HLS')) return false
      if (fmt === 'HLS' || mime.includes('mpegurl')) return false
      if (url.includes('odycdn.com')) return false
      return fmt === 'MPEG_4' || fmt === 'MP4' || mime.includes('video/mp4')
    })
    .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0]
  if (combined?.url) return combined.url

  return null
}

async function pipedStreamUrl(videoId) {
  const instances = await getPipedInstances()

  for (const base of instances) {
    try {
      const response = await fetch(`${base}/streams/${videoId}`, {
        signal: AbortSignal.timeout(12_000),
        headers: { 'User-Agent': 'ANTSN/1.0' },
      })
      if (!response.ok) continue

      const data = await response.json()
      const url = pickStreamUrl(data)
      if (url) return url
    } catch {
      /* try next instance */
    }
  }

  return null
}

async function invidiousAudioUrl(videoId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(
        `${base}/api/v1/videos/${videoId}?fields=adaptiveFormats,liveNow`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (!response.ok) continue

      const data = await response.json()
      if (data.liveNow) continue

      const audio = (data.adaptiveFormats || [])
        .filter((format) => format.type?.includes('audio') && format.url)
        .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0))[0]

      if (audio?.url) return audio.url
    } catch {
      /* try next instance */
    }
  }

  return null
}

async function pipeRemoteUrl(url, res, req) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
  if (req?.headers?.range) {
    headers.Range = req.headers.range
  }

  const response = await fetch(url, { headers })

  if (!response.ok && response.status !== 206) {
    throw new Error(`Upstream ${response.status}`)
  }

  res.statusCode = response.status
  res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mp4')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')

  const contentLength = response.headers.get('content-length')
  const contentRange = response.headers.get('content-range')
  if (contentLength) res.setHeader('Content-Length', contentLength)
  if (contentRange) res.setHeader('Content-Range', contentRange)

  if (!response.body) {
    throw new Error('Upstream returned empty body')
  }

  await pipeline(Readable.fromWeb(response.body), res)
}

async function pipeFromYtdl(videoId, res) {
  const info = await ytdl.getInfo(String(videoId))

  if (info.videoDetails.isLiveContent || info.videoDetails.isLive) {
    throw new Error('Live streams cannot be layered — try a regular video')
  }

  const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly' })
  if (!format?.url) throw new Error('No audio format found')

  res.statusCode = 200
  res.setHeader('Content-Type', format.mimeType || 'audio/mp4')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Access-Control-Allow-Origin', '*')

  await new Promise((resolve, reject) => {
    const stream = ytdl.downloadFromInfo(info, { format })
    stream.on('error', reject)
    res.on('close', () => stream.destroy())
    stream.on('end', resolve)
    stream.pipe(res)
  })
}

export async function pipeYouTubeAudio(videoId, res, req) {
  if (!videoId) throw new Error('videoId required')

  const pipedUrl = await pipedStreamUrl(videoId)
  if (pipedUrl) {
    try {
      await pipeRemoteUrl(pipedUrl, res, req)
      return
    } catch {
      if (res.headersSent) return
    }
  }

  const invidiousUrl = await invidiousAudioUrl(videoId)
  if (invidiousUrl) {
    try {
      await pipeRemoteUrl(invidiousUrl, res, req)
      return
    } catch {
      if (res.headersSent) return
    }
  }

  await pipeFromYtdl(videoId, res)
}

export async function handleYouTubeAudioRequest(videoId, res, req) {
  try {
    await pipeYouTubeAudio(videoId, res, req)
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
