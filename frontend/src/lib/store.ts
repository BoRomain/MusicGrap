import { create } from 'zustand'
import type { CSSProperties } from 'react'
import { ChooseMusicFolder, PlayQueue, ScanLibrary, SetShuffle, WindowFullscreen, WindowUnfullscreen } from '$backend'
import type { audio, core, library, playlist, settings } from '../../wailsjs/go/models'

export type Panel = 'queue' | 'eq' | 'slowed' | 'fade'

export type Route =
  | { view: 'albums' | 'artists' | 'songs' | 'search' }
  | { view: 'album' | 'artist' | 'playlist'; key: string }

/** Right-click menu on one or more tracks; index is the position in the playlist being shown. */
export type Menu = { x: number; y: number; tracks: library.Track[]; playlistId?: string; index?: number }

// ---- Library grouped like Spotify ----

export type AlbumKind = 'album' | 'ep' | 'single'

export type Album = {
  key: string
  title: string
  artist: string
  artistKey: string
  tracks: library.Track[]
  duration: number
  kind: AlbumKind
  /** Earliest release date among its tracks, '' when untagged. */
  date: string
}

/** cover is the id of the artist's latest released track, whose artwork stands for the artist. */
export type Artist = { key: string; name: string; albums: Album[]; tracks: library.Track[]; cover: string }

export type Lib = {
  byId: Map<string, library.Track>
  albums: Map<string, Album>
  artists: Map<string, Artist>
}

export const artistKey = (name: string) => name.toLowerCase()
export const albumKey = (t: library.Track) => `${artistKey(t.group)}\u0000${t.album.toLowerCase()}`

/** Spotify's rule: under 30 min, 1–3 tracks is a single and 4–6 an EP. Loose tracks stay an album. */
function albumKind(a: Album): AlbumKind {
  if (!a.title || a.duration >= 30 * 60) return 'album'
  if (a.tracks.length <= 3) return 'single'
  if (a.tracks.length <= 6) return 'ep'
  return 'album'
}

/** Tracks come sorted by artist, album, disc, number from the Go side, so the order is kept. */
function buildLib(tracks: library.Track[]): Lib {
  const byId = new Map(tracks.map((t) => [t.id, t]))
  const albums = new Map<string, Album>()
  for (const t of tracks) {
    const key = albumKey(t)
    let a = albums.get(key)
    if (!a) {
      a = { key, title: t.album, artist: t.group, artistKey: artistKey(t.group), tracks: [], duration: 0, kind: 'album', date: '' }
      albums.set(key, a)
    }
    a.tracks.push(t)
    a.duration += t.duration
    if (t.date && (!a.date || t.date < a.date)) a.date = t.date
  }
  for (const a of albums.values()) a.kind = albumKind(a)

  const artists = new Map<string, Artist>()
  for (const a of albums.values()) {
    let ar = artists.get(a.artistKey)
    if (!ar) {
      ar = { key: a.artistKey, name: a.artist, albums: [], tracks: [], cover: a.tracks[0].id }
      artists.set(a.artistKey, ar)
    }
    ar.albums.push(a)
    ar.tracks.push(...a.tracks)
  }
  // Latest dated track wins; without any date, the first track is kept.
  for (const ar of artists.values()) {
    let date = ''
    for (const t of ar.tracks) if (t.date > date) [date, ar.cover] = [t.date, t.id]
  }
  return { byId, albums, artists }
}

/** Playlist entries still in the library, with their position in the playlist (for removal). */
export function playlistTracks(lib: Lib, p: playlist.Playlist) {
  const out: { track: library.Track; index: number }[] = []
  p.trackIds.forEach((id, index) => {
    const track = lib.byId.get(id)
    if (track) out.push({ track, index })
  })
  return out
}

// ---- Store ----

export type AppState = {
  tracks: library.Track[]
  /** Derived from tracks, rebuilt by setTracks. */
  lib: Lib
  playlists: playlist.Playlist[]
  settings: settings.Settings
  presets: Record<string, number[]>
  bands: number[]
  now: core.NowPlaying | null
  state: audio.State
  scan: { done: number; total: number } | null
  audioError: string
  /** Error from the last user action (folder picker, permissions...), shown in a banner. */
  notice: string
  panel: Panel | null
  query: string
  menu: Menu | null
  cinema: boolean
  /** Phone navigation menu (replaces the sidebar). */
  drawer: boolean
  /** Navigation, with back / forward history. */
  history: Route[]
  index: number
}

