import { volumeToPercent, truncate } from '../utils/helpers'

function PlayPauseIcon({ playing }) {
  if (playing) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
        <rect x="1" y="0" width="3" height="10" />
        <rect x="6" y="0" width="3" height="10" />
      </svg>
    )
  }

  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <polygon points="1,0 10,5 1,10" />
    </svg>
  )
}

function TrackItem({ track, index, onToggle, onVolumeChange }) {
  const sourceLabel =
    track.source === 'spotify'
      ? track.playbackMode === 'preview'
        ? 'sp·'
        : 'sp'
      : 'yt'

  return (
    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-minimal text-antsn-white/80 shrink-0">
      <span className="text-antsn-grey tabular-nums w-3">{index + 1}</span>
      <span className="text-antsn-grey/50 w-4 text-[9px]">{sourceLabel}</span>
      <button
        type="button"
        onClick={() => onToggle(index + 1)}
        className="w-5 h-5 flex items-center justify-center border border-antsn-line/60 hover:border-antsn-white/50 transition-colors"
        aria-label={track.playing ? `Pause track ${index + 1}` : `Play track ${index + 1}`}
      >
        <PlayPauseIcon playing={track.playing} />
      </button>
      <span className="hidden sm:inline max-w-[120px] md:max-w-[180px] truncate">
        {truncate(track.title, 28)}
      </span>
      <span className="sm:hidden max-w-[60px] truncate">{truncate(track.title, 12)}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={volumeToPercent(track.volume)}
        onChange={(e) => onVolumeChange(index + 1, Number(e.target.value) / 100)}
        className="w-12 sm:w-16 h-px appearance-none bg-antsn-line accent-antsn-white cursor-pointer"
        aria-label={`Volume for track ${index + 1}`}
      />
      <span className="tabular-nums text-antsn-grey w-7 text-right">
        {volumeToPercent(track.volume)}%
      </span>
    </div>
  )
}

export default function NowPlayingBar({ activeTracks, onToggle, onVolumeChange, spotify }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 px-4 sm:px-6 py-4 flex items-start justify-between gap-4 pointer-events-auto">
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-dotmatrix text-sm sm:text-base tracking-[0.3em] text-antsn-white">
          ANTSN
        </span>
        <span className="text-[10px] sm:text-xs text-antsn-grey font-minimal tracking-widest uppercase">
          now playing
        </span>
        {spotify?.isAuthenticated && (
          <span className="text-[9px] text-antsn-grey/50 font-minimal tracking-wider">
            spotify ·{' '}
            {spotify.isPlayerReady
              ? 'premium'
              : spotify.playerError
                ? 'preview only'
                : 'connecting...'}
          </span>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 min-w-0 max-w-[70vw] sm:max-w-none">
        {activeTracks.length === 0 ? (
          <span className="text-[10px] sm:text-xs text-antsn-grey/60 font-minimal">
            no tracks
          </span>
        ) : (
          <div className="flex flex-col items-end gap-1.5 overflow-x-auto max-w-full">
            {activeTracks.map((track) => (
              <TrackItem
                key={track.id}
                track={track}
                index={track.id}
                onToggle={onToggle}
                onVolumeChange={onVolumeChange}
              />
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
