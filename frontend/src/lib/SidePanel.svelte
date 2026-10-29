<script lang="ts">
  import { fly } from 'svelte/transition'
  import { app, artistName, type Panel } from './store.svelte'
  import Cover from './Cover.svelte'
  import Icon from './Icon.svelte'
  import Equalizer from './Equalizer.svelte'
  import SlowedPanel from './SlowedPanel.svelte'
  import Transitions from './Transitions.svelte'
  import Queue from './Queue.svelte'

  /** Floating card above the player bar. Non-modal: the library stays usable while it is open. */
  const tabs: { id: Panel; label: string }[] = [
    { id: 'queue', label: 'File' },
    { id: 'eq', label: 'Égaliseur' },
    { id: 'slowed', label: 'Slowed' },
    { id: 'fade', label: 'Fondus' },
  ]
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !app.menu && (app.panel = null)} />

<aside transition:fly={{ y: 16, duration: 180 }}>
  <nav>
    {#each tabs as t}
      <button class:active={app.panel === t.id} onclick={() => (app.panel = t.id)}>{t.label}</button>
    {/each}
    <button class="close" title="Fermer (Échap)" onclick={() => (app.panel = null)}><Icon name="close" size={18} /></button>
  </nav>

  <div class="content">
    {#if app.panel === 'queue'}
      {#if app.now}
        <div class="now">
          <span class="thumb">{#key app.now.track.id}<Cover ids={app.now.hasCover ? [app.now.track.id] : []} />{/key}</span>
          <span class="names">
            <span class="kind">En cours de lecture</span>
            <b>{app.now.track.title}</b>
            <span class="artist">{artistName(app.now.track.artist)}</span>
          </span>
        </div>
      {/if}
      <h3>File d'attente</h3>
      <Queue />
    {:else if app.panel === 'eq'}
      <Equalizer />
    {:else if app.panel === 'slowed'}
      <SlowedPanel />
    {:else}
      <Transitions />
    {/if}
  </div>
</aside>

<style>
  aside {
    position: fixed;
    right: 16px;
    bottom: calc(var(--bar-h) + 16px);
    z-index: 40;
    display: flex;
    flex-direction: column;
    width: 360px;
    max-width: calc(100vw - 32px);
    max-height: min(640px, calc(100vh - var(--bar-h) - 60px));
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg1) 70%, rgba(20, 20, 20, 0.85));
    backdrop-filter: blur(28px) saturate(1.3);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  nav { display: flex; gap: 2px; padding: 8px; border-bottom: 1px solid var(--border); }
  nav button {
    flex: 1;
    padding: 7px 4px;
    border-radius: 999px;
    color: var(--text-dim);
    font-size: 13px;
  }
  nav button:hover { color: var(--text); }
  nav button.active { background: var(--surface-hover); color: var(--text); font-weight: 700; }
  nav .close { flex: none; display: grid; place-items: center; width: 32px; padding: 0; }
  .content { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
  .now { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .thumb { flex: none; width: 56px; }
  .thumb :global(.cover) { border-radius: 4px; }
  .names { display: flex; flex-direction: column; min-width: 0; }
  .names > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kind { font-size: 11px; color: var(--accent); font-weight: 700; }
  .artist { font-size: 13px; color: var(--text-dim); }
  h3 { margin: 0 0 8px; font-size: 15px; }
  @media (max-width: 640px) {
    aside { left: 8px; right: 8px; bottom: calc(var(--bar-h) + 8px); width: auto; max-width: none; }
    .content { padding: 12px; }
  }
</style>
