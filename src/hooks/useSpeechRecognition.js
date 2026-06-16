import { useCallback, useEffect, useRef, useState } from 'react'
import { loadYouTubeAPI } from '../services/youtube'
import { hapticListeningStart, hapticListeningStop } from '../utils/haptics'

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function useSpeechRecognition({ onFinal, onInterim, disabled = false, lang = 'en-US' }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')

  const supported = Boolean(getSpeechRecognition())

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (disabled) return

    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser')
      return
    }

    setError(null)
    transcriptRef.current = ''
    loadYouTubeAPI().catch(() => {})

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      hapticListeningStart()
    }

    recognition.onresult = (event) => {
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) transcriptRef.current += text
        else interim += text
      }

      const draft = (transcriptRef.current + interim).trim()
      if (draft) onInterim?.(draft)
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      const messages = {
        'not-allowed': 'Microphone access denied',
        'service-not-allowed': 'Speech recognition not allowed',
        network: 'Network error — try again',
      }
      setError(messages[event.error] || 'Could not recognize speech')
    }

    recognition.onend = () => {
      setListening(false)
      hapticListeningStop()
      const text = transcriptRef.current.trim()
      transcriptRef.current = ''
      if (text) onFinal?.(text)
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      setError('Could not start microphone')
      setListening(false)
    }
  }, [disabled, lang, onFinal, onInterim])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => {
    if (disabled && listening) stop()
  }, [disabled, listening, stop])

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  return { supported, listening, error, start, stop, toggle, clearError: () => setError(null) }
}
