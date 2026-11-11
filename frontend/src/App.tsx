import { useEffect } from 'react'
import { ThemeProvider } from '@romain/uilib'
import { coverUrl as coverOf, EventsOn, GetInitialState, isMobile, Next, onBackButton, Prev, Seek, TogglePause } from '$backend'
import type { audio, core, library, playlist } from '../wailsjs/go/models'
import {
  back,
  forward,
  onFullscreenLeft,
  scanLibrary,
  setDrawer,
  setTracks,
  toggleCinema,
  toggleFullscreen,
  useApp,
} from './lib/store'
import { applyPalette, defaultPalette, uiTheme } from './lib/theme'
import { cx } from './lib/cx'
import { Sidebar } from './lib/Sidebar'
import { Main } from './lib/Main'
import { SidePanel } from './lib/SidePanel'
import { PlayerBar } from './lib/PlayerBar'
import { ContextMenu } from './lib/ContextMenu'
import { Cinema } from './lib/Cinema'
import './App.css'

const set = useApp.setState

function setNow(np: core.NowPlaying | null) {
  set({ now: np })
  if (np) applyPalette(np.palette)
}

// Android back button closes the topmost overlay, then goes back in history.
onBackButton(() => {
  const s = useApp.getState()
  if (s.drawer) set({ drawer: false })
  else if (s.menu) set({ menu: null })
  else if (s.cinema) toggleCinema()
  else if (s.panel) set({ panel: null })
  else if (s.index > 0) back()
  else return false
  return true
})

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
  const s = useApp.getState()
  if (e.code === 'Space') {
    e.preventDefault()
    TogglePause()
  } else if (e.code === 'KeyF' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    toggleCinema()
  } else if (e.key === 'F11') {
    e.preventDefault()
    toggleFullscreen()
  } else if (e.key === 'Escape' && s.cinema && !s.menu) {
    toggleCinema()
  } else if (e.key === 'ArrowRight' && e.ctrlKey) {
    Next()
  } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
    Prev()
  } else if (e.key === 'ArrowLeft' && e.altKey) {
    back()
  } else if (e.key === 'ArrowRight' && e.altKey) {
    forward()
  } else if (e.key === 'ArrowRight' && e.target === document.body) {
    Seek(s.state.position + 5)
  } else if (e.key === 'ArrowLeft' && e.target === document.body) {
    Seek(Math.max(0, s.state.position - 5))
  }
}

function onFullscreenChange() {
  if (!document.fullscreenElement) onFullscreenLeft()
}

// Mouse back / forward buttons navigate like in a browser.
function onMouse(e: MouseEvent) {
  if (e.button === 3) back()
  if (e.button === 4) forward()
}

export function App() {
  const now = useApp((s) => s.now)
  const audioError = useApp((s) => s.audioError)
  const notice = useApp((s) => s.notice)
  const drawer = useApp((s) => s.drawer)
  const panel = useApp((s) => s.panel)
  const menu = useApp((s) => s.menu)
  const cinema = useApp((s) => s.cinema)

  const coverUrl = now?.hasCover ? coverOf(now.track.id) : ''
  const theme = uiTheme(now?.palette ?? defaultPalette)

  useEffect(() => {
    GetInitialState().then((s) => {
      setTracks(s.tracks ?? [])
      set({
        settings: s.settings,
        playlists: s.playlists ?? [],
        presets: s.presets,
        bands: s.bands,
        audioError: s.audioError,
        state: s.state,
      })
      setNow(s.now ?? null)
      // Android has no music folder: the library follows the device's music.
      if (isMobile) scanLibrary()
    })

    const offs = [
      EventsOn('track:changed', (np: core.NowPlaying) => setNow(np)),
      EventsOn('playback:progress', (st: audio.State) => set({ state: st })),
      EventsOn('library:scan-progress', (p: { done: number; total: number }) => set({ scan: p })),
      EventsOn('library:updated', (tracks: library.Track[]) => {
        setTracks(tracks ?? [])
        set({ scan: null })
      }),
      EventsOn('playlists:updated', (pls: playlist.Playlist[]) => set({ playlists: pls ?? [] })),
    ]

    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      offs.forEach((off) => off())
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  return (
    <ThemeProvider className="app-root" accent={theme.accent} tokens={theme.tokens}>
      <div className="backdrop" aria-hidden="true">
        {coverUrl && <div key={coverUrl} className="blur" style={{ backgroundImage: `url('${coverUrl}')` }} />}
        <div className="gradient" />
      </div>

      <div className={cx('layout', isMobile && 'mobile')}>
        {!isMobile && <Sidebar />}
        <div className="center">
          {audioError && <div className="error">Sortie audio indisponible : {audioError}</div>}
          {notice && <div className="error">{notice}</div>}
          <Main />
        </div>
        <PlayerBar />
      </div>

      {drawer && (
        <>
          {/* Phone navigation: the sidebar, dropped down from the top. */}
          <div className="scrim" role="presentation" onClick={() => setDrawer(false)} />
          <div className="drawer">
            <Sidebar menu />
          </div>
        </>
      )}
      {panel && <SidePanel panel={panel} />}
      {menu && <ContextMenu key={`${menu.x},${menu.y}`} menu={menu} />}
      {cinema && <Cinema />}
    </ThemeProvider>
  )
}
