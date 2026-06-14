import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleYouTubeAudioRequest } from './lib/youtube-audio.mjs'

function youtubeAudioDevPlugin() {
  return {
    name: 'youtube-audio-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/youtube-audio')) return next()

        const url = new URL(req.url, 'http://127.0.0.1')
        const videoId = url.searchParams.get('videoId')

        if (!videoId) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'videoId required' }))
          return
        }

        await handleYouTubeAudioRequest(videoId, res, req)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), youtubeAudioDevPlugin()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
