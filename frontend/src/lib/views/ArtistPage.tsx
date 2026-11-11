import {
  albumKinds,
  albumTitle,
  artistName,
  fmtLong,
  go,
  kindCount,
  kindLabel,
  kindPlural,
  playTracks,
  plural,
  shufflePlay,
  useApp,
  type Album,
} from '../store'
import { MediaCard } from '../MediaCard'
import { MediaHeader } from '../MediaHeader'
import { TrackTable } from '../TrackTable'

/** Newest first, undated last; the sort is stable so ties keep alphabetical order. */
const byDate = (a: Album, b: Album) => (!a.date !== !b.date ? (a.date ? -1 : 1) : b.date.localeCompare(a.date))

export function ArtistPage({ artistKey }: { artistKey: string }) {
  const artist = useApp((s) => s.lib.artists.get(artistKey))
  if (!artist) return <p className="missing">Cet artiste n'est plus dans la bibliothèque.</p>

  const duration = artist.tracks.reduce((s, t) => s + t.duration, 0)
  const sections = albumKinds
    .map((kind) => ({ kind, albums: artist.albums.filter((a) => a.kind === kind).sort(byDate) }))
    .filter((s) => s.albums.length)

  return (
    <>
      <MediaHeader
        kind="Artiste"
        title={artistName(artist.name)}
        ids={[artist.cover]}
        round
        icon="artist"
        onPlay={() => playTracks(artist.tracks)}
        onShuffle={() => shufflePlay(artist.tracks)}
        tracks={artist.tracks}
        meta={
          sections.map((s) => `${kindCount(s.albums.length, s.kind)} · `).join('') +
          `${plural(artist.tracks.length, 'titre')}, ${fmtLong(duration)}`
        }
      />

      {sections.map((s) => (
        <section key={s.kind}>
          <h2 className="section">{kindPlural[s.kind]}</h2>
          <div className="grid">
            {s.albums.map((a) => (
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
        </section>
      ))}

      <h2 className="section">Titres</h2>
      <TrackTable tracks={artist.tracks} sortable />
    </>
  )
}
