import { normalizeActions } from '../utils/volume'

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY

const SYSTEM_PROMPT = `You are ANTSN, a minimalist audio mixing assistant. Users describe what they want to hear and how to control playback across up to 4 simultaneous tracks.

Respond ONLY with valid JSON — no markdown, no explanation outside the JSON.

Schema:
{
  "message": "brief human reply (1-2 sentences, lowercase, minimal)",
  "actions": [
    { "type": "play", "query": "search terms", "source": "youtube" | "spotify", "volume": 0.0-1.0, "full": false },
    { "type": "pause", "track": 1-4 },
    { "type": "resume", "track": 1-4 },
    { "type": "set_volume", "track": 1-4, "volume": 0.0-1.0 },
    { "type": "adjust_volume", "track": 1-4, "delta": -1.0 to 1.0 },
    { "type": "fade_out", "track": 1-4, "seconds": number },
    { "type": "fade_out_before_end", "track": 1-4, "seconds": number },
    { "type": "stop", "track": 1-4 },
    { "type": "stop_all" }
  ]
}

Rules:
- track numbers are SLOT numbers from the context (not list position) — e.g. if context shows "2. title", use track: 2
- volume is 0.0 to 1.0 (or 0–100, both accepted)
- for relative changes ("turn up", "louder", "quieter"), use adjust_volume with delta (e.g. +0.15 louder, -0.15 quieter)
- for absolute target ("set to 50%"), use set_volume
- for new audio, use "play" with source "youtube" or "spotify"
- default source is youtube unless user mentions spotify
- spotify requires user to be logged in — if not connected, say so in message
- one full-length spotify track at a time (premium); additional simultaneous spotify layers use 30s previews (marked sp· in ui)
- set "full": true on play action when user wants a full spotify song and no other full spotify track is playing
- combine multiple actions when needed (e.g. play rain on youtube + piano on spotify)
- if user asks to fade out before a song ends, use fade_out_before_end
- if only one track is playing and user says "turn it up" without a number, use that track's slot
- keep message terse and calm`

export async function queryLLM(userMessage, tracksContext, options = {}) {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'your_groq_api_key_here') {
    return fallbackParser(userMessage, tracksContext, options)
  }

  const spotifyStatus = options.spotifyConnected
    ? 'Spotify: connected (premium playback available)'
    : 'Spotify: not connected'

  const context = tracksContext.length
    ? `Current tracks (slot = track number for actions):\n${tracksContext.map((t) => `${t.slot}. [${t.source}${t.playbackMode === 'preview' ? ' preview' : ''}] "${t.title}" — ${Math.round(t.volume * 100)}% — ${t.playing ? 'playing' : 'paused'}`).join('\n')}`
    : 'No tracks currently playing.'

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${spotifyStatus}\n${context}\n\nUser: ${userMessage}` },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error?.message || 'LLM request failed')
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  try {
    const parsed = JSON.parse(content)
    return { ...parsed, actions: normalizeActions(parsed.actions) }
  } catch {
    return fallbackParser(userMessage, tracksContext, options)
  }
}

function detectSource(message) {
  const lower = message.toLowerCase()
  if (lower.includes('spotify')) return 'spotify'
  if (lower.includes('youtube') || lower.includes('yt')) return 'youtube'
  return 'youtube'
}

function cleanPlayQuery(message) {
  return message
    .replace(/\b(on |from )?spotify\b/gi, '')
    .replace(/\b(on |from )?youtube\b/gi, '')
    .replace(/\b(on |from )?yt\b/gi, '')
    .trim()
}

function fallbackParser(message, tracks, options = {}) {
  const lower = message.toLowerCase()
  const actions = []

  const playMatch = lower.match(/play\s+(.+)/)
  if (playMatch && !lower.includes('track')) {
    const source = detectSource(message)
    if (source === 'spotify' && !options.spotifyConnected) {
      return {
        message: 'connect spotify first (bottom left).',
        actions: [],
      }
    }
    actions.push({
      type: 'play',
      query: cleanPlayQuery(playMatch[1]),
      volume: 0.7,
      source,
      full: source === 'spotify' && lower.includes('full'),
    })
  }

  const volumeMatch = lower.match(/(?:track\s*)?(\d)\s*(?:volume|vol)\s*(?:to\s*)?(\d+)/)
  if (volumeMatch) {
    actions.push({
      type: 'set_volume',
      track: Number(volumeMatch[1]),
      volume: Number(volumeMatch[2]) / 100,
    })
  }

  if (
    !volumeMatch &&
    (lower.includes('turn up') ||
      lower.includes('louder') ||
      lower.includes('volume up') ||
      lower.includes('increase volume'))
  ) {
    actions.push({
      type: 'adjust_volume',
      track: resolveTrackSlot(message, tracks),
      delta: 0.2,
    })
  }

  if (
    lower.includes('turn down') ||
    lower.includes('quieter') ||
    lower.includes('volume down') ||
    lower.includes('decrease volume')
  ) {
    actions.push({
      type: 'adjust_volume',
      track: resolveTrackSlot(message, tracks),
      delta: -0.2,
    })
  }

  const fadeMatch = lower.match(/fade\s*(?:out\s*)?(?:track\s*)?(\d+)\s*(?:over\s*)?(\d+)\s*(?:sec|second)/)
  if (fadeMatch) {
    actions.push({
      type: 'fade_out',
      track: Number(fadeMatch[1]),
      seconds: Number(fadeMatch[2]),
    })
  }

  const pauseMatch = lower.match(/pause\s*(?:track\s*)?(\d+)/)
  if (pauseMatch) {
    actions.push({ type: 'pause', track: Number(pauseMatch[1]) })
  }

  const resumeMatch = lower.match(/(?:resume|play)\s*track\s*(\d+)/)
  if (resumeMatch && !playMatch) {
    actions.push({ type: 'resume', track: Number(resumeMatch[1]) })
  }

  if (lower.includes('stop all')) {
    actions.push({ type: 'stop_all' })
  }

  return {
    message: actions.length
      ? 'processing.'
      : 'try: "play lofi rain" or "play jazz on spotify"',
    actions: normalizeActions(actions),
  }
}

function resolveTrackSlot(message, tracks) {
  const trackMatch = message.match(/track\s*(\d)/i)
  if (trackMatch) return Number(trackMatch[1])
  if (tracks.length === 1) return tracks[0].slot
  return tracks[0]?.slot ?? 1
}
