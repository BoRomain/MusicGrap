<script lang="ts">
  import { albumKinds, albumTitle, artistName, go, kindLabel, kindPlural, lib, playTracks, type Album, type AlbumKind } from '../store.svelte'
  import Card from '../Card.svelte'

  const sorts = [
    { id: 'artist', label: 'Artiste' },
    { id: 'title', label: 'Titre' },
    { id: 'recent', label: 'Ajouts récents' },
  ] as const
  let sort = $state<(typeof sorts)[number]['id']>('artist')
  let kind = $state<AlbumKind | 'all'>('all')

  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
  const added = (a: Album) => Math.max(...a.tracks.map((t) => t.modTime))

  const albums = $derived.by(() => {
    const list = [...lib.albums.values()].filter((a) => kind === 'all' || a.kind === kind)
    if (sort === 'title') list.sort((a, b) => collator.compare(albumTitle(a.title), albumTitle(b.title)))
    if (sort === 'recent') list.sort((a, b) => added(b) - added(a))
    return list
  })
</script>

<div class="head">
  <h2 class="section">Albums</h2>
  <div class="chips">
    <button class:active={kind === 'all'} onclick={() => (kind = 'all')}>Tout</button>
    {#each albumKinds as k}
      <button class:active={kind === k} onclick={() => (kind = k)}>{kindPlural[k]}</button>
    {/each}
  </div>
  <div class="chips">
    {#each sorts as s}
      <button class:active={sort === s.id} onclick={() => (sort = s.id)}>{s.label}</button>
    {/each}
  </div>
</div>

<div class="grid">
  {#each albums as a (a.key)}
    <Card
      ids={[a.tracks[0].id]}
      icon="album"
      title={albumTitle(a.title)}
      subtitle="{kindLabel[a.kind]} · {artistName(a.artist)}"
      onopen={() => go({ view: 'album', key: a.key })}
      onplay={() => playTracks(a.tracks)}
    />
  {/each}
</div>

<style>
  .head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .head .section { flex: 1; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chips button {
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--surface-hover);
    font-size: 13px;
  }
  .chips button:hover { background: rgba(255, 255, 255, 0.16); }
  .chips button.active { background: var(--text); color: #111; }
</style>
