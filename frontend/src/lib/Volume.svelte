<script lang="ts">
  import { SetVolume } from '../../wailsjs/go/main/App'
  import { app, fill } from './store.svelte'
  import Icon from './Icon.svelte'

  function setVolume(v: number) {
    app.settings.volume = v
    SetVolume(v)
  }
</script>

<div class="volume">
  <button onclick={() => setVolume(app.settings.volume > 0 ? 0 : 0.8)} title="Muet">
    <Icon name={app.settings.volume > 0 ? 'volume' : 'mute'} size={18} />
  </button>
  <input
    type="range"
    min="0"
    max="1"
    step="0.01"
    value={app.settings.volume}
    style={fill(app.settings.volume, 0, 1)}
    oninput={(e) => setVolume(+e.currentTarget.value)}
  />
</div>

<style>
  .volume { display: flex; align-items: center; gap: 6px; width: 130px; }
  button { display: grid; padding: 4px; color: var(--text-dim); transition: color 0.12s; }
  button:hover { color: var(--text); }
  /* Only the mute button in narrow windows (outside cinema mode, which has room for it). */
  @media (max-width: 900px) {
    :global(.bar) .volume { width: auto; }
    :global(.bar) input { display: none; }
  }
</style>
