export default function SpotifyLogin({ spotify }) {
  if (!spotify.isConfigured) return null

  return (
    <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-30 pointer-events-auto">
      <button
        type="button"
        onClick={spotify.isAuthenticated ? spotify.logout : spotify.login}
        className="text-[10px] sm:text-xs font-minimal text-antsn-grey hover:text-antsn-white transition-colors tracking-widest uppercase border border-antsn-line/60 px-3 py-1.5"
      >
        {spotify.isAuthenticated ? 'disconnect spotify' : 'connect spotify'}
      </button>
      {(spotify.isAuthenticated && (spotify.error || spotify.playerError)) && (
        <p className="mt-1 text-[10px] text-antsn-grey/70 max-w-[240px] font-minimal">
          {spotify.error || spotify.playerError}
        </p>
      )}
    </div>
  )
}
