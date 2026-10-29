<script lang="ts">
  import { onMount } from 'svelte'
  import { coverUrl as coverOf, EventsOn, GetInitialState, Next, Prev, onBackButton, Seek, TogglePause } from '$backend'
  import type { audio, core, library, playlist } from '../wailsjs/go/models'
  import { app, back, forward, nav, onFullscreenLeft, toggleCinema, toggleFullscreen } from './lib/store.svelte'
  import { applyPalette } from './lib/theme'
  import Sidebar from './lib/Sidebar.svelte'
  import Main from './lib/Main.svelte'
  import SidePanel from './lib/SidePanel.svelte'
  import PlayerBar from './lib/PlayerBar.svelte'
  import ContextMenu from './lib/ContextMenu.svelte'
  import Cinema from './lib/Cinema.svelte'

  const coverUrl = $derived(app.now?.hasCover ? coverOf(app.now.track.id) : '')

  function setNow(np: core.NowPlaying | null) {
    app.now = np
    if (np) applyPalette(np.palette)
  }

  onMount(() => {
    GetInitialState().then((s) => {
      app.settings = s.settings
      app.tracks = s.tracks ?? []
      app.playlists = s.playlists ?? []
      app.presets = s.presets
      app.bands = s.bands
      app.audioError = s.audioError
      app.state = s.state
      setNow(s.now ?? null)
    })

    const offs = [
      EventsOn('track:changed', (np: core.NowPlaying) => setNow(np)),
      EventsOn('playback:progress', (st: audio.State) => {
        app.state = st
      }),
      EventsOn('library:scan-progress', (p: { done: number; total: number }) => {
        app.scan = p
      }),
      EventsOn('library:updated', (tracks: library.Track[]) => {
        app.tracks = tracks ?? []
        app.scan = null
      }),
      EventsOn('playlists:updated', (pls: playlist.Playlist[]) => {
        app.playlists = pls ?? []
      }),
    ]
    return () => offs.forEach((off) => off())
  })

  // Android back button closes the topmost overlay, then goes back in history.
  onBackButton(() => {
    if (app.menu) app.menu = null
    else if (app.cinema) toggleCinema()
    else if (app.panel) app.panel = null
    else if (nav.index > 0) back()
    else return false
    return true
  })

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
    if (e.code === 'Space') {
      e.preventDefault()
      TogglePause()
    } else if (e.code === 'KeyF' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      toggleCinema()
    } else if (e.key === 'F11') {
      e.preventDefault()
      toggleFullscreen()
    } else if (e.key === 'Escape' && app.cinema && !app.menu) {
      toggleCinema()
    } else if (e.key === 'ArrowRight' && e.ctrlKey) {
      Next()
    } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
      Prev()
    } else if (e.key === 'ArrowLeft' && e.altKey) {
      back()
    } else if (e.key === 'ArrowRight' && e.altKey) {
      forward()
    } else if (e.key === 'ArrowRight' && e.target === document.body) {
      Seek(app.state.position + 5)
    } else if (e.key === 'ArrowLeft' && e.target === document.body) {
      Seek(Math.max(0, app.state.position - 5))
    }
  }

  function onFullscreenChange() {
    if (!document.fullscreenElement) onFullscreenLeft()
  }

  // Mouse back / forward buttons navigate like in a browser.
  function onMouse(e: MouseEvent) {
    if (e.button === 3) back()
    if (e.button === 4) forward()
  }
</script>

<svelte:window onkeydown={onKey} onmouseup={onMouse} />
<svelte:document onfullscreenchange={onFullscreenChange} />

<div class="backdrop" aria-hidden="true">
  {#key coverUrl}
    {#if coverUrl}<div class="blur" style="background-image:url('{coverUrl}')"></div>{/if}
  {/key}
  <div class="gradient"></div>
</div>

<div class="layout">
  <Sidebar />
  <div class="center">
    {#if app.audioError}
      <div class="error">Sortie audio indisponible : {app.audioError}</div>
    {/if}
    {#if app.notice}
      <div class="error">{app.notice}</div>
    {/if}
    <Main />
  </div>
  <PlayerBar />
</div>

{#if app.panel}<SidePanel />{/if}
{#if app.menu}<ContextMenu menu={app.menu} />{/if}
{#if app.cinema}<Cinema />{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    background: var(--bg1);
  }
  .blur {
    position: absolute;
    inset: -15%;
    background-size: cover;
    background-position: center;
    filter: blur(70px) saturate(1.4);
    opacity: 0.45;
    animation: fade 1.2s ease;
  }
  @keyframes fade { from { opacity: 0; } }
  .gradient {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 15% 10%, color-mix(in srgb, var(--bg2) 85%, transparent), transparent 60%),
      radial-gradient(ellipse at 85% 90%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 55%),
      linear-gradient(160deg, color-mix(in srgb, var(--bg1) 55%, transparent), color-mix(in srgb, var(--bg1) 92%, black));
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 8px;
    height: 100vh;
    height: 100dvh;
    /* The insets keep clear of Android's status and navigation bars (edge-to-edge); 0 elsewhere. */
    --pad: 8px;
    padding: max(var(--pad), env(safe-area-inset-top)) max(var(--pad), env(safe-area-inset-right)) env(safe-area-inset-bottom) max(var(--pad), env(safe-area-inset-left));
  }
  .layout > :global(.bar) { grid-column: 1 / -1; }
  @media (max-width: 900px) {
    .layout { grid-template-columns: auto minmax(0, 1fr); }
  }
  @media (max-width: 640px) {
    .layout { gap: 6px; --pad: 6px; }
    .center { gap: 6px; }
  }
  .center { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .center > :global(.main) { flex: 1; }
  .error {
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(220, 50, 50, 0.3);
    font-size: 13px;
  }
</style>
