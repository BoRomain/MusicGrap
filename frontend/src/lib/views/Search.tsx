import type { CSSProperties } from 'react'
import { albumTitle, artistName, go, kindLabel, playTracks, plural, useApp } from '../store'
import { MediaCard } from '../MediaCard'
import { TrackTable } from '../TrackTable'

const PLAYLIST_COLORS = ['#27856a', '#e8115b', '#148a08', '#bc5900', '#509bf5']
const tint = (c: string) => ({ '--c': c }) as CSSProperties

export function Search() {
  const query = useApp((s) => s.query)
  const tracks = useApp((s) => s.tracks)
  const lib = useApp((s) => s.lib)
  const playlists = useApp((s) => s.playlists)

  const q = query.trim().toLowerCase()
  const has = (s: string) => s.toLowerCase().includes(q)

  if (!q) {
    return (
      <>
        <h2 className="section">Parcourir</h2>
        <div className="browse">
          <button style={tint('#e13300')} onClick={() => go({ view: 'albums' })}>
            Albums<span>{lib.albums.size}</span>
          </button>
          <button style={tint('#1e3264')} onClick={() => go({ view: 'artists' })}>
            Artistes<span>{lib.artists.size}</span>
          </button>
          <button style={tint('#8400e7')} onClick={() => go({ view: 'songs' })}>
            Titres<span>{tracks.length}</span>
          </button>
          {playlists.map((p, i) => (
            <button key={p.id} style={tint(PLAYLIST_COLORS[i % 5])} onClick={() => go({ view: 'playlist', key: p.id })}>
              {p.name}
              <span>{plural(p.trackIds.length, 'titre')}</span>
            </button>
          ))}
        </div>
      </>
    )
  }

  const songs = tracks.filter((t) => has(`${t.title} ${t.artist} ${t.album}`))
  const albums = [...lib.albums.values()].filter((a) => has(`${a.title} ${a.artist}`))
  const artists = [...lib.artists.values()].filter((a) => has(a.name))

  if (!songs.length && !albums.length && !artists.length) {
    return (
      <div className="none">
        <h2>Aucun résultat pour « {query.trim()} »</h2>
        <p>Vérifie l'orthographe ou essaie d'autres mots-clés.</p>
      </div>
    )
  }

  return (
    <>
      {songs.length > 0 && (
        <>
          <h2 className="section">Titres</h2>
          <TrackTable tracks={songs.slice(0, 100)} />
          {songs.length > 100 && <p className="more">… et {songs.length - 100} autres titres</p>}
        </>
      )}

      {artists.length > 0 && (
        <>
          <h2 className="section">Artistes</h2>
          <div className="grid">
            {artists.slice(0, 12).map((ar) => (
              <MediaCard
                key={ar.key}
                ids={[ar.cover]}
                round
                icon="artist"
                title={artistName(ar.name)}
                subtitle="Artiste"
                onOpen={() => go({ view: 'artist', key: ar.key })}
                onPlay={() => playTracks(ar.tracks)}
              />
            ))}
          </div>
        </>
      )}

      {albums.length > 0 && (
        <>
          <h2 className="section">Albums</h2>
          <div className="grid">
            {albums.slice(0, 24).map((a) => (
              <MediaCard
                key={a.key}
                ids={[a.tracks[0].id]}
                icon="album"
                title={albumTitle(a.title)}
                subtitle={`${kindLabel[a.kind]} · ${artistName(a.artist)}`}
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
