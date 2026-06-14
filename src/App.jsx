import { useCallback, useState } from 'react'
import HalftoneBackground from './components/HalftoneBackground'
import ChatInterface from './components/ChatInterface'
import NowPlayingBar from './components/NowPlayingBar'
import SpotifyLogin from './components/SpotifyLogin'
import { useSpotifyAuth } from './hooks/useSpotifyAuth'
import { useTrackManager } from './hooks/useTrackManager'
import { queryLLM } from './services/llm'

let messageId = 0
function createMessage(role, text) {
  return { id: ++messageId, role, text }
}

export default function App() {
  const [messages, setMessages] = useState([
    createMessage(
      'assistant',
      'prompt me. try "play rain on youtube" or "play lofi beats on spotify". connect spotify first for spotify tracks.',
    ),
  ])
  const [isLoading, setIsLoading] = useState(false)

  const spotify = useSpotifyAuth()

  const {
    tracks,
    activeTracks,
    setTrackVolume,
    toggleTrack,
    executeActions,
  } = useTrackManager({ spotify })

  const addMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, createMessage(role, text)])
  }, [])

  const handleSubmit = useCallback(
    async (text) => {
      addMessage('user', text)
      setIsLoading(true)

      try {
        const context = tracks
          .filter((t) => t.source && t.mediaId)
          .map((t) => ({
            slot: t.id + 1,
            title: t.title,
            source: t.source,
            volume: t.volume,
            playing: t.playing,
            playbackMode: t.playbackMode,
          }))

        const response = await queryLLM(text, context, {
          spotifyConnected: spotify.isAuthenticated,
        })

        if (response.message) {
          addMessage('assistant', response.message)
        }

        if (response.actions?.length) {
          const results = await executeActions(response.actions)
          const failures = results.filter((r) => !r.ok)

          if (failures.length) {
            addMessage(
              'error',
              failures.map((f) => f.error).join(' · '),
            )
          }
        }
      } catch (err) {
        addMessage('error', err.message)
      } finally {
        setIsLoading(false)
      }
    },
    [addMessage, executeActions, spotify.isAuthenticated, tracks],
  )

  return (
    <div className="relative h-full w-full overflow-hidden">
      <HalftoneBackground activeTracks={activeTracks} />

      <NowPlayingBar
        activeTracks={activeTracks}
        onToggle={toggleTrack}
        onVolumeChange={setTrackVolume}
        spotify={spotify}
      />

      <SpotifyLogin spotify={spotify} />

      <ChatInterface
        messages={messages}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />

      <div className="yt-player-host" aria-hidden="true">
        {tracks.map((track) => (
          <div
            key={track.id}
            id={track.containerId}
            className="yt-player-slot"
            style={{ top: track.id * 200 }}
          />
        ))}
      </div>
    </div>
  )
}
