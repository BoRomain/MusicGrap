<script lang="ts">
  import { albumTitle, artistName, fmtLong, go, lib, playTracks, plural, shufflePlay } from '../store.svelte'
  import Card from '../Card.svelte'
  import MediaHeader from '../MediaHeader.svelte'
  import TrackTable from '../TrackTable.svelte'

  let { key }: { key: string } = $props()

  const artist = $derived(lib.artists.get(key))
  const duration = $derived(artist?.tracks.reduce((s, t) => s + t.duration, 0) ?? 0)
</script>

{#if artist}
  <MediaHeader
    kind="Artiste"
    title={artistName(artist.name)}
    ids={[artist.tracks[0].id]}
    round
    icon="artist"
    onplay={() => playTracks(artist.tracks)}
    onshuffle={() => shufflePlay(artist.tracks)}
  >
    {#snippet meta()}
      {plural(artist.albums.length, 'album')} · {plural(artist.tracks.length, 'titre')}, {fmtLong(duration)}
    {/snippet}
  </MediaHeader>

  <h2 class="section">Albums</h2>
  <div class="grid">
    {#each artist.albums as a (a.key)}
      <Card
        ids={[a.tracks[0].id]}
        icon="album"
        title={albumTitle(a.title)}
        subtitle={plural(a.tracks.length, 'titre')}
        onopen={() => go({ view: 'album', key: a.key })}
        onplay={() => playTracks(a.tracks)}
      />
    {/each}
  </div>

  <h2 class="section">Titres</h2>
  <TrackTable tracks={artist.tracks} sortable />
{:else}
  <p class="missing">Cet artiste n'est plus dans la bibliothèque.</p>
{/if}

<style>
  .missing { padding: 40px 0; color: var(--text-dim); }
</style>
