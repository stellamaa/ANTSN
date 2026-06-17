const ALLOWED_HOSTS = new Set(['p.scdn.co', 'audio-ssl.itunes.apple.com'])

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const rawUrl = req.query?.url
  if (!rawUrl) {
    return res.status(400).json({ error: 'url required' })
  }

  let target
  try {
    target = new URL(String(rawUrl))
  } catch {
    return res.status(400).json({ error: 'invalid url' })
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return res.status(403).json({ error: 'host not allowed' })
  }

  const headers = { 'User-Agent': 'ANTSN/1.0' }
  if (req.headers.range) headers.Range = req.headers.range

  const upstream = await fetch(target.toString(), { headers })
  if (!upstream.ok && upstream.status !== 206) {
    return res.status(upstream.status).json({ error: 'upstream fetch failed' })
  }

  res.statusCode = upstream.status
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.setHeader('Accept-Ranges', 'bytes')

  const contentLength = upstream.headers.get('content-length')
  const contentRange = upstream.headers.get('content-range')
  if (contentLength) res.setHeader('Content-Length', contentLength)
  if (contentRange) res.setHeader('Content-Range', contentRange)

  const buffer = Buffer.from(await upstream.arrayBuffer())
  res.end(buffer)
}
