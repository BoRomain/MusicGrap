// Curve editor maths for the equalizer. The audio engine stays a 10-band EQ:
// the curve is drawn in log-frequency space and sampled at the band centres.

export const MIN_HZ = 20
export const MAX_HZ = 20000
export const MAX_DB = 12

export type Point = { hz: number; db: number }

/** Frequency range of each point (low, mid, high), so they never cross. */
export const ZONES: [number, number][] = [
  [20, 250],
  [250, 4000],
  [4000, 20000],
]

export const DEFAULT_HZ = [80, 1000, 8000]

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Monotone cubic interpolation (Fritsch–Carlson) through (xs, ys), xs ascending.
 * No overshoot between points, and flat outside the first and last point.
 */
export function monotone(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  if (n === 0) return () => 0
  if (n === 1) return () => ys[0]
  const d: number[] = [] // secant slopes
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i] || 1e-9))
  const m: number[] = [d[0]]
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2)
  m.push(d[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }
  // Flat ends: zero slope at the first and last point.
  m[0] = 0
  m[n - 1] = 0
  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    )
  }
}

/** Curve through the 3 points, as a function of the frequency. */
export function pointsCurve(points: Point[]): (hz: number) => number {
  const f = monotone(points.map((p) => Math.log10(p.hz)), points.map((p) => p.db))
  return (hz) => f(Math.log10(hz))
}

/** Curve through the 10 band gains (presets, saved settings). */
export function bandsCurve(gains: number[], bands: number[]): (hz: number) => number {
  const f = monotone(bands.map(Math.log10), bands.map((_, i) => gains[i] ?? 0))
  return (hz) => f(Math.log10(hz))
}

/** Band gains sampled from a curve, rounded to 0.5 dB. */
export function sample(curve: (hz: number) => number, bands: number[]): number[] {
  return bands.map((hz) => clamp(Math.round(curve(hz) * 2) / 2, -MAX_DB, MAX_DB))
}

/** "80 Hz", "1.2 kHz". */
export function fmtHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)} kHz` : `${Math.round(hz)} Hz`
}

/** "+4.5 dB", "0 dB". */
export function fmtDb(db: number): string {
  return `${db > 0 ? '+' : ''}${db.toFixed(1).replace(/\.0$/, '')} dB`
}
