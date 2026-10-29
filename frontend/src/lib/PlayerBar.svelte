<script lang="ts">
  import { albumKey, app, artistKey, artistName, go, toggleCinema, type Panel } from './store.svelte'
  import Cover from './Cover.svelte'
  import Icon from './Icon.svelte'
  import Transport from './Transport.svelte'
  import Volume from './Volume.svelte'

  const track = $derived(app.now?.track)

  const panels: { id: Panel; label: string; icon: string }[] = [
    { id: 'slowed', label: 'Slowed + Reverb', icon: 'slowed' },
    { id: 'fade', label: 'Transitions', icon: 'fade' },
    { id: 'eq', label: 'Égaliseur', icon: 'eq' },
    { id: 'queue', label: "File d'attente", icon: 'queue' },
  ]

  function togglePanel(p: Panel) {
    app.panel = app.panel === p ? null : p
  }
</script>

<footer class="bar">
  <div class="now">
    {#if track}
      <button class="thumb" title="File d'attente" onclick={() => togglePanel('queue')}>
        {#key track.id}<Cover ids={app.now?.hasCover ? [track.id] : []} />{/key}
      </button>
      <div class="names">
        <button class="title" onclick={() => go({ view: 'album', key: albumKey(track) })}>{track.title}</button>
        <button class="artist" onclick={() => go({ view: 'artist', key: artistKey(track.group) })}>{artistName(track.artist)}</button>
      </div>
    {/if}
  </div>

  <Transport />

  <div class="right">
    {#each panels as p}
      <button class="small" class:extra={p.id !== 'queue'} class:on={app.panel === p.id} title={p.label} onclick={() => togglePanel(p.id)}>
        <Icon name={p.icon} size={18} />
      </button>
    {/each}
    <Volume />
    <button class="small" title="Mode cinéma (F)" onclick={toggleCinema}>
      <Icon name="fullscreen" size={20} />
    </button>
  </div>
</footer>

<style>
  .bar {
    display: grid;
    grid-template-columns: minmax(180px, 3fr) minmax(320px, 4fr) minmax(180px, 3fr);
    align-items: center;
    gap: 16px;
    height: 80px;
    padding: 0 16px 0 8px;
  }
  .now { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .thumb { flex: none; width: 56px; padding: 0; }
  .thumb :global(.cover) { border-radius: 4px; }
  .names { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
  .names button {
    max-width: 100%;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  .names button:hover { text-decoration: underline; }
  .title { font-size: 14px; }
  .artist { font-size: 12px; color: var(--text-dim); }
  .artist:hover { color: var(--text); }
  .right { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
  button.small {
    position: relative;
    display: grid;
    place-items: center;
    padding: 4px;
    color: var(--text-dim);
    transition: color 0.12s, transform 0.12s;
  }
  button.small:hover { color: var(--text); transform: scale(1.06); }
  button.small.on { color: var(--accent); }
  button.small.on::after {
    content: '';
    position: absolute;
    bottom: -4px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
  }
  @media (max-width: 900px) {
    .bar { grid-template-columns: minmax(0, 1fr) minmax(240px, 2fr) auto; gap: 12px; padding-right: 8px; }
    .right { gap: 6px; }
  }
  /* Two rows: track + buttons, then the controls. The other panels stay reachable from the panel tabs. */
  @media (max-width: 640px) {
    .bar {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'now right' 'transport transport';
      gap: 4px 12px;
      height: var(--bar-h);
      padding: 6px 8px;
    }
    .now { grid-area: now; gap: 10px; }
    .thumb { width: 44px; }
    .bar > :global(.transport) { grid-area: transport; }
    .right { grid-area: right; }
    .extra { display: none; }
  }
</style>
