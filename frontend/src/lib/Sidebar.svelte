<script lang="ts">
  import { ChooseMusicFolder, CreatePlaylist, ScanLibrary } from '../../wailsjs/go/main/App'
  import { app, coverIds, go, lib, plural, route, type Route } from './store.svelte'
  import Cover from './Cover.svelte'
  import Icon from './Icon.svelte'

  const links: { route: Route; label: string; icon: string }[] = [
    { route: { view: 'search' }, label: 'Rechercher', icon: 'search' },
    { route: { view: 'albums' }, label: 'Albums', icon: 'album' },
    { route: { view: 'artists' }, label: 'Artistes', icon: 'artist' },
    { route: { view: 'songs' }, label: 'Titres', icon: 'note' },
  ]

  const r = $derived(route())

  async function chooseFolder() {
    const dir = await ChooseMusicFolder()
    if (dir) app.settings.musicDir = dir
  }

  async function newPlaylist() {
    const p = await CreatePlaylist(`Playlist n°${app.playlists.length + 1}`)
    go({ view: 'playlist', key: p.id })
  }
</script>

<aside>
  <div class="box">
    <div class="brand">
      <Icon name="slowed" size={26} />
      <span class="text">Wave</span>
    </div>
    <nav>
      {#each links as l}
        <button class:active={r.view === l.route.view} title={l.label} onclick={() => go(l.route)}>
          <Icon name={l.icon} size={22} />
          <span class="text">{l.label}</span>
        </button>
      {/each}
    </nav>
  </div>

  <div class="box library">
    <header>
      <span class="label"><Icon name="playlist" size={22} /> <span class="text">Playlists</span></span>
      <button class="icon" title="Créer une playlist" onclick={newPlaylist}><Icon name="plus" size={20} /></button>
    </header>

    <ul>
      {#each app.playlists as p (p.id)}
        {@const tracks = lib.playlistTracks(p).map((e) => e.track)}
        <li>
          <button class:active={r.view === 'playlist' && r.key === p.id} title={p.name} onclick={() => go({ view: 'playlist', key: p.id })}>
            <span class="thumb"><Cover ids={coverIds(tracks)} icon="playlist" /></span>
            <span class="names">
              <span class="name">{p.name}</span>
              <span class="sub">Playlist · {plural(tracks.length, 'titre')}</span>
            </span>
          </button>
        </li>
      {:else}
        <li class="empty">
          <p>Crée ta première playlist</p>
          <button class="pill" onclick={newPlaylist}>Créer une playlist</button>
        </li>
      {/each}
    </ul>

    <footer>
      {#if app.scan}
        <div class="scan">
          Analyse… {app.scan.done} / {app.scan.total}
          <div class="bar"><div style="width:{(app.scan.done / Math.max(1, app.scan.total)) * 100}%"></div></div>
        </div>
      {:else}
        <span class="count">{plural(app.tracks.length, 'titre')}</span>
      {/if}
      <button class="icon" title="Rescanner le dossier" onclick={() => ScanLibrary()} disabled={!app.settings.musicDir}>
        <Icon name="refresh" size={18} />
      </button>
      <button class="icon" title="Choisir le dossier musique" onclick={chooseFolder}>
        <Icon name="folder" size={18} />
      </button>
    </footer>
  </div>
</aside>

<style>
  aside { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .box {
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(20px);
  }
  .brand { display: flex; align-items: center; gap: 10px; padding: 18px 20px 6px; font-size: 20px; font-weight: 800; color: var(--accent); }
  .brand span { color: var(--text); }
  nav { display: flex; flex-direction: column; padding: 8px 8px 10px; }
  nav button {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 9px 12px;
    font-weight: 700;
    color: var(--text-dim);
    transition: color 0.15s;
  }
  nav button:hover, nav button.active { color: var(--text); }
  nav button.active :global(svg) { color: var(--accent); }
  .library { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px 20px; }
  .label { display: flex; align-items: center; gap: 12px; font-weight: 700; color: var(--text-dim); }
  .icon {
    display: grid;
    padding: 6px;
    border-radius: 50%;
    color: var(--text-dim);
  }
  .icon:hover:not(:disabled) { color: var(--text); background: var(--surface-hover); }
  .icon:disabled { opacity: 0.35; cursor: default; }
  ul { flex: 1; min-height: 0; overflow-y: auto; list-style: none; margin: 0; padding: 0 8px; }
  li button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    text-align: left;
  }
  li button:hover { background: var(--surface); }
  li button.active { background: var(--surface-hover); }
  .thumb { flex: none; width: 48px; }
  .thumb :global(.cover) { border-radius: 4px; box-shadow: none; }
  .names { display: flex; flex-direction: column; min-width: 0; }
  .name, .sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .active .name { color: var(--accent); }
  .sub { font-size: 13px; color: var(--text-dim); }
  .empty { margin: 8px; padding: 16px; border-radius: 8px; background: var(--surface); }
  .empty p { margin: 0 0 12px; font-weight: 700; }
  .pill {
    padding: 7px 16px;
    border-radius: 999px;
    background: var(--text);
    color: #111;
    font-size: 13px;
    font-weight: 700;
  }
  .pill:hover { transform: scale(1.04); }
  footer {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 10px 10px 20px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-dim);
  }
  .count, .scan { flex: 1; }
  .bar { height: 3px; margin-top: 6px; margin-right: 10px; border-radius: 2px; background: var(--surface); }
  .bar div { height: 100%; border-radius: 2px; background: var(--accent); transition: width 0.2s; }

  /* Icon rail in narrow windows; the labels move to tooltips. */
  @media (max-width: 900px) {
    aside { width: 64px; }
    .text, .names, .label, .count, .empty { display: none; }
    .brand { justify-content: center; padding: 16px 0 4px; }
    nav { padding: 8px 4px 10px; }
    nav button { justify-content: center; padding: 10px 0; }
    header { justify-content: center; padding: 10px 0 6px; }
    ul { padding: 0 4px; }
    li button { justify-content: center; padding: 6px 4px; }
    .thumb { width: 44px; }
    footer { flex-direction: column; gap: 4px; padding: 8px 0; }
    .scan { flex: none; width: 40px; font-size: 0; }
    .bar { margin: 0; }
  }
  @media (max-height: 520px) {
    .brand { display: none; }
  }
</style>
