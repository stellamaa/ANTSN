import { getYouTubeAudioStreamUrl } from '../lib/youtube-audio.mjs'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const videoId = req.query?.videoId
  if (!videoId) {
    return res.status(400).json({ error: 'videoId required' })
  }

  try {
    const url = await getYouTubeAudioStreamUrl(String(videoId))
    return res.status(200).json({ url })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Audio stream failed' })
  }
}
