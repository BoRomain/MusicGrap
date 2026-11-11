import { useMemo, useState } from 'react'
import { ChipGroup } from '@romain/uilib'
import { albumKinds, albumTitle, artistName, go, kindLabel, kindPlural, playTracks, useApp, type Album, type AlbumKind } from '../store'
import { MediaCard } from '../MediaCard'

type Sort = 'artist' | 'title' | 'recent'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'artist', label: 'Artiste' },
  { value: 'title', label: 'Titre' },
  { value: 'recent', label: 'Ajouts récents' },
]
const KINDS: { value: AlbumKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Tout' },
  ...albumKinds.map((k) => ({ value: k, label: kindPlural[k] })),
]

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
const added = (a: Album) => Math.max(...a.tracks.map((t) => t.modTime))

export function Albums() {
  const lib = useApp((s) => s.lib)
  const [sort, setSort] = useState<Sort>('artist')
  const [kind, setKind] = useState<AlbumKind | 'all'>('all')

  const albums = useMemo(() => {
    const list = [...lib.albums.values()].filter((a) => kind === 'all' || a.kind === kind)
    if (sort === 'title') list.sort((a, b) => collator.compare(albumTitle(a.title), albumTitle(b.title)))
    if (sort === 'recent') list.sort((a, b) => added(b) - added(a))
    return list
  }, [lib, sort, kind])

  return (
    <>
      <div className="albums-head">
        <h2 className="section">Albums</h2>
        <ChipGroup aria-label="Type" options={KINDS} value={kind} onChange={setKind} />
        <ChipGroup aria-label="Tri" options={SORTS} value={sort} onChange={setSort} />
      </div>

      <div className="grid">
        {albums.map((a) => (
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
  )
}
