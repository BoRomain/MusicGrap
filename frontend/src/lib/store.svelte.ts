import { ChooseMusicFolder, PlayQueue, SetShuffle, WindowFullscreen, WindowUnfullscreen } from '$backend'
import type { audio, core, library, playlist, settings } from '../../wailsjs/go/models'

export type Panel = 'queue' | 'eq' | 'slowed' | 'fade'

export type Route =
  | { view: 'albums' | 'artists' | 'songs' | 'search' }
  | { view: 'album' | 'artist' | 'playlist'; key: string }

/** Right-click menu on one or more tracks; index is the position in the playlist being shown. */
export type Menu = { x: number; y: number; tracks: library.Track[]; playlistId?: string; index?: number }

export const app = $state({
  tracks: [] as library.Track[],
  playlists: [] as playlist.Playlist[],
  settings: {} as settings.Settings,
  presets: {} as Record<string, number[]>,
  bands: [] as number[],
  now: null as core.NowPlaying | null,
  state: { position: 0, duration: 0, paused: true, hasTrack: false } as audio.State,
  scan: null as { done: number; total: number } | null,
  audioError: '',
  /** Error from the last user action (folder picker, permissions...), shown in a banner. */
  notice: '',
  panel: null as Panel | null,
  query: '',
  menu: null as Menu | null,
  cinema: false,
})

// ---- Navigation, with back / forward history ----

export const nav = $state({ history: [{ view: 'albums' }] as Route[], index: 0 })

export function route(): Route {
  return nav.history[nav.index]
}

export function go(r: Route) {
  const cur = route()
  if (cur.view === r.view && ('key' in cur ? cur.key : '') === ('key' in r ? r.key : '')) return
  nav.history = [...nav.history.slice(0, nav.index + 1), r]
  nav.index = nav.history.length - 1
}

export function back() {
  if (nav.index > 0) nav.index--
}

export function forward() {
  if (nav.index < nav.history.length - 1) nav.index++
}

// ---- Library grouped like Spotify ----

export type Album = {
  key: string
  title: string
  artist: string
  artistKey: string
  tracks: library.Track[]
  duration: number
}

export type Artist = { key: string; name: string; albums: Album[]; tracks: library.Track[] }

export const artistKey = (name: string) => name.toLowerCase()
export const albumKey = (t: library.Track) => `${artistKey(t.group)}\u0000${t.album.toLowerCase()}`

class Lib {
  byId = $derived(new Map(app.tracks.map((t) => [t.id, t])))

  /** Tracks come sorted by artist, album, disc, number from the Go side, so the order is kept. */
  albums = $derived.by(() => {
    const out = new Map<string, Album>()
    for (const t of app.tracks) {
      const key = albumKey(t)
      let a = out.get(key)
      if (!a) {
        a = { key, title: t.album, artist: t.group, artistKey: artistKey(t.group), tracks: [], duration: 0 }
        out.set(key, a)
      }
      a.tracks.push(t)
      a.duration += t.duration
    }
    return out
  })

  artists = $derived.by(() => {
    const out = new Map<string, Artist>()
    for (const a of this.albums.values()) {
      let ar = out.get(a.artistKey)
      if (!ar) {
        ar = { key: a.artistKey, name: a.artist, albums: [], tracks: [] }
        out.set(a.artistKey, ar)
      }
      ar.albums.push(a)
      ar.tracks.push(...a.tracks)
    }
    return out
  })

  /** Playlist entries still in the library, with their position in the playlist (for removal). */
  playlistTracks(p: playlist.Playlist) {
    const out: { track: library.Track; index: number }[] = []
    p.trackIds.forEach((id, index) => {
      const track = this.byId.get(id)
      if (track) out.push({ track, index })
    })
    return out
  }
}

export const lib = new Lib()

/** One track id per distinct album (up to 4), for a cover or a 2×2 mosaic. */
export function coverIds(tracks: library.Track[]): string[] {
  const seen = new Map<string, string>()
  for (const t of tracks) {
    if (!seen.has(albumKey(t))) seen.set(albumKey(t), t.id)
    if (seen.size === 4) break
  }
  return [...seen.values()]
}

export const albumTitle =(title: string) => title || 'Sans album'
export const artistName = (name: string) => name || 'Artiste inconnu'

// ---- Music folder ----

export async function chooseFolder() {
  try {
    const dir = await ChooseMusicFolder()
    app.notice = ''
    if (dir) app.settings.musicDir = dir
  } catch (e) {
    app.notice = String(e instanceof Error ? e.message : e)
  }
}

// ---- Playback helpers ----

export function playTracks(tracks: library.Track[], start = 0) {
  if (tracks.length) PlayQueue(tracks.map((t) => t.id), start)
}

export function shufflePlay(tracks: library.Track[]) {
  if (!tracks.length) return
  if (!app.settings.shuffle) {
    app.settings.shuffle = true
    SetShuffle(true)
  }
  playTracks(tracks, Math.floor(Math.random() * tracks.length))
}

// ---- Formatting ----

export function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Total length of a list, "1 h 12 min" or "38 min 05 s". */
export function fmtLong(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h) return `${h} h ${m} min`
  return `${m} min ${Math.floor(sec % 60).toString().padStart(2, '0')} s`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? 's' : ''}`
}

/** CSS background fill for a styled range input. */
export function fill(value: number, min: number, max: number): string {
  return `--fill:${((value - min) / (max - min)) * 100}%`
}

/**
 * Window full screen. The web Fullscreen API goes through the webview, which tiling
 * compositors (Hyprland) honour where Wails' own request is ignored; both are sent.
 * Must be called from a click or key handler.
 */
export function setFullscreen(on: boolean) {
  if (on) {
    document.documentElement.requestFullscreen?.().catch(() => {})
    WindowFullscreen()
  } else {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    WindowUnfullscreen()
  }
}

export function toggleFullscreen() {
  setFullscreen(!document.fullscreenElement)
}

/** "Now playing" view over the whole window. Full screen is separate (F11). */
export function toggleCinema() {
  app.cinema = !app.cinema
  if (app.cinema) {
    app.panel = null
    app.menu = null
  }
}

/** The window left full screen from outside (compositor shortcut, Escape in the webview): keep Wails in sync. */
export function onFullscreenLeft() {
  WindowUnfullscreen()
}
