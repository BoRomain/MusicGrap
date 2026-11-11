import { useEffect } from 'react'
import { IconButton, SegmentedControl } from '@romain/uilib'
import { artistName, setPanel, useApp, type Panel } from './store'
import { Cover } from './Cover'
import { Icon } from './Icon'
import { Equalizer } from './Equalizer'
import { SlowedPanel } from './SlowedPanel'
import { Transitions } from './Transitions'
import { Queue } from './Queue'
import './SidePanel.css'

const TABS: { value: Panel; label: string }[] = [
  { value: 'queue', label: 'File' },
  { value: 'eq', label: 'Égaliseur' },
  { value: 'slowed', label: 'Slowed' },
  { value: 'fade', label: 'Fondus' },
]

/** Floating card above the player bar. Non-modal: the library stays usable while it is open. */
export function SidePanel({ panel }: { panel: Panel }) {
  const now = useApp((s) => s.now)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useApp.getState().menu) setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <aside className="side-panel">
      <nav>
        <SegmentedControl aria-label="Panneau" options={TABS} value={panel} onChange={setPanel} />
        <IconButton aria-label="Fermer (Échap)" title="Fermer (Échap)" variant="ghost" size="sm" onClick={() => setPanel(null)}>
          <Icon name="close" size={18} />
        </IconButton>
      </nav>

      <div className="content">
        {panel === 'queue' && (
          <>
            {now && (
              <div className="now">
                <span className="thumb">
                  <Cover key={now.track.id} ids={now.hasCover ? [now.track.id] : []} />
                </span>
                <span className="names">
                  <span className="kind">En cours de lecture</span>
                  <b>{now.track.title}</b>
                  <span className="artist">{artistName(now.track.artist)}</span>
                </span>
              </div>
            )}
            <h3>File d'attente</h3>
            <Queue />
          </>
        )}
        {panel === 'eq' && <Equalizer />}
        {panel === 'slowed' && <SlowedPanel />}
        {panel === 'fade' && <Transitions />}
      </div>
    </aside>
  )
}
