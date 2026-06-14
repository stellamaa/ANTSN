import { useCallback, useEffect, useRef, useState } from 'react'
import { searchSpotify } from '../services/spotify/api'
import {
  clearSpotifySdkSlot,
  createPreviewPlayer,
  getSpotifySdkSlot,
  playSpotifyFull,
} from '../services/spotify/playback'
import {
  createYouTubePlayer,
  loadYouTubeAPI,
  searchYouTube,
  YT_STATE,
} from '../services/youtube'
import { fadeVolume } from '../utils/fade'
import { MAX_TRACKS } from '../utils/helpers'
import { normalizeActions, normalizeVolume } from '../utils/volume'

function emptySlot(id) {
  return {
    id,
    source: null,
    mediaId: null,
    title: null,
    artist: null,
    channel: null,
    playing: false,
    volume: 0.7,
    playbackMode: null,
    previewUrl: null,
    containerId: `yt-player-${id}`,
  }
}

function isSlotActive(track) {
  return Boolean(track?.source && track?.mediaId)
}

export function useTrackManager({ onActivityChange, spotify }) {
  const [tracks, setTracks] = useState(() =>
    Array.from({ length: MAX_TRACKS }, (_, i) => emptySlot(i)),
  )
  const [apiReady, setApiReady] = useState(false)
  const tracksRef = useRef(tracks)
  const playersRef = useRef({})
  const fadeIntervalsRef = useRef({})

  useEffect(() => {
    tracksRef.current = tracks
    const active = tracks.some((t) => t.playing)
    onActivityChange?.(active)
  }, [tracks, onActivityChange])

  useEffect(() => {
    loadYouTubeAPI().then(() => setApiReady(true))
  }, [])

  const updateTrack = useCallback((id, patch) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    )
  }, [])

  const findSlot = useCallback(() => {
    const current = tracksRef.current
    const empty = current.find((t) => !isSlotActive(t))
    if (empty) return empty.id
    return current.reduce((lowest, t) =>
      t.volume < lowest.volume ? t : lowest,
    ).id
  }, [])

  const clearFadeInterval = useCallback((id) => {
    if (fadeIntervalsRef.current[id]) {
      clearInterval(fadeIntervalsRef.current[id])
      delete fadeIntervalsRef.current[id]
    }
  }, [])

  const destroyPlayer = useCallback(
    (track) => {
      clearFadeInterval(track.id)
      const adapter = playersRef.current[track.id]
      adapter?.destroy?.()
      delete playersRef.current[track.id]

      if (track.source === 'spotify' && track.playbackMode === 'full') {
        clearSpotifySdkSlot(track.id)
      }

      try {
        track.player?.destroy?.()
      } catch {
        /* youtube player may already be gone */
      }
    },
    [clearFadeInterval],
  )

  const attachYouTube = useCallback(
    async (slotId, video, volume = 0.7) => {
      if (!apiReady) throw new Error('YouTube API not ready')

      const slot = tracksRef.current.find((t) => t.id === slotId)
      if (isSlotActive(slot)) destroyPlayer(slot)

      return new Promise((resolve, reject) => {
        let settled = false
        const timer = setTimeout(() => {
          if (!settled) reject(new Error('Player load timeout'))
        }, 15000)

        createYouTubePlayer(slot.containerId, video.videoId, {
          volume: Math.round(volume * 100),
          onReady: (yt) => {
            settled = true
            clearTimeout(timer)

            const adapter = {
              type: 'youtube',
              setVolume: (v) => yt.setVolume(Math.round(v * 100)),
              play: () => yt.playVideo(),
              pause: () => yt.pauseVideo(),
              resume: () => yt.playVideo(),
              getCurrentTime: () => yt.getCurrentTime(),
              getDuration: () => yt.getDuration(),
              isPlaying: () => yt.getPlayerState() === YT_STATE.PLAYING,
              destroy: () => yt.destroy(),
            }

            playersRef.current[slotId] = adapter
            updateTrack(slotId, {
              source: 'youtube',
              mediaId: video.videoId,
              title: video.title,
              channel: video.channel,
              artist: null,
              playing: true,
              volume,
              playbackMode: 'full',
              previewUrl: null,
              player: yt,
            })
            resolve(adapter)
          },
          onStateChange: (state) => {
            if (state === YT_STATE.PLAYING) {
              updateTrack(slotId, { playing: true })
            } else if (state === YT_STATE.PAUSED) {
              updateTrack(slotId, { playing: false })
            } else if (state === YT_STATE.ENDED) {
              updateTrack(slotId, { playing: false })
            }
          },
        })
      })
    },
    [apiReady, destroyPlayer, updateTrack],
  )

  const attachSpotify = useCallback(
    async (slotId, track, volume = 0.7, preferFull = false) => {
      if (!spotify?.isAuthenticated) {
        throw new Error('Log in to Spotify first')
      }

      const slot = tracksRef.current.find((t) => t.id === slotId)
      if (isSlotActive(slot)) destroyPlayer(slot)

      const sdkSlot = getSpotifySdkSlot()
      const canUseFull =
        preferFull &&
        spotify.isPlayerReady &&
        (sdkSlot === null || sdkSlot === slotId)

      let adapter
      let playbackMode = 'preview'

      if (canUseFull) {
        adapter = await playSpotifyFull(slotId, track, volume)
        playbackMode = 'full'
      } else if (track.previewUrl) {
        adapter = createPreviewPlayer(track.previewUrl, volume)
        await adapter.play()
      } else if (spotify.isPlayerReady && sdkSlot === null) {
        adapter = await playSpotifyFull(slotId, track, volume)
        playbackMode = 'full'
      } else {
        throw new Error(
          `"${track.title}" has no preview — try another track or stop a full spotify track first`,
        )
      }

      playersRef.current[slotId] = adapter
      updateTrack(slotId, {
        source: 'spotify',
        mediaId: track.id,
        title: track.title,
        artist: track.artist,
        channel: track.artist,
        playing: true,
        volume,
        playbackMode,
        previewUrl: track.previewUrl,
        player: null,
      })

      return { slotId: slotId + 1, ...track, playbackMode }
    },
    [destroyPlayer, spotify, updateTrack],
  )

  const playQuery = useCallback(
    async (query, volume = 0.7, source = 'youtube', preferFull = false) => {
      const slotId = findSlot()

      if (source === 'spotify') {
        const results = await searchSpotify(query, 5)
        const track =
          results.find((r) => (preferFull ? true : r.previewUrl)) || results[0]
        if (!track) throw new Error(`No Spotify results for "${query}"`)
        return attachSpotify(slotId, track, volume, preferFull)
      }

      const results = await searchYouTube(query, 1)
      if (!results.length) throw new Error(`No YouTube results for "${query}"`)
      await attachYouTube(slotId, results[0], volume)
      return { slotId: slotId + 1, ...results[0] }
    },
    [attachSpotify, attachYouTube, findSlot],
  )

  const getSlot = useCallback((trackIndex) => {
    const slotId = trackIndex - 1
    if (slotId < 0 || slotId >= MAX_TRACKS) return null
    return tracksRef.current[slotId]
  }, [])

  const applyVolume = useCallback(
    (trackIndex, volume) => {
      const slot = getSlot(trackIndex)
      const adapter = playersRef.current[slot?.id]
      if (!isSlotActive(slot) || !adapter) return false

      const vol = normalizeVolume(volume)
      if (vol == null) return false

      adapter.setVolume(vol)
      updateTrack(slot.id, { volume: vol })
      return true
    },
    [getSlot, updateTrack],
  )

  const setTrackVolume = useCallback(
    (trackIndex, volume) => applyVolume(trackIndex, volume),
    [applyVolume],
  )

  const adjustTrackVolume = useCallback(
    (trackIndex, delta) => {
      const slot = getSlot(trackIndex)
      if (!isSlotActive(slot)) return false
      return applyVolume(trackIndex, slot.volume + delta)
    },
    [applyVolume, getSlot],
  )

  const toggleTrack = useCallback(
    async (trackIndex) => {
      const slot = getSlot(trackIndex)
      const adapter = playersRef.current[slot?.id]
      if (!adapter) return

      const playing =
        typeof adapter.isPlaying === 'function'
          ? await adapter.isPlaying()
          : adapter.isPlaying?.()

      if (playing) {
        adapter.pause()
        updateTrack(slot.id, { playing: false })
      } else {
        await adapter.resume?.()
        updateTrack(slot.id, { playing: true })
      }
    },
    [getSlot, updateTrack],
  )

  const pauseTrack = useCallback(
    (trackIndex) => {
      const slot = getSlot(trackIndex)
      const adapter = playersRef.current[slot?.id]
      if (!adapter) return
      adapter.pause()
      updateTrack(slot.id, { playing: false })
    },
    [getSlot, updateTrack],
  )

  const resumeTrack = useCallback(
    async (trackIndex) => {
      const slot = getSlot(trackIndex)
      const adapter = playersRef.current[slot?.id]
      if (!adapter) return
      await adapter.resume?.()
      updateTrack(slot.id, { playing: true })
    },
    [getSlot, updateTrack],
  )

  const fadeOutTrack = useCallback(
    async (trackIndex, seconds) => {
      const slot = getSlot(trackIndex)
      const adapter = playersRef.current[slot?.id]
      if (!adapter) return

      const from = slot.volume
      await fadeVolume(null, from, 0, seconds * 1000, (v) => {
        adapter.setVolume(v)
        updateTrack(slot.id, { volume: v })
      })
      adapter.pause()
      updateTrack(slot.id, { playing: false })
    },
    [getSlot, updateTrack],
  )

  const fadeOutBeforeEnd = useCallback(
    (trackIndex, fadeSeconds) => {
      const slot = getSlot(trackIndex)
      const adapter = playersRef.current[slot?.id]
      if (!adapter) return

      clearFadeInterval(slot.id)

      fadeIntervalsRef.current[slot.id] = setInterval(async () => {
        const current =
          typeof adapter.getCurrentTime === 'function'
            ? await adapter.getCurrentTime()
            : adapter.getCurrentTime()
        const duration =
          typeof adapter.getDuration === 'function'
            ? await adapter.getDuration()
            : adapter.getDuration()

        if (!duration || duration <= 0) return
        const remaining = duration - current
        if (remaining <= fadeSeconds && remaining > 0) {
          clearFadeInterval(slot.id)
          updateTrack(slot.id, { playing: false })
          await fadeVolume(
            null,
            tracksRef.current[slot.id]?.volume ?? slot.volume,
            0,
            remaining * 1000,
            (v) => {
              adapter.setVolume(v)
              updateTrack(slot.id, { volume: v })
            },
          )
          adapter.pause()
        }
      }, 500)
    },
    [clearFadeInterval, getSlot, updateTrack],
  )

  const stopTrack = useCallback(
    (trackIndex) => {
      const slot = getSlot(trackIndex)
      if (!slot) return
      destroyPlayer(slot)
      updateTrack(slot.id, emptySlot(slot.id))
    },
    [destroyPlayer, getSlot, updateTrack],
  )

  const stopAll = useCallback(() => {
    tracksRef.current.forEach((slot) => {
      if (isSlotActive(slot)) destroyPlayer(slot)
    })
    setTracks(Array.from({ length: MAX_TRACKS }, (_, i) => emptySlot(i)))
  }, [destroyPlayer])

  const executeActions = useCallback(
    async (actions) => {
      const results = []
      const normalized = normalizeActions(actions)

      for (const action of normalized) {
        try {
          switch (action.type) {
            case 'play': {
              const played = await playQuery(
                action.query,
                action.volume ?? 0.7,
                action.source ?? 'youtube',
                action.full ?? false,
              )
              results.push({ ok: true, action, played })
              break
            }
            case 'set_volume': {
              const ok = setTrackVolume(action.track, action.volume)
              results.push(
                ok
                  ? { ok: true, action }
                  : { ok: false, action, error: `could not set volume on track ${action.track}` },
              )
              break
            }
            case 'adjust_volume': {
              const ok = adjustTrackVolume(action.track, action.delta ?? 0.15)
              results.push(
                ok
                  ? { ok: true, action }
                  : { ok: false, action, error: `could not adjust volume on track ${action.track}` },
              )
              break
            }
            case 'pause':
              pauseTrack(action.track)
              results.push({ ok: true, action })
              break
            case 'resume':
              await resumeTrack(action.track)
              results.push({ ok: true, action })
              break
            case 'fade_out':
              await fadeOutTrack(action.track, action.seconds ?? 5)
              results.push({ ok: true, action })
              break
            case 'fade_out_before_end':
              fadeOutBeforeEnd(action.track, action.seconds ?? 10)
              results.push({ ok: true, action })
              break
            case 'stop':
              stopTrack(action.track)
              results.push({ ok: true, action })
              break
            case 'stop_all':
              stopAll()
              results.push({ ok: true, action })
              break
            default:
              results.push({ ok: false, action, error: 'unknown action' })
          }
        } catch (err) {
          results.push({ ok: false, action, error: err.message })
        }
      }

      return results
    },
    [
      adjustTrackVolume,
      fadeOutBeforeEnd,
      fadeOutTrack,
      pauseTrack,
      playQuery,
      resumeTrack,
      setTrackVolume,
      stopAll,
      stopTrack,
    ],
  )

  const activeTracks = tracks.filter(isSlotActive)

  return {
    tracks,
    activeTracks,
    apiReady,
    playQuery,
    setTrackVolume,
    adjustTrackVolume,
    toggleTrack,
    pauseTrack,
    resumeTrack,
    fadeOutTrack,
    fadeOutBeforeEnd,
    stopTrack,
    stopAll,
    executeActions,
  }
}
