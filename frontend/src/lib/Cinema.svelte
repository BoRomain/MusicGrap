<script lang="ts">
  import { onMount } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { GetQueue } from '../../wailsjs/go/main/App'
  import type { library } from '../../wailsjs/go/models'
  import { albumKey, albumTitle, app, artistKey, artistName, go, toggleCinema } from './store.svelte'
  import Cover from './Cover.svelte'
  import Icon from './Icon.svelte'
  import Transport from './Transport.svelte'
  import Volume from './Volume.svelte'

  /** "Now playing" view over the whole window. The controls fade out after a few seconds without moving the mouse. */

  const track = $derived(app.now?.track)
  const coverUrl = $derived(app.now?.hasCover ? `/cover/${app.now.track.id}` : '')

  let upNext = $state<library.Track | null>(null)
  $effect(() => {
    app.now?.track.id
    app.settings.shuffle
    app.settings.repeat
    GetQueue().then((q) => (upNext = q?.[1] ?? null))
  })

  let idle = $state(false)
  let hovering = false
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  function wake() {
    idle = false
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => (idle = !hovering), 3000)
  }

  onMount(() => {
    wake()
    return () => clearTimeout(idleTimer)
  })

  function leave(fn: () => void) {
    toggleCinema()
    fn()
  }

  const hold = {
    onmouseenter: () => (hovering = true),
    onmouseleave: () => (hovering = false),
  }
</script>

<svelte:window onmousemove={wake} onkeydown={wake} />

<div class="cinema" class:idle transition:fade={{ duration: 250 }}>
  <div class="bg" aria-hidden="true">
    {#key coverUrl}
      {#if coverUrl}<div class="blur" style="background-image:url('{coverUrl}')" transition:fade={{ duration: 900 }}></div>{/if}
    {/key}
  </div>

  <header class="chrome">
    <div class="from">
      <span class="logo"><Icon name="slowed" size={26} /></span>
      <span class="label">En lecture</span>
      {#if track}
        <button onclick={() => leave(() => go({ view: 'album', key: albumKey(track) }))}>{albumTitle(track.album)}</button>
      {/if}
    </div>
    {#if upNext}
      {@const next = upNext}
      <div class="next" {...hold} transition:fade={{ duration: 200 }}>
        <span class="thumb"><Cover ids={[next.id]} /></span>
        <span class="names">
          <span class="label">À suivre</span>
          <b>{next.title} • {artistName(next.artist)}</b>
        </span>
      </div>
    {/if}
  </header>

  <main class="hero">
    {#if track}
      {#key track.id}
        <div class="art" in:scale={{ start: 0.96, duration: 500 }}>
          <Cover ids={app.now?.hasCover ? [track.id] : []} />
        </div>
      {/key}
      <div class="text">
        <h1>{track.title}</h1>
        <button class="artist" onclick={() => leave(() => go({ view: 'artist', key: artistKey(track.group) }))}>
          {artistName(track.artist)}
        </button>
      </div>
    {:else}
      <p class="nothing">Rien en lecture</p>
    {/if}
  </main>

  <footer class="chrome" {...hold}>
    <Transport cinema>
      {#snippet extra()}
        <Volume />
        <button class="exit" title="Quitter le mode cinéma (Échap)" onclick={toggleCinema}>
          <Icon name="fullscreen-exit" size={22} />
        </button>
      {/snippet}
    </Transport>
  </footer>
</div>

<style>
  .cinema {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 24px;
    padding: 32px clamp(24px, 4vw, 64px) 28px;
    overflow: hidden;
    background:
      radial-gradient(ellipse at 20% 30%, color-mix(in srgb, var(--bg2) 55%, transparent), transparent 65%),
      radial-gradient(ellipse at 90% 100%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 55%),
      color-mix(in srgb, var(--bg1) 70%, black);
  }
  .cinema.idle { cursor: none; }
  .bg { position: absolute; inset: 0; z-index: -1; overflow: hidden; }
  .blur {
    position: absolute;
    inset: -20%;
    background-size: cover;
    background-position: center;
    filter: blur(100px) saturate(1.3);
    opacity: 0.22;
  }
  .chrome { transition: opacity 0.6s ease; }
  .idle .chrome { opacity: 0; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
  .from { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .logo { display: grid; color: var(--accent); }
  .label { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); }
  .from button {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .from button:hover { text-decoration: underline; }
  .next {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: min(360px, 40vw);
    padding: 8px 14px 8px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(12px);
  }
  .next .thumb { flex: none; width: 48px; }
  .next .thumb :global(.cover) { border-radius: 3px; box-shadow: none; }
  .next .names { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .next b { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hero { display: flex; align-items: flex-end; gap: clamp(24px, 3vw, 48px); min-height: 0; }
  .art { flex: none; width: clamp(200px, 38vh, 460px); }
  .art :global(.cover) { border-radius: 4px; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6); }
  .text { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding-bottom: 6px; }
  h1 {
    margin: 0;
    font-size: clamp(32px, 5.5vw, 84px);
    font-weight: 800;
    line-height: 1.02;
    letter-spacing: -0.02em;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    text-shadow: 0 4px 30px rgba(0, 0, 0, 0.35);
  }
  .artist { align-self: flex-start; padding: 0; font-size: clamp(16px, 1.6vw, 22px); font-weight: 700; color: var(--text-dim); }
  .artist:hover { color: var(--text); text-decoration: underline; }
  .nothing { align-self: center; margin: auto; color: var(--text-dim); font-size: 20px; }
  .exit { display: grid; padding: 4px; color: var(--text-dim); transition: color 0.12s, transform 0.12s; }
  .exit:hover { color: var(--text); transform: scale(1.08); }
  /* Narrow or portrait: cover above the title, centred. */
  @media (max-width: 700px), (orientation: portrait) {
    .hero { flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .art { width: min(60vw, 38vh); }
    .text { align-items: center; padding-bottom: 0; }
    .artist { align-self: center; }
  }
  @media (max-width: 640px) {
    .cinema { gap: 16px; padding: 20px 16px; }
    .next { display: none; }
    h1 { font-size: clamp(24px, 7vw, 48px); }
  }
  @media (max-height: 560px) {
    .cinema { gap: 12px; padding-top: 16px; padding-bottom: 16px; }
    .art { width: min(30vh, 60vw); }
  }
</style>
