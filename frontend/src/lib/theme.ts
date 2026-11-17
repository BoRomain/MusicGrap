import { isMobile } from '$backend'
import type { palette } from '../../wailsjs/go/models'

/** Same as palette.Default on the Go side, used until the first track loads. */
export const defaultPalette: palette.Palette = { bg1: '#1b2030', bg2: '#3a2350', accent: '#b388ff', text: '#ffffff' }

/** Mixes a #rrggbb color with black: amount 0 keeps it, 1 gives black. */
function darken(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const ch = (shift: number) => Math.round(((n >> shift) & 0xff) * (1 - amount)).toString(16).padStart(2, '0')
  return `#${ch(16)}${ch(8)}${ch(0)}`
}

/** On desktop the large window makes the cover colors too loud: the backgrounds are dimmed. */
function forDisplay(p: palette.Palette): palette.Palette {
  if (isMobile) return p
  return { ...p, bg1: darken(p.bg1, 0.45), bg2: darken(p.bg2, 0.45) }
}

/** Applies a cover palette; :root transitions the registered color properties. */
export function applyPalette(raw: palette.Palette) {
  const p = forDisplay(raw)
  const root = document.documentElement.style
  root.setProperty('--bg1', p.bg1)
  root.setProperty('--bg2', p.bg2)
  root.setProperty('--accent', p.accent)
  root.setProperty('--text', p.text)
}

/** Props of the UiLib ThemeProvider for a cover palette: accent plus the --ui-* tokens. */
export function uiTheme(raw: palette.Palette): { accent: string; tokens: Record<string, string> } {
  const p = forDisplay(raw)
  return {
    accent: p.accent,
    tokens: {
      // Dark text on the bright cover accents, like the app's own buttons.
      'on-accent': '#111111',
      bg: p.bg1,
      text: p.text,
      'text-muted': `color-mix(in srgb, ${p.text} 62%, transparent)`,
      'text-dim': `color-mix(in srgb, ${p.text} 45%, transparent)`,
      surface: 'rgba(255, 255, 255, 0.06)',
      'surface-2': 'rgba(0, 0, 0, 0.2)',
      'surface-3': 'rgba(255, 255, 255, 0.11)',
      border: 'rgba(255, 255, 255, 0.09)',
      'border-strong': 'rgba(255, 255, 255, 0.16)',
      'hero-bg': `color-mix(in srgb, ${p.bg2} 70%, ${p.bg1})`,
      'hero-bg-hover': `color-mix(in srgb, ${p.bg2} 85%, ${p.bg1})`,
      font: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Ubuntu", "Cantarell", "Helvetica Neue", sans-serif',
    },
  }
}
