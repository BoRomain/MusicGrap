import { Button, IconButton, List, ListItem } from '@romain/uilib'
import { CreatePlaylist, isMobile } from '$backend'
import { chooseFolder, coverIds, go, playlistTracks, plural, scanLibrary, setDrawer, useApp, useRoute, type Route } from './store'
import { cx } from './cx'
import { Cover } from './Cover'
import { Icon, type IconName } from './Icon'
import './Sidebar.css'

const LINKS: { route: Route; label: string; icon: IconName }[] = [
  { route: { view: 'search' }, label: 'Rechercher', icon: 'search' },
  { route: { view: 'albums' }, label: 'Albums', icon: 'album' },
  { route: { view: 'artists' }, label: 'Artistes', icon: 'artist' },
  { route: { view: 'songs' }, label: 'Titres', icon: 'note' },
]

/** In the phone menu: labels always shown, and the menu closes on navigation. */
export function Sidebar({ menu = false }: { menu?: boolean }) {
  const r = useRoute()
  const playlists = useApp((s) => s.playlists)
  const lib = useApp((s) => s.lib)
  const scan = useApp((s) => s.scan)
  const trackCount = useApp((s) => s.tracks.length)
  const musicDir = useApp((s) => s.settings.musicDir)

  function open(to: Route) {
    go(to)
    if (menu) setDrawer(false)
  }

  async function newPlaylist() {
    const p = await CreatePlaylist(`Playlist n°${useApp.getState().playlists.length + 1}`)
    open({ view: 'playlist', key: p.id })
  }

  return (
    <aside className={cx('sidebar', menu && 'menu')}>
      <div className="box">
        <div className="brand">
          <Icon name="slowed" size={26} />
          <span className="text">Wave</span>
        </div>
        <nav>
          {LINKS.map((l) => (
            <button key={l.label} className={cx(r.view === l.route.view && 'active')} title={l.label} onClick={() => open(l.route)}>
              <Icon name={l.icon} size={22} />
              <span className="text">{l.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="box library">
        <header>
          <span className="label">
            <Icon name="playlist" size={22} /> <span className="text">Playlists</span>
          </span>
          <IconButton aria-label="Créer une playlist" title="Créer une playlist" variant="ghost" size="sm" onClick={newPlaylist}>
            <Icon name="plus" size={20} />
          </IconButton>
        </header>

        {playlists.length ? (
          <List className="playlists" inset={false}>
            {playlists.map((p) => {
              const tracks = playlistTracks(lib, p).map((e) => e.track)
              return (
                <ListItem
                  key={p.id}
                  className={cx(r.view === 'playlist' && r.key === p.id && 'active')}
                  title={p.name}
                  subtitle={`Playlist · ${plural(tracks.length, 'titre')}`}
                  leading={
                    <span className="thumb" title={p.name}>
                      <Cover ids={coverIds(tracks)} icon="playlist" />
                    </span>
                  }
                  onClick={() => open({ view: 'playlist', key: p.id })}
                />
              )
            })}
          </List>
        ) : (
          <div className="empty">
            <p>Crée ta première playlist</p>
            <Button size="sm" onClick={newPlaylist}>
              Créer une playlist
            </Button>
          </div>
        )}

        <footer>
          {scan ? (
            <div className="scan">
              Analyse… {scan.done} / {scan.total}
              <div className="scan-bar">
                <div style={{ width: `${(scan.done / Math.max(1, scan.total)) * 100}%` }} />
              </div>
            </div>
          ) : (
            <span className="count">{plural(trackCount, 'titre')}</span>
          )}
          <IconButton
            aria-label={isMobile ? 'Actualiser la bibliothèque' : 'Rescanner le dossier'}
            title={isMobile ? 'Actualiser la bibliothèque' : 'Rescanner le dossier'}
            variant="ghost"
            size="sm"
            onClick={scanLibrary}
            disabled={!isMobile && !musicDir}
          >
            <Icon name="refresh" size={18} />
          </IconButton>
          {!isMobile && (
            <IconButton aria-label="Choisir le dossier musique" title="Choisir le dossier musique" variant="ghost" size="sm" onClick={chooseFolder}>
              <Icon name="folder" size={18} />
            </IconButton>
          )}
        </footer>
      </div>
    </aside>
  )
}
