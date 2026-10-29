// Desktop backend: the Go App bound by Wails.
export * from '../../../wailsjs/go/main/App'
export { EventsOn, WindowFullscreen, WindowUnfullscreen } from '../../../wailsjs/runtime/runtime'

/** URL of a track's artwork, served by the Wails asset server. */
export const coverUrl = (id: string) => `/cover/${id}`

/** Android back button: nothing to do on desktop. */
export function onBackButton(_fn: () => boolean) {}
