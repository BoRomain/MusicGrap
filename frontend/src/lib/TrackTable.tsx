import { Fragment, useMemo, useState, type MouseEvent, type SyntheticEvent } from 'react'
import { isMobile } from '$backend'
import type { library } from '../../wailsjs/go/models'
import { albumKey, albumTitle, artistKey, artistName, fmtTime, go, playTracks, setMenu, useApp } from './store'
import { cx } from './cx'
import { Cover } from './Cover'
import { Icon } from './Icon'
import './TrackTable.css'

type SortKey = 'title' | 'artist' | 'album' | 'duration'

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
// Touch screens (Android): one tap plays, as there is no hover or double click.
const touch = matchMedia('(hover: none)').matches

function link(e: SyntheticEvent, fn: () => void) {
  e.stopPropagation()
  fn()
}

/**
 * Spotify-like track list. Double-click or Enter plays the list from that track,
 * right-click opens the context menu. positions are the playlist indexes of the rows, when showing a playlist.
 */
export function TrackTable({
  tracks,
  playlistId,
  positions,
  numbers = 'index',
  showAlbum = true,
  showCover = true,
  sortable = false,
}: {
  tracks: library.Track[]
  playlistId?: string
  positions?: number[]
  numbers?: 'index' | 'track'
  showAlbum?: boolean
  showCover?: boolean
  sortable?: boolean
}) {
  const nowId = useApp((s) => s.now?.track.id)
  const paused = useApp((s) => s.state.paused)
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null)
  const [selected, setSelected] = useState('')

  /** Row order, as indexes into tracks (the original order unless a column is sorted). */
  const order = useMemo(() => {
    const idx = tracks.map((_, i) => i)
    if (!sort) return idx
    const { key, desc } = sort
    const val = (t: library.Track) => (key === 'artist' ? t.group : t[key])
    idx.sort((a, b) => {
      const x = val(tracks[a])
      const y = val(tracks[b])
      const c = typeof x === 'number' ? x - (y as number) : collator.compare(x as string, y as string)
      return desc ? -c : c
    })
    return idx
  }, [tracks, sort])
  const rows = useMemo(() => order.map((i) => tracks[i]), [order, tracks])
  const multiDisc = numbers === 'track' && new Set(tracks.map((t) => t.discNo)).size > 1

  function toggleSort(key: SortKey) {
    if (!sortable) return
    if (sort?.key !== key) setSort({ key, desc: false })
    else if (!sort.desc) setSort({ key, desc: true })
    else setSort(null)
  }

  const play = (k: number) => playTracks(rows, k)

  function openMenu(e: MouseEvent, k: number) {
    e.preventDefault()
    setSelected(rows[k].id)
    setMenu({ x: e.clientX, y: e.clientY, tracks: [rows[k]], playlistId, index: positions?.[order[k]] })
  }

  function head(key: SortKey, label: string, cls = '') {
    if (!sortable) return <span className={cx('th', cls)}>{label}</span>
    return (
      <button className={cx('th', cls, sort?.key === key && 'sorted')} onClick={() => toggleSort(key)}>
        {label}
        {sort?.key === key && <span className="arrow">{sort.desc ? '▼' : '▲'}</span>}
      </button>
    )
  }

  return (
    <div className={cx('track-table', !showAlbum && 'noalbum')} role="grid">
      <div className="head">
        <span className="th num">#</span>
        {head('title', 'Titre')}
        {showAlbum && head('album', 'Album', 'col-album')}
        {sortable ? (
          <button className={cx('th dur', sort?.key === 'duration' && 'sorted')} onClick={() => toggleSort('duration')} title="Durée">
            <Icon name="clock" size={16} />
          </button>
        ) : (
          <span className="th dur" title="Durée">
            <Icon name="clock" size={16} />
          </span>
        )}
      </div>

      {rows.map((t, k) => {
        const current = nowId === t.id
        return (
          <Fragment key={playlistId ? `${positions?.[order[k]]}` : t.id}>
            {multiDisc && (k === 0 || rows[k - 1].discNo !== t.discNo) && (
              <div className="disc">
                <Icon name="album" size={16} /> Disque {t.discNo || 1}
              </div>
            )}
            <div
              className={cx('row', current && 'current', selected === t.id && 'selected')}
              role="row"
              tabIndex={0}
              onClick={() => (touch ? play(k) : setSelected(t.id))}
              onDoubleClick={() => play(k)}
              onKeyDown={(e) => e.key === 'Enter' && play(k)}
              onContextMenu={(e) => openMenu(e, k)}
            >
              <span className="num">
                {current && !paused ? (
                  <span className="bars" aria-label="En lecture">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <span className="n">{numbers === 'track' ? t.trackNo || '–' : k + 1}</span>
                )}
                <button className="rowplay" title="Lire" onClick={(e) => link(e, () => play(k))}>
                  <Icon name="play" size={16} />
                </button>
              </span>
              <span className="main">
                {showCover && (
                  <span className="thumb">
                    <Cover ids={[t.id]} />
                  </span>
                )}
                <span className="names">
                  <span className="title">{t.title}</span>
                  {isMobile ? (
                    // Phone: a tap anywhere on the row plays it, so the artist isn't a link.
                    <span className="sub">{artistName(t.artist)}</span>
                  ) : (
                    <button className="sub link" onClick={(e) => link(e, () => go({ view: 'artist', key: artistKey(t.group) }))}>
                      {artistName(t.artist)}
                    </button>
                  )}
                </span>
              </span>
              {showAlbum && (
                <span className="album">
                  {isMobile ? (
                    albumTitle(t.album)
                  ) : (
                    <button className="link" onClick={(e) => link(e, () => go({ view: 'album', key: albumKey(t) }))}>
                      {albumTitle(t.album)}
                    </button>
                  )}
                </span>
              )}
              <span className="dur">
                <button
                  className="more"
                  title="Plus d'options"
                  onClick={(e) => {
                    e.stopPropagation()
                    openMenu(e, k)
                  }}
                >
                  <Icon name="more" size={18} />
                </button>
                {fmtTime(t.duration)}
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
