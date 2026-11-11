import { DeletePlaylist, RenamePlaylist } from '$backend'
import { back, coverIds, fmtLong, playlistTracks, playTracks, plural, shufflePlay, useApp } from '../store'
import { Icon } from '../Icon'
import { MediaHeader } from '../MediaHeader'
import { TrackTable } from '../TrackTable'

export function PlaylistPage({ id }: { id: string }) {
  const playlist = useApp((s) => s.playlists.find((p) => p.id === id))
  const lib = useApp((s) => s.lib)
  if (!playlist) return <p className="missing">Cette playlist n'existe plus.</p>

  const entries = playlistTracks(lib, playlist)
  const tracks = entries.map((e) => e.track)
  const duration = tracks.reduce((s, t) => s + t.duration, 0)

  async function remove() {
    if (!playlist || !confirm(`Supprimer la playlist « ${playlist.name} » ?`)) return
    await DeletePlaylist(playlist.id)
    back()
  }

  return (
    <>
      <MediaHeader
        kind="Playlist"
        title={playlist.name}
        ids={coverIds(tracks)}
        icon="playlist"
        onPlay={() => playTracks(tracks)}
        onShuffle={() => shufflePlay(tracks)}
        tracks={tracks}
        onRename={(name) => RenamePlaylist(playlist.id, name)}
        meta={plural(tracks.length, 'titre') + (tracks.length ? `, ${fmtLong(duration)}` : '')}
        actions={
          <button className="icon" title="Supprimer la playlist" onClick={remove}>
            <Icon name="trash" size={22} />
          </button>
        }
      />

      {tracks.length ? (
        <TrackTable tracks={tracks} playlistId={playlist.id} positions={entries.map((e) => e.index)} />
      ) : (
        <div className="missing">
          <h3>Cette playlist est vide</h3>
          <p>Fais un clic droit sur un titre, puis « Ajouter à la playlist ».</p>
        </div>
      )}
    </>
  )
}
