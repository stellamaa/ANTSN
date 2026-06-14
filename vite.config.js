import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { getYouTubeAudioStreamUrl } from './lib/youtube-audio.mjs'

function youtubeAudioDevPlugin() {
  return {
    name: 'youtube-audio-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/youtube-audio')) return next()

        const url = new URL(req.url, 'http://127.0.0.1')
        const videoId = url.searchParams.get('videoId')

        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')

        if (!videoId) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'videoId required' }))
          return
        }

        try {
          const streamUrl = await getYouTubeAudioStreamUrl(videoId)
          res.end(JSON.stringify({ url: streamUrl }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message || 'Audio stream failed' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), youtubeAudioDevPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
