import { Cover } from './Cover'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'
import './MediaCard.css'

/** Grid card for an album, artist or playlist: click opens it, the round button plays it. */
export function MediaCard({
  ids,
  title,
  subtitle = '',
  round = false,
  icon = 'note',
  onOpen,
  onPlay,
}: {
  ids: string[]
  title: string
  subtitle?: string
  round?: boolean
  icon?: IconName
  onOpen: () => void
  onPlay: () => void
}) {
  return (
    <div
      className={cx('media-card', round && 'round')}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="art">
        <Cover ids={ids} round={round} icon={icon} />
        <button
          className="play"
          title="Lire"
          onClick={(e) => {
            e.stopPropagation()
            onPlay()
          }}
        >
          <Icon name="play" size={22} />
        </button>
      </div>
      <span className="title">{title}</span>
      {subtitle && <span className="sub">{subtitle}</span>}
    </div>
  )
}
