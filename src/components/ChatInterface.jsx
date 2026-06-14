import { useEffect, useRef, useState } from 'react'

export default function ChatInterface({ messages, onSubmit, isLoading }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSubmit(trimmed)
    setInput('')
  }

  const showCursor = !input && !isLoading

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
      <div className="w-[90vw] flex flex-col items-center pointer-events-auto">
        <div className="w-full mb-4 max-h-[32vh] sm:max-h-[35vh] overflow-y-auto flex flex-col items-center gap-2 sm:gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`w-full text-center font-minimal text-[11px] sm:text-sm leading-relaxed ${
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
            <div className="text-antsn-grey text-[11px] sm:text-xs font-minimal animate-pulse">
              thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="w-full">
          <div className="relative border-b border-antsn-line pb-2">
            {showCursor && (
              <>
                <span
                  className="pointer-events-none absolute left-1/2 bottom-2 -translate-x-1/2 w-1.5 h-3.5 sm:w-2 sm:h-4 bg-antsn-white/80 animate-blink"
                  aria-hidden="true"
                />
                <span className="pointer-events-none absolute left-1/2 bottom-2 translate-x-1.5 text-antsn-grey/40 text-base sm:text-base font-minimal whitespace-nowrap max-w-[80vw] truncate">
                  describe what you want to hear...
                </span>
              </>
            )}
            <input
              ref={inputRef}
              type="text"
              name="prompt"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={showCursor ? '' : 'describe what you want to hear...'}
              disabled={isLoading}
              className="chat-input w-full bg-transparent text-center text-antsn-white text-base font-minimal placeholder:text-antsn-grey/40 disabled:opacity-40 caret-antsn-white outline-none"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </form>
      </div>
    </div>
  )
}
