import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleYouTubeAudioRequest, handleResolveRequest } from './lib/youtube-audio.mjs'

function youtubeAudioDevPlugin() {
  return {
    name: 'youtube-audio-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const isResolve = req.url?.startsWith('/api/youtube-audio-resolve')
        const isStream =
          req.url?.startsWith('/api/youtube-audio') &&
          !req.url?.startsWith('/api/youtube-audio-resolve')
        if (!isResolve && !isStream) return next()

        const url = new URL(req.url, 'http://127.0.0.1')
        const videoId = url.searchParams.get('videoId')

        if (!videoId) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'videoId required' }))
          return
        }

        if (isResolve) {
          await handleResolveRequest(videoId, res, req)
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
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
