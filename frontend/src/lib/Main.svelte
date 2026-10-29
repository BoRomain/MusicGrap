<script lang="ts">
  import { isMobile } from '$backend'
  import { app, back, chooseFolder, forward, go, nav, route } from './store.svelte'
  import Icon from './Icon.svelte'
  import Albums from './views/Albums.svelte'
  import AlbumPage from './views/AlbumPage.svelte'
  import Artists from './views/Artists.svelte'
  import ArtistPage from './views/ArtistPage.svelte'
  import Songs from './views/Songs.svelte'
  import PlaylistPage from './views/PlaylistPage.svelte'
  import Search from './views/Search.svelte'

  let scroller: HTMLElement | undefined = $state()
  let searchInput: HTMLInputElement | undefined = $state()
  const r = $derived(route())

  // Every page opens at the top.
  $effect(() => {
    nav.index
    scroller?.scrollTo(0, 0)
  })

  // Focus the search field when the Search page is opened.
  $effect(() => {
    if (r.view === 'search') searchInput?.focus()
  })
</script>

<section class="main" bind:this={scroller}>
  <div class="top">
    {#if isMobile}
      <button class="nav menu" title="Menu" onclick={() => (app.drawer = !app.drawer)}><Icon name="menu" size={22} /></button>
    {/if}
    <button class="nav" title="Précédent" disabled={nav.index === 0} onclick={back}><Icon name="back" size={22} /></button>
    <button class="nav" title="Suivant" disabled={nav.index === nav.history.length - 1} onclick={forward}>
      <Icon name="forward" size={22} />
    </button>
    <label class="search">
      <Icon name="search" size={20} />
      <input
        bind:this={searchInput}
        placeholder="Que souhaitez-vous écouter ?"
        bind:value={app.query}
        onfocus={() => go({ view: 'search' })}
        oninput={() => go({ view: 'search' })}
      />
      {#if app.query}
        <button title="Effacer" onclick={() => (app.query = '')}><Icon name="close" size={18} /></button>
      {/if}
    </label>
  </div>

  <div class="page">
    {#if app.tracks.length === 0 && !app.scan}
      <div class="empty">
        <Icon name="note" size={56} />
        <h2>Aucune musique pour l'instant</h2>
        <p>Choisis le dossier où se trouve ta musique (MP3, FLAC, OGG, WAV).</p>
        <button class="primary" onclick={chooseFolder}>Choisir un dossier</button>
      </div>
    {:else if r.view === 'albums'}
      <Albums />
    {:else if r.view === 'artists'}
      <Artists />
    {:else if r.view === 'songs'}
      <Songs />
    {:else if r.view === 'search'}
      <Search />
    {:else if r.view === 'album'}
      {#key r.key}<AlbumPage key={r.key} />{/key}
    {:else if r.view === 'artist'}
      {#key r.key}<ArtistPage key={r.key} />{/key}
    {:else if r.view === 'playlist'}
      {#key r.key}<PlaylistPage id={r.key} />{/key}
    {/if}
  </div>
</section>

<style>
  .main {
    --sticky-top: 66px;
    position: relative;
    min-height: 0;
    overflow-y: auto;
    border-radius: 8px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg2) 45%, transparent) 0, rgba(0, 0, 0, 0.3) 340px);
    backdrop-filter: blur(20px);
  }
  .top {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: color-mix(in srgb, var(--bg1) 75%, transparent);
    backdrop-filter: blur(16px);
  }
  .nav {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
  }
  .nav:disabled { opacity: 0.4; cursor: default; }
  .nav.menu { flex: none; width: 42px; height: 42px; }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(420px, 100%);
    margin-left: 8px;
    padding: 0 14px;
    height: 42px;
    border-radius: 999px;
    background: var(--surface-hover);
    color: var(--text-dim);
    border: 2px solid transparent;
    transition: border-color 0.15s;
  }
  .search:focus-within { border-color: var(--text); color: var(--text); }
  .search input { flex: 1; min-width: 0; background: none; border: 0; outline: none; color: var(--text); font: inherit; }
  .search button { display: grid; color: var(--text-dim); }
  .page { padding: 0 24px 32px; }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 80px 20px;
    text-align: center;
    color: var(--text-dim);
  }
  .empty h2 { margin: 8px 0 0; color: var(--text); }
  .empty p { margin: 0 0 12px; }
  .primary {
    padding: 12px 28px;
    border-radius: 999px;
    background: var(--accent);
    color: #111;
    font-weight: 700;
  }
  .primary:hover { transform: scale(1.04); }
  /* Shared by the views */
  .page :global(h2.section) { margin: 28px 0 8px; font-size: 24px; }
  .page :global(.grid) {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    margin: 0 -12px;
  }
  @media (max-width: 640px) {
    .main { --sticky-top: 62px; }
    .top { padding: 10px 12px; }
    .nav:not(.menu) { display: none; }
    .search { margin-left: 0; }
    .page { padding: 0 12px 24px; }
    .page :global(h2.section) { margin-top: 20px; font-size: 20px; }
    .page :global(.grid) { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); margin: 0 -8px; }
  }
</style>
