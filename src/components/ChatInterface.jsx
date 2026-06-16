import { useCallback, useEffect, useRef, useState } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'

function MicIcon({ active }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={active ? 'scale-110' : ''}
    >
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 19v3" />
    </svg>
  )
}

export default function ChatInterface({ messages, onSubmit, isLoading }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const submitText = useCallback(
    (text) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return false
      onSubmit(trimmed)
      setInput('')
      requestAnimationFrame(() => inputRef.current?.focus())
      return true
    },
    [isLoading, onSubmit],
  )

  const handleFinalSpeech = useCallback(
    (text) => {
      submitText(text)
    },
    [submitText],
  )

  const handleInterimSpeech = useCallback((text) => {
    setInput(text)
  }, [])

  const { supported, listening, error, toggle, clearError } = useSpeechRecognition({
    onFinal: handleFinalSpeech,
    onInterim: handleInterimSpeech,
    disabled: isLoading,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    submitText(input)
  }

  const showCursor = !input && !isLoading && !listening

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
      <div className="w-[90vw] flex flex-col items-center pointer-events-auto">
        <div className="w-full mb-4 max-h-[32vh] sm:max-h-[35vh] overflow-y-auto flex flex-col items-center gap-2 sm:gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`w-full text-center font-script font-normal text-[11px] sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-antsn-white/90'
                  : msg.role === 'error'
                    ? 'text-antsn-grey'
                    : 'text-antsn-white/70'
              }`}
            >
              {msg.role === 'user' && (
                <span className="text-antsn-grey/50 mr-2">›</span>
              )}
              {msg.text}
            </div>
          ))}
          {isLoading && (
            <div className="text-antsn-grey text-[11px] sm:text-xs font-script font-normal animate-pulse">
              thinking...
            </div>
          )}
          {listening && (
            <div className="text-antsn-grey text-[11px] sm:text-xs font-script font-normal animate-pulse">
              listening...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="w-full">
          <div className="relative flex items-end gap-3 border-b border-antsn-line pb-2">
            <div className="relative flex-1 min-w-0">
              {showCursor && (
                <>
                  <span
                    className="pointer-events-none absolute left-1/2 bottom-0 -translate-x-1/2 w-1.5 h-3.5 sm:w-2 sm:h-4 bg-antsn-white/80 animate-blink"
                    aria-hidden="true"
                  />
                  <span className="pointer-events-none absolute left-1/2 bottom-0 translate-x-1.5 text-antsn-grey/40 text-[13px] sm:text-sm font-script font-normal whitespace-nowrap max-w-[70vw] truncate">
                    describe what you want to hear...
                  </span>
                </>
              )}
              <input
                ref={inputRef}
                type="text"
                name="prompt"
                value={input}
                onChange={(e) => {
                  clearError()
                  setInput(e.target.value)
                }}
                placeholder={
                  listening
                    ? 'listening...'
                    : showCursor
                      ? ''
                      : 'describe what you want to hear...'
                }
                className="chat-input w-full bg-transparent text-center text-antsn-white text-base font-minimal placeholder:text-antsn-grey/40 caret-antsn-white outline-none pr-1"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {supported && (
              <button
                type="button"
                onClick={toggle}
                disabled={isLoading}
                aria-label={listening ? 'Stop listening' : 'Speak prompt'}
                aria-pressed={listening}
                className={`shrink-0 mb-0.5 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border transition-colors ${
                  listening
                    ? 'border-antsn-white/70 text-antsn-white animate-pulse'
                    : 'border-antsn-line/60 text-antsn-grey hover:border-antsn-white/50 hover:text-antsn-white'
                } disabled:opacity-40 disabled:pointer-events-none`}
              >
                <MicIcon active={listening} />
              </button>
            )}
          </div>

          {error && (
            <p className="mt-2 text-center text-[10px] sm:text-[11px] text-antsn-grey font-minimal">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
