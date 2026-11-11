import { useEffect, useState } from 'react'
import { List, ListItem } from '@romain/uilib'
import { GetQueue } from '$backend'
import type { library } from '../../wailsjs/go/models'
import { fmtTime, useApp } from './store'

/** Upcoming tracks; the first one is the current track. */
export function Queue() {
  const [queue, setQueue] = useState<library.Track[]>([])
  const trackId = useApp((s) => s.now?.track.id)
  const shuffle = useApp((s) => s.settings.shuffle)
  const repeat = useApp((s) => s.settings.repeat)

  // Refresh whenever the track or the play order changes.
  useEffect(() => {
    let live = true
    GetQueue().then((q) => live && setQueue(q ?? []))
    return () => {
      live = false
    }
  }, [trackId, shuffle, repeat])

  if (queue.length === 0) return <p className="queue-empty">La file d'attente est vide.</p>

  return (
    <>
      <List className="queue" inset={false}>
        {queue.slice(0, 50).map((t, i) => (
          <ListItem
            key={i}
            className={i === 0 ? 'current' : undefined}
            title={t.title}
            subtitle={t.artist}
            trailing={<span className="dur">{fmtTime(t.duration)}</span>}
          />
        ))}
      </List>
      {queue.length > 50 && <p className="queue-empty">… et {queue.length - 50} autres</p>}
    </>
  )
}
