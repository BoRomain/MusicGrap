import { useEffect, useRef } from 'react'
import { Button, TextField } from '@romain/uilib'
import { isMobile } from '$backend'
import { back, chooseFolder, forward, go, scanLibrary, setDrawer, setQuery, useApp, useRoute } from './store'
import { Icon } from './Icon'
import { Albums } from './views/Albums'
import { AlbumPage } from './views/AlbumPage'
import { Artists } from './views/Artists'
import { ArtistPage } from './views/ArtistPage'
import { Songs } from './views/Songs'
import { PlaylistPage } from './views/PlaylistPage'
import { Search } from './views/Search'
import './Main.css'

function Page() {
  const r = useRoute()
  switch (r.view) {
    case 'albums':
      return <Albums />
    case 'artists':
      return <Artists />
    case 'songs':
      return <Songs />
    case 'search':
      return <Search />
    case 'album':
      return <AlbumPage key={r.key} albumKey={r.key} />
    case 'artist':
      return <ArtistPage key={r.key} artistKey={r.key} />
    case 'playlist':
      return <PlaylistPage key={r.key} id={r.key} />
  }
}

export function Main() {
  const index = useApp((s) => s.index)
  const last = useApp((s) => s.history.length - 1)
  const view = useRoute().view
  const query = useApp((s) => s.query)
  const empty = useApp((s) => s.tracks.length === 0 && !s.scan)
  const drawer = useApp((s) => s.drawer)

  const scroller = useRef<HTMLElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  // Every page opens at the top.
  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
  }, [index])

  // Focus the search field when the Search page is opened.
  useEffect(() => {
    if (view === 'search') searchInput.current?.focus()
  }, [view])

  return (
    <section className="main" ref={scroller}>
      <div className="top">
        {isMobile && (
          <button className="nav menu" title="Menu" onClick={() => setDrawer(!drawer)}>
            <Icon name="menu" size={22} />
          </button>
        )}
        <button className="nav" title="Précédent" disabled={index === 0} onClick={back}>
          <Icon name="back" size={22} />
        </button>
        <button className="nav" title="Suivant" disabled={index === last} onClick={forward}>
          <Icon name="forward" size={22} />
        </button>
        <TextField
          ref={searchInput}
          className="search"
          aria-label="Rechercher"
          placeholder="Que souhaitez-vous écouter ?"
          value={query}
          leading={<Icon name="search" size={20} />}
          trailing={
            query && (
              <button className="clear" title="Effacer" onClick={() => setQuery('')}>
                <Icon name="close" size={18} />
              </button>
            )
          }
          onFocus={() => go({ view: 'search' })}
          onChange={(e) => {
            setQuery(e.currentTarget.value)
            go({ view: 'search' })
          }}
        />
      </div>

      <div className="page">
        {empty ? (
          <div className="empty">
            <Icon name="note" size={56} />
            {isMobile ? (
              <>
                <h2>Aucune musique trouvée sur l'appareil</h2>
                <p>Autorise l'accès à la musique, ou ajoute des fichiers audio sur ton téléphone.</p>
                <Button variant="primary" size="lg" onClick={scanLibrary}>
                  Rechercher la musique
                </Button>
              </>
            ) : (
              <>
                <h2>Aucune musique pour l'instant</h2>
                <p>Choisis le dossier où se trouve ta musique (MP3, FLAC, OGG, WAV).</p>
                <Button variant="primary" size="lg" icon={<Icon name="folder" size={18} />} onClick={chooseFolder}>
                  Choisir un dossier
                </Button>
              </>
            )}
          </div>
        ) : (
          <Page />
        )}
      </div>
    </section>
  )
}
