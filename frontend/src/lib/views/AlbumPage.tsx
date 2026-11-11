import { albumTitle, artistName, fmtLong, go, kindLabel, playTracks, plural, shufflePlay, useApp } from '../store'
import { MediaCard } from '../MediaCard'
import { MediaHeader } from '../MediaHeader'
import { TrackTable } from '../TrackTable'

export function AlbumPage({ albumKey }: { albumKey: string }) {
  const lib = useApp((s) => s.lib)
  const album = lib.albums.get(albumKey)
  if (!album) return <p className="missing">Cet album n'est plus dans la bibliothèque.</p>

  const more = (lib.artists.get(album.artistKey)?.albums ?? []).filter((a) => a.key !== albumKey)

  return (
    <>
      <MediaHeader
        kind={kindLabel[album.kind]}
        title={albumTitle(album.title)}
        ids={[album.tracks[0].id]}
        icon="album"
        onPlay={() => playTracks(album.tracks)}
        onShuffle={() => shufflePlay(album.tracks)}
        tracks={album.tracks}
        meta={
          <>
            <button onClick={() => go({ view: 'artist', key: album.artistKey })}>
              <b>{artistName(album.artist)}</b>
            </button>
            {` · ${plural(album.tracks.length, 'titre')}, ${fmtLong(album.duration)}`}
          </>
        }
      />

      <TrackTable tracks={album.tracks} numbers="track" showAlbum={false} showCover={false} />

      {more.length > 0 && (
        <>
          <h2 className="section">Plus de {artistName(album.artist)}</h2>
          <div className="grid">
            {more.map((a) => (
              <MediaCard
                key={a.key}
                ids={[a.tracks[0].id]}
                icon="album"
                title={albumTitle(a.title)}
                subtitle={`${kindLabel[a.kind]} · ${plural(a.tracks.length, 'titre')}`}
                onOpen={() => go({ view: 'album', key: a.key })}
                onPlay={() => playTracks(a.tracks)}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
