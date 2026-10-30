<script lang="ts">
  import { albumTitle, artistName, fmtLong, go, kindLabel, lib, playTracks, plural, shufflePlay } from '../store.svelte'
  import Card from '../Card.svelte'
  import MediaHeader from '../MediaHeader.svelte'
  import TrackTable from '../TrackTable.svelte'

  let { key }: { key: string } = $props()

  const album = $derived(lib.albums.get(key))
  const more = $derived(album ? (lib.artists.get(album.artistKey)?.albums ?? []).filter((a) => a.key !== key) : [])
</script>

{#if album}
  <MediaHeader
    kind={kindLabel[album.kind]}
    title={albumTitle(album.title)}
    ids={[album.tracks[0].id]}
    icon="album"
    onplay={() => playTracks(album.tracks)}
    onshuffle={() => shufflePlay(album.tracks)}
  >
    {#snippet meta()}
      <button class="artist" onclick={() => go({ view: 'artist', key: album.artistKey })}><b>{artistName(album.artist)}</b></button>
      · {plural(album.tracks.length, 'titre')}, {fmtLong(album.duration)}
    {/snippet}
  </MediaHeader>

  <TrackTable tracks={album.tracks} numbers="track" showAlbum={false} showCover={false} />

  {#if more.length}
    <h2 class="section">Plus de {artistName(album.artist)}</h2>
    <div class="grid">
      {#each more as a (a.key)}
        <Card
          ids={[a.tracks[0].id]}
          icon="album"
          title={albumTitle(a.title)}
          subtitle="{kindLabel[a.kind]} · {plural(a.tracks.length, 'titre')}"
          onopen={() => go({ view: 'album', key: a.key })}
          onplay={() => playTracks(a.tracks)}
        />
      {/each}
    </div>
  {/if}
{:else}
  <p class="missing">Cet album n'est plus dans la bibliothèque.</p>
{/if}

<style>
  .artist { padding: 0; }
  .artist:hover { text-decoration: underline; }
  .missing { padding: 40px 0; color: var(--text-dim); }
</style>
