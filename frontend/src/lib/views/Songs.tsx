import { fmtLong, playTracks, plural, shufflePlay, useApp } from '../store'
import { MediaHeader } from '../MediaHeader'
import { TrackTable } from '../TrackTable'

export function Songs() {
  const tracks = useApp((s) => s.tracks)
  const duration = tracks.reduce((s, t) => s + t.duration, 0)
  return (
    <>
      <MediaHeader
        kind="Bibliothèque"
        title="Tous les titres"
        ids={[]}
        icon="note"
        onPlay={() => playTracks(tracks)}
        onShuffle={() => shufflePlay(tracks)}
        tracks={tracks}
        meta={`${plural(tracks.length, 'titre')}, ${fmtLong(duration)}`}
      />
      <TrackTable tracks={tracks} sortable />
    </>
  )
}
