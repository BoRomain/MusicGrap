<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Next, Prev, Seek, SetRepeat, SetShuffle, TogglePause } from '$backend'
  import { app, fill, fmtTime } from './store.svelte'
  import Icon from './Icon.svelte'

  /**
   * Playback controls + seek bar. In the bar the seek bar sits under the controls;
   * in cinema mode it spans the width above them, and extra is shown at the right of the controls.
   */
  let { cinema = false, extra }: { cinema?: boolean; extra?: Snippet } = $props()

  let seeking = $state(false)
  let seekValue = $state(0)
  // Shortly after a seek, keep showing the target: a progress tick sent before the seek may still arrive.
  let settling = $state(false)
  let settleTimer: ReturnType<typeof setTimeout> | undefined

  const position = $derived(
    seeking || (settling && Math.abs(app.state.position - seekValue) > 1.5) ? seekValue : app.state.position,
  )
  const duration = $derived(app.state.duration || app.now?.track.duration || 0)

  function seekTo(v: number) {
    seekValue = v
    app.state.position = v
    seeking = false
    settling = true
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => (settling = false), 500)
    Seek(v)
  }

  const repeatModes = ['off', 'all', 'one']
  function cycleRepeat() {
    const next = repeatModes[(repeatModes.indexOf(app.settings.repeat) + 1) % repeatModes.length]
    app.settings.repeat = next
    app.state.repeat = next
    SetRepeat(next)
  }

  function toggleShuffle() {
    app.settings.shuffle = !app.settings.shuffle
    SetShuffle(app.settings.shuffle)
  }

  const big = $derived(cinema ? 1.35 : 1)
</script>

<div class="transport" class:cinema>
  <div class="controls">
    <span></span>
    <div class="buttons">
      <button class="small" class:on={app.settings.shuffle} title="Aléatoire" onclick={toggleShuffle}>
        <Icon name="shuffle" size={18 * big} />
      </button>
      <button title="Précédent" onclick={() => Prev()}><Icon name="prev" size={22 * big} /></button>
      <button class="play" title="Lecture / pause (Espace)" onclick={() => TogglePause()}>
        <Icon name={app.state.hasTrack && !app.state.paused ? 'pause' : 'play'} size={22 * big} />
      </button>
      <button title="Suivant" onclick={() => Next()}><Icon name="next" size={22 * big} /></button>
      <button
        class="small"
        class:on={app.settings.repeat !== 'off'}
        title={app.settings.repeat === 'one' ? 'Répéter le titre' : app.settings.repeat === 'all' ? 'Répéter tout' : 'Répétition désactivée'}
        onclick={cycleRepeat}
      >
        <Icon name="repeat" size={18 * big} />
        {#if app.settings.repeat === 'one'}<span class="one">1</span>{/if}
      </button>
    </div>
    <div class="extra">{@render extra?.()}</div>
  </div>
  <div class="seek">
    <span>{fmtTime(position)}</span>
    <input
      type="range"
      min="0"
      max={duration || 1}
      step="0.1"
      value={position}
      style={fill(position, 0, duration || 1)}
      disabled={!app.state.hasTrack}
      oninput={(e) => { seeking = true; seekValue = +e.currentTarget.value }}
      onchange={(e) => seekTo(+e.currentTarget.value)}
    />
    <span>{fmtTime(duration)}</span>
  </div>
</div>

<style>
  .transport { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; }
  .transport.cinema { flex-direction: column-reverse; gap: 14px; }
  .controls { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%; }
  .buttons { display: flex; align-items: center; gap: 18px; }
  .cinema .buttons { gap: 28px; }
  .extra { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
  .buttons button {
    position: relative;
    display: grid;
    place-items: center;
    padding: 4px;
    color: var(--text-dim);
    transition: color 0.12s, transform 0.12s;
  }
  .buttons button:hover { color: var(--text); transform: scale(1.06); }
  .buttons .small.on { color: var(--accent); }
  .buttons .small.on::after {
    content: '';
    position: absolute;
    bottom: -4px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
  }
  .one { position: absolute; top: -2px; right: -2px; font-size: 9px; font-weight: 800; }
  .buttons .play {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--text);
    color: var(--bg1);
  }
  .cinema .buttons .play { width: 48px; height: 48px; }
  .buttons .play:hover { color: var(--bg1); }
  .seek {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: 620px;
    font-size: 11px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .cinema .seek { max-width: none; font-size: 12px; }
  .seek span { min-width: 36px; text-align: center; }
  @media (max-width: 640px) {
    .transport { gap: 2px; }
    .buttons { gap: 12px; }
    .cinema .buttons { gap: 18px; }
    .seek { max-width: none; }
  }
</style>
