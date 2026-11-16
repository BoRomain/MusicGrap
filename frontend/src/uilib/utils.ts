import type { ReactNode } from 'react';
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function snap(v: number, min: number, step: number): number {
  if (step <= 0) return v;
  const snapped = Math.round((v - min) / step) * step + min;
  // Remove floating point noise based on step precision.
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number(snapped.toFixed(decimals));
}

export function hexToRgb(hex: string): string | null {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export type Option<T extends string> =
  | T
  | {
      value: T;
      label?: ReactNode;
      disabled?: boolean;
      /** Icon shown before the label (Select). */
      icon?: ReactNode;
      /** Second line under the label (Select dropdown). */
      description?: ReactNode;
    };

export function normalizeOption<T extends string>(o: Option<T>) {
  return typeof o === 'string' ? { value: o, label: o as ReactNode, disabled: false, icon: undefined as ReactNode, description: undefined as ReactNode } : { label: o.value, disabled: false, ...o };
}
