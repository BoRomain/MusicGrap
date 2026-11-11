/**
 * Slowed + reverb panel, built from UiLib's PlayerTemplate:
 * hero speed value, preset chips, then the reverb sliders in a card.
 */
import { Card, ChipGroup, HeroDisplay, Slider } from '@romain/uilib'
import { SetReverb, SetSpeed } from '$backend'
import { patchSettings, useApp } from './store'

const PRESETS = [
  { name: 'Normal', speed: 1, wet: 0, room: 0.6 },
  { name: 'Slowed', speed: 0.85, wet: 0.15, room: 0.6 },
  { name: 'Slowed + Reverb', speed: 0.8, wet: 0.4, room: 0.85 },
  { name: 'Ultra slowed', speed: 0.7, wet: 0.55, room: 0.95 },
] as const
type PresetName = (typeof PRESETS)[number]['name']

function setSpeed(v: number) {
  patchSettings({ speed: v })
  SetSpeed(v)
}

function setReverb(wet: number, room: number) {
  patchSettings({ reverbWet: wet, reverbRoom: room })
  SetReverb(wet, room)
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.001
const percent = (v: number) => `${Math.round(v * 100)} %`

export function SlowedPanel() {
  const speed = useApp((s) => s.settings.speed) || 1
  const wet = useApp((s) => s.settings.reverbWet) ?? 0
  const room = useApp((s) => s.settings.reverbRoom) ?? 0
  const playing = useApp((s) => s.state.hasTrack && !s.state.paused)

  const semitones = 12 * Math.log2(speed)
  const active = PRESETS.find((p) => near(speed, p.speed) && near(wet, p.wet) && near(room, p.room))?.name

  function apply(name: PresetName) {
    const p = PRESETS.find((x) => x.name === name)!
    setSpeed(p.speed)
    setReverb(p.wet, p.room)
  }

  return (
    <div className="panel-stack">
      <HeroDisplay
        label="Vitesse"
        value={speed}
        onChange={setSpeed}
        min={0.5}
        max={1}
        step={0.01}
        resetValue={1}
        unit="×"
        format={(v) => v.toFixed(2)}
        sub={`${semitones.toFixed(1)} demi-tons`}
        spinning={playing}
      />

      {/* Remounted when no preset matches, so no chip stays selected. */}
      <ChipGroup
        key={active ?? 'custom'}
        aria-label="Préréglages"
        options={PRESETS.map((p) => p.name)}
        value={active}
        onChange={apply}
      />

      <Card>
        <Slider label="Reverb" value={wet} onChange={(v) => setReverb(v, room)} min={0} max={1} step={0.01} format={percent} />
        <Slider
          label="Taille de la salle"
          value={room}
          onChange={(v) => setReverb(wet, v)}
          min={0}
          max={1}
          step={0.01}
          resetValue={0.6}
          format={percent}
        />
      </Card>
    </div>
  )
}
