import { useState } from 'react'
import { coverUrl } from '$backend'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'
import './Cover.css'

/**
 * Artwork of a track (served by the Go side, see coverUrl), with a placeholder when there is none.
 * With 4 ids or more, shows a 2×2 mosaic, like Spotify playlists.
 */
export function Cover({ ids, icon = 'note', round = false }: { ids: string[]; icon?: IconName; round?: boolean }) {
  const tiles = ids.length >= 4 ? ids.slice(0, 4) : ids.slice(0, 1)
  const [failed, setFailed] = useState<Record<string, boolean>>({})

  return (
    <div className={cx('cover', round && 'round', tiles.length === 4 && 'mosaic')}>
      {tiles.length === 0 && (
        <div className="placeholder">
          <Icon name={icon} size={40} />
        </div>
      )}
      {tiles.map((id) =>
        failed[id] ? (
          <div key={id} className="placeholder">
            <Icon name={icon} size={tiles.length === 4 ? 20 : 40} />
          </div>
        ) : (
          <img
            key={id}
            src={coverUrl(id)}
            alt=""
            loading="lazy"
            draggable={false}
            onError={() => setFailed((f) => ({ ...f, [id]: true }))}
          />
        ),
      )}
    </div>
  )
}
