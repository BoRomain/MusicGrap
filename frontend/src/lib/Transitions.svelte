<script lang="ts">
  import { SetCrossfade, SetCrossfadeOnSkip } from '$backend'
  import { app, fill } from './store.svelte'

  function setCrossfade(v: number) {
    app.settings.crossfade = v
    SetCrossfade(v)
  }
</script>

<div class="transitions">
  <label>
    <span class="row">
      <span>Fondu enchaîné</span>
      <b>{app.settings.crossfade === 0 ? 'Désactivé · enchaînement sans blanc' : `${app.settings.crossfade} s`}</b>
    </span>
    <input
      type="range"
      min="0"
      max="12"
      step="1"
      value={app.settings.crossfade}
      style={fill(app.settings.crossfade, 0, 12)}
      oninput={(e) => setCrossfade(+e.currentTarget.value)}
    />
    <span class="hint">La fin d'un titre se fond dans le début du suivant. La durée reste la même en mode slowed.</span>
  </label>

  <label class="check">
    <input
      type="checkbox"
      checked={app.settings.crossfadeOnSkip}
      onchange={(e) => {
        app.settings.crossfadeOnSkip = e.currentTarget.checked
        SetCrossfadeOnSkip(e.currentTarget.checked)
      }}
    />
    <span>Fondu aussi quand je change de titre manuellement</span>
  </label>
</div>

<style>
  .transitions { display: flex; flex-direction: column; gap: 20px; }
  label { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; justify-content: space-between; font-size: 13px; }
  .row b { font-weight: 400; color: var(--text-dim); }
  .hint { font-size: 12px; color: var(--text-dim); }
  .check { flex-direction: row; align-items: center; gap: 10px; font-size: 13px; cursor: pointer; }
  .check input { accent-color: var(--accent); width: 16px; height: 16px; }
</style>
