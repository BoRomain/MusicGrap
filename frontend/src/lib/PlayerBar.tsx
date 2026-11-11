import { albumKey, artistKey, artistName, go, toggleCinema, togglePanel, useApp, type Panel } from './store'
import { cx } from './cx'
import { Cover } from './Cover'
import { Icon, type IconName } from './Icon'
import { Transport } from './Transport'
import { Volume } from './Volume'
import './PlayerBar.css'

const PANELS: { id: Panel; label: string; icon: IconName }[] = [
  { id: 'slowed', label: 'Slowed + Reverb', icon: 'slowed' },
  { id: 'fade', label: 'Transitions', icon: 'fade' },
  { id: 'eq', label: 'Égaliseur', icon: 'eq' },
  { id: 'queue', label: "File d'attente", icon: 'queue' },
]

export function PlayerBar() {
  const now = useApp((s) => s.now)
  const panel = useApp((s) => s.panel)
  const track = now?.track

  return (
    <footer className="bar">
      <div className="now">
        {track && (
          <>
            <button className="thumb" title="File d'attente" onClick={() => togglePanel('queue')}>
              <Cover key={track.id} ids={now.hasCover ? [track.id] : []} />
            </button>
            <div className="names">
              <button className="title" onClick={() => go({ view: 'album', key: albumKey(track) })}>
                {track.title}
              </button>
              <button className="artist" onClick={() => go({ view: 'artist', key: artistKey(track.group) })}>
                {artistName(track.artist)}
              </button>
            </div>
          </>
        )}
      </div>

      <Transport />

      <div className="right">
        {PANELS.map((p) => (
          <button
            key={p.id}
            className={cx('small', p.id !== 'queue' && 'extra', panel === p.id && 'on')}
            title={p.label}
            onClick={() => togglePanel(p.id)}
          >
            <Icon name={p.icon} size={18} />
          </button>
        ))}
        <Volume />
        <button className="small" title="Mode cinéma (F)" onClick={toggleCinema}>
          <Icon name="fullscreen" size={20} />
        </button>
      </div>
    </footer>
  )
}
