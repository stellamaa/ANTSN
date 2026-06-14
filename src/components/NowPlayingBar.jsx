import { volumeToPercent, truncate } from '../utils/helpers'

function PlayPauseIcon({ playing }) {
  if (playing) {
    return (
      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" className="sm:w-[10px] sm:h-[10px]">
        <rect x="1" y="0" width="3" height="10" />
        <rect x="6" y="0" width="3" height="10" />
      </svg>
    )
  }

  return (
    <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" className="sm:w-[10px] sm:h-[10px]">
      <polygon points="1,0 10,5 1,10" />
    </svg>
  )
}

function TrackItem({ track, onToggle, onVolumeChange }) {
  const sourceLabel =
    track.source === 'spotify'
      ? track.playbackMode === 'preview'
        ? 'sp·'
        : 'sp'
      : 'yt'

  const trackNumber = track.id + 1

  return (
    <div className="flex items-center gap-1.5 sm:gap-3 text-[9px] sm:text-xs font-minimal text-antsn-white/80 shrink-0">
      <span className="text-antsn-grey tabular-nums w-3">{trackNumber}</span>
      <span className="text-antsn-grey/50 w-3 sm:w-4 text-[8px] sm:text-[9px]">{sourceLabel}</span>
      <button
        type="button"
        onClick={() => onToggle(trackNumber)}
        className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center border border-antsn-line/60 hover:border-antsn-white/50 transition-colors rounded-full sm:rounded-none"
        aria-label={track.playing ? `Pause track ${trackNumber}` : `Play track ${trackNumber}`}
      >
        <PlayPauseIcon playing={track.playing} />
      </button>
      <span className="hidden sm:inline max-w-[120px] md:max-w-[180px] truncate">
        {truncate(track.title, 28)}
      </span>
      <span className="sm:hidden max-w-[48px] truncate">{truncate(track.title, 10)}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={volumeToPercent(track.volume)}
        onChange={(e) => onVolumeChange(trackNumber, Number(e.target.value) / 100)}
        className="volume-slider w-10 sm:w-16"
        aria-label={`Volume for track ${trackNumber}`}
      />
      <span className="tabular-nums text-antsn-grey w-6 sm:w-7 text-right text-[8px] sm:text-[10px]">
        {volumeToPercent(track.volume)}%
      </span>
    </div>
  )
}

export default function NowPlayingBar({ activeTracks, onToggle, onVolumeChange, spotify }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 px-3 sm:px-6 py-3 sm:py-4 flex items-start justify-between gap-2 sm:gap-4 pointer-events-auto">
      <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0 shrink-0">
        <span className="font-dotmatrix text-xs sm:text-base tracking-[0.25em] sm:tracking-[0.3em] text-antsn-white">
          ANTSN
        </span>
        <span className="text-[9px] sm:text-xs text-antsn-grey font-minimal tracking-widest uppercase">
          now playing
        </span>
        {spotify?.isAuthenticated && (
          <span className="text-[8px] sm:text-[9px] text-antsn-grey/50 font-minimal tracking-wider">
            spotify ·{' '}
            {spotify.isPlayerReady
              ? 'premium'
              : spotify.playerError
                ? 'preview only'
                : 'connecting...'}
          </span>
        )}
      </div>

      <div className="flex flex-col items-end gap-1.5 min-w-0 max-w-[62vw] sm:max-w-none">
        {activeTracks.length === 0 ? (
          <span className="text-[9px] sm:text-xs text-antsn-grey/60 font-minimal">
            no tracks
          </span>
        ) : (
          <div className="flex flex-col items-end gap-1 overflow-x-auto max-w-full">
            {activeTracks.map((track) => (
              <TrackItem
                key={track.id}
                track={track}
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
