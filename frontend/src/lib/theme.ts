import type { palette } from '../../wailsjs/go/models'

/** Applies a cover palette; :root transitions the registered color properties. */
export function applyPalette(p: palette.Palette) {
  const root = document.documentElement.style
  root.setProperty('--bg1', p.bg1)
  root.setProperty('--bg2', p.bg2)
  root.setProperty('--accent', p.accent)
  root.setProperty('--text', p.text)
}
