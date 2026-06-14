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
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-4 sm:px-8">
      <div className="w-full max-w-2xl flex flex-col items-center pointer-events-auto">
        <div className="w-full mb-4 max-h-[35vh] overflow-y-auto flex flex-col items-center gap-3 px-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`text-center font-minimal text-xs sm:text-sm leading-relaxed max-w-lg ${
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
            <div className="text-antsn-grey text-xs font-minimal animate-pulse">
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
                  className="pointer-events-none absolute left-1/2 bottom-2 -translate-x-1/2 w-2 h-4 sm:h-[1.125rem] bg-antsn-white/80 animate-blink"
                  aria-hidden="true"
                />
                <span className="pointer-events-none absolute left-1/2 bottom-2 translate-x-1.5 text-antsn-grey/40 text-sm sm:text-base font-minimal whitespace-nowrap">
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
              className="w-full bg-transparent text-center text-antsn-white text-sm sm:text-base font-minimal placeholder:text-antsn-grey/40 disabled:opacity-40 caret-antsn-white outline-none"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </form>
      </div>
    </div>
  )
}
