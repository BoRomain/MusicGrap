import { artistName, go, playTracks, plural, useApp } from '../store'
import { MediaCard } from '../MediaCard'

export function Artists() {
  const artists = useApp((s) => s.lib.artists)
  return (
    <>
      <h2 className="section">Artistes</h2>
      <div className="grid">
        {[...artists.values()].map((ar) => (
          <MediaCard
            key={ar.key}
            ids={[ar.cover]}
            round
            icon="artist"
            title={artistName(ar.name)}
            subtitle={plural(ar.albums.length, 'album')}
            onOpen={() => go({ view: 'artist', key: ar.key })}
            onPlay={() => playTracks(ar.tracks)}
          />
        ))}
      </div>
    </>
  )
}
