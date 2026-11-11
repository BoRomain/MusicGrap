import { useEffect, useRef, useState } from 'react'
import { coverUrl as coverOf, GetQueue } from '$backend'
import type { library } from '../../wailsjs/go/models'
import { albumKey, albumTitle, artistKey, artistName, go, toggleCinema, useApp } from './store'
import { cx } from './cx'
import { Cover } from './Cover'
import { Icon } from './Icon'
import { Transport } from './Transport'
import { Volume } from './Volume'
import './Cinema.css'

function leave(fn: () => void) {
  toggleCinema()
  fn()
}

/** "Now playing" view over the whole window. The controls fade out after a few seconds without moving the mouse. */
export function Cinema() {
  const now = useApp((s) => s.now)
  const shuffle = useApp((s) => s.settings.shuffle)
  const repeat = useApp((s) => s.settings.repeat)
  const track = now?.track
  const coverUrl = now?.hasCover ? coverOf(now.track.id) : ''

  const [upNext, setUpNext] = useState<library.Track | null>(null)
  useEffect(() => {
    let live = true
    GetQueue().then((q) => live && setUpNext(q?.[1] ?? null))
    return () => {
      live = false
    }
  }, [track?.id, shuffle, repeat])

  const [idle, setIdle] = useState(false)
  const hovering = useRef(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const wake = () => {
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(!hovering.current), 3000)
    }
    wake()
    const events = ['mousemove', 'pointerdown', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, wake))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, wake))
    }
  }, [])

  const hold = {
    onMouseEnter: () => (hovering.current = true),
    onMouseLeave: () => (hovering.current = false),
  }

  return (
    <div className={cx('cinema-view', idle && 'idle')}>
      <div className="bg" aria-hidden="true">
        {coverUrl && <div key={coverUrl} className="blur" style={{ backgroundImage: `url('${coverUrl}')` }} />}
      </div>

      <header className="chrome">
        <div className="from">
          <span className="logo">
            <Icon name="slowed" size={26} />
          </span>
          <span className="label">En lecture</span>
          {track && (
            <button onClick={() => leave(() => go({ view: 'album', key: albumKey(track) }))}>{albumTitle(track.album)}</button>
          )}
        </div>
        {upNext && (
          <div className="next" {...hold}>
            <span className="thumb">
              <Cover ids={[upNext.id]} />
            </span>
            <span className="names">
              <span className="label">À suivre</span>
              <b>
                {upNext.title} • {artistName(upNext.artist)}
              </b>
            </span>
          </div>
        )}
      </header>

      <main className="hero">
        {track ? (
          <>
            <div key={track.id} className="art">
              <Cover ids={now.hasCover ? [track.id] : []} />
            </div>
            <div className="text">
              <h1>{track.title}</h1>
              <button className="artist" onClick={() => leave(() => go({ view: 'artist', key: artistKey(track.group) }))}>
                {artistName(track.artist)}
              </button>
            </div>
          </>
        ) : (
          <p className="nothing">Rien en lecture</p>
        )}
      </main>

      <footer className="chrome" {...hold}>
        <Transport
          cinema
          extra={
            <>
              <Volume />
              <button className="exit" title="Quitter le mode cinéma (Échap)" onClick={toggleCinema}>
                <Icon name="fullscreen-exit" size={22} />
              </button>
            </>
          }
        />
      </footer>
    </div>
  )
}
