<script lang="ts">
  import { AddToPlaylist, CreatePlaylist, RemoveFromPlaylist } from '../../wailsjs/go/main/App'
  import { albumKey, app, artistKey, go, type Menu } from './store.svelte'
  import Icon from './Icon.svelte'

  let { menu }: { menu: Menu } = $props()

  let el: HTMLDivElement | undefined = $state()
  let pos = $state({ x: 0, y: 0 })
  let sub = $state(false)

  // Keep the menu inside the window.
  $effect(() => {
    const r = el!.getBoundingClientRect()
    pos = {
      x: Math.min(menu.x, innerWidth - r.width - 8),
      y: Math.min(menu.y, innerHeight - r.height - 8),
    }
  })

  const flip = $derived(pos.x + 2 * 230 > innerWidth)
  const ids = $derived(menu.tracks.map((t) => t.id))
  const one = $derived(menu.tracks.length === 1 ? menu.tracks[0] : null)

  function close() {
    app.menu = null
  }

  function run(fn: () => void) {
    fn()
    close()
  }

  async function addToNew() {
    const p = await CreatePlaylist(`Playlist n°${app.playlists.length + 1}`)
    await AddToPlaylist(p.id, ids)
    go({ view: 'playlist', key: p.id })
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && close()}
  onblur={close}
  onresize={close}
  onwheel={(e) => !el?.contains(e.target as Node) && close()}
/>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="overlay" onclick={close} oncontextmenu={(e) => { e.preventDefault(); close() }}></div>

<div class="menu" role="menu" bind:this={el} style="left:{pos.x}px; top:{pos.y}px">
  <div class="item sub" role="menuitem" tabindex="-1" onmouseenter={() => (sub = true)} onmouseleave={() => (sub = false)}>
    <Icon name="plus" size={18} /> Ajouter à la playlist <span class="chev"><Icon name="forward" size={18} /></span>
    {#if sub}
      <div class="menu submenu" class:flip role="menu">
        <button class="item" onclick={() => run(addToNew)}><Icon name="plus" size={18} /> Nouvelle playlist</button>
        {#if app.playlists.length}<hr />{/if}
        {#each app.playlists as p (p.id)}
          <button class="item" onclick={() => run(() => AddToPlaylist(p.id, ids))}>{p.name}</button>
        {/each}
      </div>
    {/if}
  </div>
  {#if menu.playlistId && menu.index != null}
    {@const { playlistId, index } = menu}
    <button class="item" onclick={() => run(() => RemoveFromPlaylist(playlistId, index))}>
      <Icon name="trash" size={18} /> Retirer de cette playlist
    </button>
  {/if}
  {#if one}
    <hr />
    <button class="item" onclick={() => run(() => go({ view: 'artist', key: artistKey(one.group) }))}>
      <Icon name="artist" size={18} /> Aller à l'artiste
    </button>
    <button class="item" onclick={() => run(() => go({ view: 'album', key: albumKey(one) }))}>
      <Icon name="album" size={18} /> Aller à l'album
    </button>
  {/if}
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 50; }
  .menu {
    position: fixed;
    z-index: 51;
    min-width: 220px;
    max-width: 300px;
    padding: 4px;
    border-radius: 6px;
    background: #282828;
    box-shadow: 0 16px 24px rgba(0, 0, 0, 0.5);
    font-size: 14px;
  }
  .submenu {
    position: absolute;
    top: -4px;
    left: 100%;
    max-height: 60vh;
    overflow-y: auto;
  }
  .submenu.flip { left: auto; right: 100%; }
  .item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 3px;
    text-align: left;
    cursor: default;
    color: rgba(255, 255, 255, 0.9);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item.sub { overflow: visible; }
  .item:hover { background: rgba(255, 255, 255, 0.1); }
  .chev { margin-left: auto; display: grid; }
  hr { margin: 4px 0; border: 0; border-top: 1px solid rgba(255, 255, 255, 0.1); }
</style>
