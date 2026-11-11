import { useState, type ReactNode } from 'react'
import { TogglePause } from '$backend'
import type { library } from '../../wailsjs/go/models'
import { useApp } from './store'
import { Cover } from './Cover'
import { Icon, type IconName } from './Icon'
import './MediaHeader.css'

/** Big header of an album, artist or playlist page, with its play / shuffle actions. */
export function MediaHeader({
  kind,
  title,
  ids,
  round = false,
  icon = 'note',
  meta,
  actions,
  onPlay,
  onShuffle,
  onRename,
  tracks = [],
}: {
  kind: string
  title: string
  ids: string[]
  round?: boolean
  icon?: IconName
  meta?: ReactNode
  actions?: ReactNode
  onPlay: () => void
  onShuffle: () => void
  onRename?: (name: string) => void
  /** The page's tracks: while one of them is loaded, the play button pauses and resumes it. */
  tracks?: library.Track[]
}) {
  const nowId = useApp((s) => s.now?.track.id)
  const active = useApp((s) => s.state.hasTrack && !s.state.paused)
  const current = !!nowId && tracks.some((t) => t.id === nowId)
  const playing = current && active

  const [editing, setEditing] = useState(false)

  function commit(value: string) {
    if (!editing) return
    setEditing(false)
    const name = value.trim()
    if (name && name !== title) onRename?.(name)
  }

  return (
    <>
      <header className="media-header">
        <div className="art">
          <Cover ids={ids} round={round} icon={icon} />
        </div>
        <div className="text">
          <span className="kind">{kind}</span>
          {editing ? (
            <input
              className="rename"
              defaultValue={title}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => commit(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
          ) : onRename ? (
            <h1>
              <button className="title" title="Renommer" onClick={() => setEditing(true)}>
                {title}
              </button>
            </h1>
          ) : (
            <h1>{title}</h1>
          )}
          {meta && <div className="meta">{meta}</div>}
        </div>
      </header>

      <div className="media-actions">
        <button className="play" title={playing ? 'Pause' : 'Lire'} onClick={() => (current ? TogglePause() : onPlay())}>
          <Icon name={playing ? 'pause' : 'play'} size={28} />
        </button>
        <button className="icon" title="Lecture aléatoire" onClick={onShuffle}>
          <Icon name="shuffle" size={26} />
        </button>
        {onRename && (
          <button className="icon" title="Renommer" onClick={() => setEditing(true)}>
            <Icon name="edit" size={22} />
          </button>
        )}
        {actions}
      </div>
    </>
  )
}
