<script lang="ts">
  import { SetEQBand, SetEQPreset } from '$backend'
  import { app, fill } from './store.svelte'

  const presetNames = ['Flat', 'Bass Boost', 'Treble Boost', 'Vocal', 'Rock', 'Electronic', 'Hip-Hop', 'Lo-Fi']

  function label(hz: number) {
    return hz >= 1000 ? `${hz / 1000}k` : `${hz}`
  }

  function setBand(i: number, db: number) {
    app.settings.eq[i] = db
    app.settings.eqPreset = 'Custom'
    SetEQBand(i, db)
  }

  async function applyPreset(name: string) {
    app.settings.eqPreset = name
    app.settings.eq = await SetEQPreset(name)
  }
</script>

<div class="eq">
  <div class="presets">
    {#each presetNames as name}
      <button class:active={app.settings.eqPreset === name} onclick={() => applyPreset(name)}>{name}</button>
    {/each}
    {#if app.settings.eqPreset === 'Custom'}<span class="custom">Personnalisé</span>{/if}
  </div>

  <div class="bands">
    {#each app.bands as hz, i}
      {@const db = app.settings.eq?.[i] ?? 0}
      <div class="band">
        <span class="db">{db > 0 ? '+' : ''}{db.toFixed(0)}</span>
        <div class="slot">
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={db}
            style={fill(db, -12, 12)}
            oninput={(e) => setBand(i, +e.currentTarget.value)}
            ondblclick={() => setBand(i, 0)}
            title="Double-clic pour remettre à 0"
          />
        </div>
        <span class="hz">{label(hz)}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .presets { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 16px; }
  .presets button, .custom {
    padding: 5px 12px;
    border-radius: 999px;
    background: var(--surface);
    font-size: 12px;
  }
  .presets button:hover { background: var(--surface-hover); }
  .presets button.active { background: var(--accent); color: #111; font-weight: 700; }
  .custom { color: var(--accent); background: none; }
  .bands { display: flex; justify-content: space-between; gap: 4px; }
  .band { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
  .db, .hz { font-size: 11px; color: var(--text-dim); font-variant-numeric: tabular-nums; }
  /* Vertical slider: a horizontal range rotated inside a fixed slot (works on every webview). */
  .slot { position: relative; width: 24px; height: 130px; }
  .slot input {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 130px;
    transform: translate(-50%, -50%) rotate(-90deg);
  }
</style>
