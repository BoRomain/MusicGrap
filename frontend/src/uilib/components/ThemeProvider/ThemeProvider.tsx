import type { CSSProperties, HTMLAttributes } from 'react';
import { cx, hexToRgb } from '../../utils';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeProviderProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Color scheme. `dark` (default), `light`, or `system` to follow the OS preference.
   * Leave undefined to inherit a `data-ui-theme` set on an ancestor (e.g. `<html>`).
   */
  theme?: ThemeMode;
  /** Accent color as hex (#8b7cf6). */
  accent?: string;
  /** Any other token override, keys without the `--ui-` prefix: { 'surface': '#222' }. */
  tokens?: Record<string, string>;
  /** Fill the viewport and apply safe-area padding (Capacitor / popup root). */
  fill?: boolean;
}

/** Root wrapper: applies font, colors, theme and token overrides to its subtree. */
export function ThemeProvider({ theme, accent, tokens, fill, className, style, ...rest }: ThemeProviderProps) {
  const vars: Record<string, string> = {};
  if (accent) {
    vars['--ui-accent'] = accent;
    const rgb = hexToRgb(accent);
    if (rgb) vars['--ui-accent-rgb'] = rgb;
  }
  if (tokens) for (const [k, v] of Object.entries(tokens)) vars[`--ui-${k}`] = v;
  return (
    <div
      className={cx('ui-root', fill && 'ui-root--fill', className)}
      data-ui-theme={theme}
      style={{ ...(vars as CSSProperties), ...style }}
      {...rest}
    />
  );
}
