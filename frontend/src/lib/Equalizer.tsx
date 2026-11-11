import { useEffect, useRef, useState } from 'react'
import { ChipGroup } from '@romain/uilib'
import { isMobile, SetEQGains, SetEQPreset } from '$backend'
import { bandsCurve, clamp, DEFAULT_HZ, MAX_DB, pointsCurve, sample, ZONES, type Point } from './eqCurve'
import { EqCurve } from './EqCurve'
import { patchSettings, useApp } from './store'

const PRESET_NAMES = ['Flat', 'Bass Boost', 'Treble Boost', 'Vocal', 'Rock', 'Electronic', 'Hip-Hop', 'Lo-Fi']

// Kept while the app runs, so the points stay put when the panel closes.
// db is null while the curve follows the band gains (preset or saved settings).
const memory = { hz: [...DEFAULT_HZ], db: null as number[] | null }

export function Equalizer() {
  const eq = useApp((s) => s.settings.eq)
  const preset = useApp((s) => s.settings.eqPreset)
  const bands = useApp((s) => s.bands)

  const [points, setPoints] = useState<Point[]>(() => memory.hz.map((hz, i) => ({ hz, db: memory.db?.[i] ?? 0 })))
  /** True once the user dragged a point: the curve then comes from the 3 points. */
  const [editing, setEditing] = useState(() => memory.db !== null && preset === 'Custom')

  const curve = editing ? pointsCurve(points) : bandsCurve(eq ?? [], bands)
  /** Points as drawn: on the band curve until the user edits them. */
  const shown = editing ? points : points.map((p) => ({ hz: p.hz, db: curve(p.hz) }))

  // ---- Sending the gains, at most once per frame ----

  const latest = useRef(points)
  const frame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  function push(next: Point[]) {
    latest.current = next
    memory.hz = next.map((p) => p.hz)
    memory.db = next.map((p) => p.db)
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const gains = sample(pointsCurve(latest.current), bands)
      patchSettings({ eq: gains, eqPreset: 'Custom' })
      SetEQGains(gains)
    })
  }

  function move(i: number, hz: number, db: number) {
    // Points take over from the band curve, starting where they are drawn.
    const base = editing ? points : shown.map((p) => ({ hz: p.hz, db: Math.round(p.db * 2) / 2 }))
    const next = base.slice()
    next[i] = { hz: clamp(hz, ...ZONES[i]), db: clamp(Math.round(db * 2) / 2, -MAX_DB, MAX_DB) }
    setEditing(true)
    setPoints(next)
    push(next)
  }

  async function applyPreset(name: string) {
    setEditing(false)
    memory.db = null
    patchSettings({ eqPreset: name })
    const gains = await SetEQPreset(name)
    patchSettings({ eq: gains })
  }

  const custom = preset === 'Custom'

  return (
    <div className="panel-stack">
      {/* Remounted on "Custom", so no chip stays selected. */}
      <ChipGroup
        key={custom ? 'custom' : 'preset'}
        aria-label="Préréglages de l'égaliseur"
        options={PRESET_NAMES}
        value={custom ? undefined : preset}
        onChange={applyPreset}
      />
      {custom && <span className="eq-custom">Personnalisé</span>}
      <EqCurve curve={curve} points={shown} bands={bands} onMove={move} />
      <span className="hint">Glissez les points. {isMobile ? 'Double tap' : 'Double-clic'} : retour à 0 dB.</span>
    </div>
  )
}