export const useApp = create<AppState>()(() => ({
  tracks: [],
  lib: buildLib([]),
  playlists: [],
  settings: {} as settings.Settings,
  presets: {},
  bands: [],
  now: null,
  state: { position: 0, duration: 0, paused: true, hasTrack: false } as audio.State,
  scan: null,
  audioError: '',
  notice: '',
  panel: null,
  query: '',
  menu: null,
  cinema: false,
  drawer: false,
  history: [{ view: 'albums' }],
  index: 0,
}))

const set = useApp.setState
const get = useApp.getState

export function setTracks(tracks: library.Track[]) {
  set({ tracks, lib: buildLib(tracks) })
}

export function patchSettings(p: Partial<settings.Settings>) {
  set((s) => ({ settings: { ...s.settings, ...p } as settings.Settings }))
}

export function patchState(p: Partial<audio.State>) {
  set((s) => ({ state: { ...s.state, ...p } as audio.State }))
}

export const setPanel = (panel: Panel | null) => set({ panel })
export const togglePanel = (p: Panel) => set((s) => ({ panel: s.panel === p ? null : p }))
export const setMenu = (menu: Menu | null) => set({ menu })
export const setDrawer = (drawer: boolean) => set({ drawer })
export const setQuery = (query: string) => set({ query })

// ---- Navigation ----

export const route = (s: Pick<AppState, 'history' | 'index'> = get()): Route => s.history[s.index]
export const useRoute = () => useApp((s) => s.history[s.index])

export function go(r: Route) {
  const s = get()
  const cur = route(s)
  if (cur.view === r.view && ('key' in cur ? cur.key : '') === ('key' in r ? r.key : '')) return
  const history = [...s.history.slice(0, s.index + 1), r]
  set({ history, index: history.length - 1 })
}

export function back() {
  const { index } = get()
  if (index > 0) set({ index: index - 1 })
}

export function forward() {
  const { index, history } = get()
  if (index < history.length - 1) set({ index: index + 1 })
}

/** One track id per distinct album (up to 4), for a cover or a 2×2 mosaic. */
export function coverIds(tracks: library.Track[]): string[] {
  const seen = new Map<string, string>()
  for (const t of tracks) {
    if (!seen.has(albumKey(t))) seen.set(albumKey(t), t.id)
    if (seen.size === 4) break
  }
  return [...seen.values()]
}

export const albumTitle = (title: string) => title || 'Sans album'
export const artistName = (name: string) => name || 'Artiste inconnu'

export const albumKinds: AlbumKind[] = ['album', 'ep', 'single']
export const kindLabel: Record<AlbumKind, string> = { album: 'Album', ep: 'EP', single: 'Single' }
export const kindPlural: Record<AlbumKind, string> = { album: 'Albums', ep: 'EP', single: 'Singles' }
/** "2 albums", "1 EP", "3 singles". */
export const kindCount = (n: number, k: AlbumKind) => (k === 'ep' ? `${n} EP` : plural(n, kindLabel[k].toLowerCase()))

// ---- Music folder ----

const errText = (e: unknown) => String(e instanceof Error ? e.message : e)

export async function chooseFolder() {
  try {
    const dir = await ChooseMusicFolder()
    set({ notice: '' })
    if (dir) patchSettings({ musicDir: dir })
  } catch (e) {
    set({ notice: errText(e) })
  }
}

/** Rescans the library (on Android, asks for the media permission first if needed). */
export async function scanLibrary() {
  try {
    await ScanLibrary()
    set({ notice: '' })
  } catch (e) {
    set({ notice: errText(e) })
  }
}

// ---- Playback helpers ----

export function playTracks(tracks: library.Track[], start = 0) {
  if (tracks.length) PlayQueue(tracks.map((t) => t.id), start)
}

export function shufflePlay(tracks: library.Track[]) {
  if (!tracks.length) return
  if (!get().settings.shuffle) {
    patchSettings({ shuffle: true })
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

/** CSS fill of a styled range input (seek bar, volume). */
export function fill(value: number, min: number, max: number): CSSProperties {
  return { '--fill': `${((value - min) / (max - min)) * 100}%` } as CSSProperties
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
  const cinema = !get().cinema
  set(cinema ? { cinema, panel: null, menu: null } : { cinema })
}

/** The window left full screen from outside (compositor shortcut, Escape in the webview): keep Wails in sync. */
export function onFullscreenLeft() {
  WindowUnfullscreen()
}
