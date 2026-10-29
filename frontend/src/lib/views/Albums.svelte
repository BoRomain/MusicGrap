<script lang="ts">
  import { albumTitle, artistName, go, lib, playTracks, type Album } from '../store.svelte'
  import Card from '../Card.svelte'

  const sorts = [
    { id: 'artist', label: 'Artiste' },
    { id: 'title', label: 'Titre' },
    { id: 'recent', label: 'Ajouts récents' },
  ] as const
  let sort = $state<(typeof sorts)[number]['id']>('artist')

  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
  const added = (a: Album) => Math.max(...a.tracks.map((t) => t.modTime))

  const albums = $derived.by(() => {
    const list = [...lib.albums.values()]
    if (sort === 'title') list.sort((a, b) => collator.compare(albumTitle(a.title), albumTitle(b.title)))
    if (sort === 'recent') list.sort((a, b) => added(b) - added(a))
    return list
  })
</script>

<div class="head">
  <h2 class="section">Albums</h2>
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
      subtitle={artistName(a.artist)}
      onopen={() => go({ view: 'album', key: a.key })}
      onplay={() => playTracks(a.tracks)}
    />
  {/each}
</div>

<style>
  .head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .chips { display: flex; gap: 8px; }
  .chips button {
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--surface-hover);
    font-size: 13px;
  }
  .chips button:hover { background: rgba(255, 255, 255, 0.16); }
  .chips button.active { background: var(--text); color: #111; }
</style>
