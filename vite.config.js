import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleYouTubeAudioRequest, handleResolveRequest } from './lib/youtube-audio.mjs'

function youtubeAudioDevPlugin() {
  return {
    name: 'youtube-audio-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/audio-proxy')) {
          const url = new URL(req.url, 'http://127.0.0.1')
          const target = url.searchParams.get('url')
          if (!target) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'url required' }))
            return
          }

          let parsed
          try {
            parsed = new URL(target)
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'invalid url' }))
            return
          }

          if (!['p.scdn.co', 'audio-ssl.itunes.apple.com'].includes(parsed.hostname)) {
            res.statusCode = 403
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'host not allowed' }))
            return
          }

          const upstream = await fetch(parsed.toString())
          if (!upstream.ok) {
            res.statusCode = upstream.status
            res.end(await upstream.text())
            return
          }

          res.statusCode = 200
          res.setHeader(
            'Content-Type',
            upstream.headers.get('content-type') || 'audio/mpeg',
          )
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Cache-Control', 'public, max-age=3600')
          res.end(Buffer.from(await upstream.arrayBuffer()))
          return
        }

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
