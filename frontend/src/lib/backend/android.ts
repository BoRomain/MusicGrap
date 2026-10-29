// Android backend: the same Go core, compiled with gomobile and reached through
// the "Wave" Capacitor plugin (android/app/src/main/java/com/borom/wave/WavePlugin.kt).
// Exports mirror backend/wails.ts so components work unchanged.
import { registerPlugin } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import type { core, library, playlist } from '../../../wailsjs/go/models'

interface WavePlugin {
  call(opts: { method: string; args: string }): Promise<{ result: string }>
  chooseFolder(): Promise<{ dir: string }>
  coverBaseUrl(): Promise<{ url: string }>
  addListener(event: 'event', fn: (e: { name: string; payload: string }) => void): Promise<{ remove: () => void }>
}

const Wave = registerPlugin<WavePlugin>('Wave')

async function call<T = void>(method: string, ...args: unknown[]): Promise<T> {
  const { result } = await Wave.call({ method, args: JSON.stringify(args) })
  return JSON.parse(result) as T
}

// Covers come from a local HTTP server in the Go core; its port is known once started.
let coverBase = ''
const ready = Wave.coverBaseUrl().then(({ url }) => (coverBase = url))

export const coverUrl = (id: string) => coverBase + id

export const GetInitialState = async () => {
  await ready
  return call<core.InitState>('GetInitialState')
}
export const ChooseMusicFolder = () => Wave.chooseFolder().then((r) => r.dir)
export const ScanLibrary = () => call('ScanLibrary')
export const GetTracks = () => call<library.Track[]>('GetTracks')
export const GetQueue = () => call<library.Track[]>('GetQueue')
export const PlayQueue = (ids: string[], start: number) => call('PlayQueue', ids, start)
export const TogglePause = () => call('TogglePause')
export const Next = () => call('Next')
export const Prev = () => call('Prev')
export const Seek = (sec: number) => call('Seek', sec)
export const SetVolume = (v: number) => call('SetVolume', v)
export const SetEQBand = (band: number, db: number) => call('SetEQBand', band, db)
export const SetEQPreset = (name: string) => call<number[]>('SetEQPreset', name)
export const SetSpeed = (speed: number) => call('SetSpeed', speed)
export const SetReverb = (wet: number, room: number) => call('SetReverb', wet, room)
export const SetCrossfade = (sec: number) => call('SetCrossfade', sec)
export const SetCrossfadeOnSkip = (on: boolean) => call('SetCrossfadeOnSkip', on)
export const SetShuffle = (on: boolean) => call('SetShuffle', on)
export const SetRepeat = (mode: string) => call('SetRepeat', mode)
export const CreatePlaylist = (name: string) => call<playlist.Playlist>('CreatePlaylist', name)
export const RenamePlaylist = (id: string, name: string) => call('RenamePlaylist', id, name)
export const DeletePlaylist = (id: string) => call('DeletePlaylist', id)
export const AddToPlaylist = (id: string, trackIds: string[]) => call('AddToPlaylist', id, trackIds)
export const RemoveFromPlaylist = (id: string, index: number) => call('RemoveFromPlaylist', id, index)

// One native listener fans events out by name, like the Wails runtime.
const handlers = new Map<string, Set<(data: any) => void>>()
Wave.addListener('event', ({ name, payload }) => {
  const data = JSON.parse(payload)
  handlers.get(name)?.forEach((fn) => fn(data))
})

export function EventsOn(name: string, fn: (data: any) => void): () => void {
  let set = handlers.get(name)
  if (!set) handlers.set(name, (set = new Set()))
  set.add(fn)
  return () => set.delete(fn)
}

// The app already fills the screen; the web Fullscreen API also hides the system bars.
export const WindowFullscreen = () => {}
export const WindowUnfullscreen = () => {}

/** Android back button: run the handler, or leave the app when it returns false. */
export function onBackButton(fn: () => boolean) {
  CapApp.addListener('backButton', () => {
    if (!fn()) CapApp.minimizeApp()
  })
}
