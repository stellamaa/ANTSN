import { useCallback, useEffect, useState } from 'react'
import {
  getSpotifyToken,
  getStoredToken,
  handleSpotifyCallback,
  isSpotifyConfigured,
  logoutSpotify,
  startSpotifyLogin,
} from '../services/spotify/auth'
import { initSpotifyPlayer, isSpotifyPlaybackSupported, destroySpotifyPlayer } from '../services/spotify/playback'

export function useSpotifyAuth() {
  const [isConfigured] = useState(isSpotifyConfigured)
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getStoredToken()))
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState(
    isSpotifyPlaybackSupported()
      ? null
      : 'Open in Chrome or Safari for full Spotify playback',
  )
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const handled = await handleSpotifyCallback()
        if (handled) {
          setIsAuthenticated(true)
          return
        }

        const token = await getSpotifyToken()
        if (token) setIsAuthenticated(true)
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setIsAuthenticated(Boolean(getStoredToken()))
        }
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setIsPlayerReady(false)
      setPlayerError(
        isSpotifyPlaybackSupported()
          ? null
          : 'Open in Chrome or Safari for full Spotify playback',
      )
      return
    }

    if (!isSpotifyPlaybackSupported()) {
      setPlayerError('Open in Chrome or Safari for full Spotify playback')
      return
    }

    let cancelled = false

    initSpotifyPlayer({
      onReady: () => {
        if (!cancelled) {
          setIsPlayerReady(true)
          setPlayerError(null)
        }
      },
      onError: (message) => {
        if (!cancelled) {
          setPlayerError(message)
          setIsPlayerReady(false)
        }
      },
    }).catch((err) => {
      if (!cancelled) {
        setPlayerError(err.message)
        setIsPlayerReady(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const login = useCallback(async () => {
    setError(null)
    await startSpotifyLogin()
  }, [])

  const logout = useCallback(async () => {
    await logoutSpotify()
    destroySpotifyPlayer()
    setIsAuthenticated(false)
    setIsPlayerReady(false)
    setPlayerError(null)
  }, [])

  return {
    isConfigured,
    isAuthenticated,
    isPlayerReady,
    playerError,
    error,
    login,
    logout,
  }
}
