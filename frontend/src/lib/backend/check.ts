// Type check only (not imported at runtime): the Android backend must export
// everything the desktop one does, with compatible signatures.
import * as android from './android'
import type * as wails from './wails'

export const _sameApi: typeof wails = android
