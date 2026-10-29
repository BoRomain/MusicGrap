<script lang="ts">
  import { SetReverb, SetSpeed } from '$backend'
  import { app, fill } from './store.svelte'

  const presets = [
    { name: 'Normal', speed: 1, wet: 0, room: 0.6 },
    { name: 'Slowed', speed: 0.85, wet: 0.15, room: 0.6 },
    { name: 'Slowed + Reverb', speed: 0.8, wet: 0.4, room: 0.85 },
    { name: 'Ultra slowed', speed: 0.7, wet: 0.55, room: 0.95 },
  ]

  const semitones = $derived(12 * Math.log2(app.settings.speed || 1))

  function setSpeed(v: number) {
    app.settings.speed = v
    SetSpeed(v)
  }

  function setReverb(wet: number, room: number) {
    app.settings.reverbWet = wet
    app.settings.reverbRoom = room
    SetReverb(wet, room)
  }

  function apply(p: (typeof presets)[number]) {
    setSpeed(p.speed)
    setReverb(p.wet, p.room)
  }

  const isActive = (p: (typeof presets)[number]) =>
    Math.abs(app.settings.speed - p.speed) < 0.001 &&
    Math.abs(app.settings.reverbWet - p.wet) < 0.001 &&
    Math.abs(app.settings.reverbRoom - p.room) < 0.001
</script>

<div class="slowed">
  <div class="presets">
    {#each presets as p}
      <button class:active={isActive(p)} onclick={() => apply(p)}>{p.name}</button>
    {/each}
  </div>

  <label>
    <span class="row"><span>Vitesse</span><b>{app.settings.speed.toFixed(2)}x · {semitones.toFixed(1)} demi-tons</b></span>
    <input
      type="range"
      min="0.5"
      max="1"
      step="0.01"
      value={app.settings.speed}
      style={fill(app.settings.speed, 0.5, 1)}
      oninput={(e) => setSpeed(+e.currentTarget.value)}
    />
  </label>

  <label>
    <span class="row"><span>Reverb</span><b>{Math.round(app.settings.reverbWet * 100)} %</b></span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={app.settings.reverbWet}
      style={fill(app.settings.reverbWet, 0, 1)}
      oninput={(e) => setReverb(+e.currentTarget.value, app.settings.reverbRoom)}
    />
  </label>

  <label>
    <span class="row"><span>Taille de la salle</span><b>{Math.round(app.settings.reverbRoom * 100)} %</b></span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={app.settings.reverbRoom}
      style={fill(app.settings.reverbRoom, 0, 1)}
      oninput={(e) => setReverb(app.settings.reverbWet, +e.currentTarget.value)}
    />
  </label>
</div>

<style>
  .slowed { display: flex; flex-direction: column; gap: 18px; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; }
  .presets button {
    padding: 5px 12px;
    border-radius: 999px;
    background: var(--surface);
    font-size: 12px;
  }
  .presets button:hover { background: var(--surface-hover); }
  .presets button.active { background: var(--accent); color: #111; font-weight: 700; }
  label { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; justify-content: space-between; font-size: 13px; }
  .row b { font-weight: 400; color: var(--text-dim); font-variant-numeric: tabular-nums; }
</style>
