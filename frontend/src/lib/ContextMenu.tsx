import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AddToPlaylist, CreatePlaylist, RemoveFromPlaylist } from '$backend'
import { albumKey, artistKey, go, setMenu, useApp, type Menu } from './store'
import { cx } from './cx'
import { Icon } from './Icon'
import './ContextMenu.css'

const close = () => setMenu(null)

/** Right-click menu on tracks (no UiLib equivalent). */
export function ContextMenu({ menu }: { menu: Menu }) {
  const playlists = useApp((s) => s.playlists)
  const el = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: menu.x, y: menu.y })
  const [sub, setSub] = useState(false)

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const r = el.current!.getBoundingClientRect()
    setPos({
      x: Math.min(menu.x, innerWidth - r.width - 8),
      y: Math.min(menu.y, innerHeight - r.height - 8),
    })
  }, [menu])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onWheel = (e: WheelEvent) => !el.current?.contains(e.target as Node) && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    window.addEventListener('wheel', onWheel)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  const flip = pos.x + 2 * 230 > innerWidth
  const ids = menu.tracks.map((t) => t.id)
  const one = menu.tracks.length === 1 ? menu.tracks[0] : null

  function run(fn: () => void) {
    fn()
    close()
  }

  async function addToNew() {
    const p = await CreatePlaylist(`Playlist n°${useApp.getState().playlists.length + 1}`)
    await AddToPlaylist(p.id, ids)
    go({ view: 'playlist', key: p.id })
  }

  const { playlistId, index } = menu

  return (
    <>
      <div
        className="ctx-overlay"
        onClick={close}
        onContextMenu={(e) => {
          e.preventDefault()
          close()
        }}
      />
      <div className="ctx-menu" role="menu" ref={el} style={{ left: pos.x, top: pos.y }}>
        <div className="item sub" role="menuitem" tabIndex={-1} onMouseEnter={() => setSub(true)} onMouseLeave={() => setSub(false)}>
          <Icon name="plus" size={18} /> Ajouter à la playlist
          <span className="chev">
            <Icon name="forward" size={18} />
          </span>
          {sub && (
            <div className={cx('ctx-menu submenu', flip && 'flip')} role="menu">
              <button className="item" onClick={() => run(addToNew)}>
                <Icon name="plus" size={18} /> Nouvelle playlist
              </button>
              {playlists.length > 0 && <hr />}
              {playlists.map((p) => (
                <button key={p.id} className="item" onClick={() => run(() => AddToPlaylist(p.id, ids))}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {playlistId && index != null && (
          <button className="item" onClick={() => run(() => RemoveFromPlaylist(playlistId, index))}>
            <Icon name="trash" size={18} /> Retirer de cette playlist
          </button>
        )}
        {one && (
          <>
            <hr />
            <button className="item" onClick={() => run(() => go({ view: 'artist', key: artistKey(one.group) }))}>
              <Icon name="artist" size={18} /> Aller à l'artiste
            </button>
            <button className="item" onClick={() => run(() => go({ view: 'album', key: albumKey(one) }))}>
              <Icon name="album" size={18} /> Aller à l'album
            </button>
          </>
        )}
      </div>
    </>
  )
}
