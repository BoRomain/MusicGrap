<script lang="ts">
  import { albumKinds, albumTitle, artistName, fmtLong, go, kindCount, kindLabel, kindPlural, lib, playTracks, plural, shufflePlay, type Album } from '../store.svelte'
  import Card from '../Card.svelte'
  import MediaHeader from '../MediaHeader.svelte'
  import TrackTable from '../TrackTable.svelte'

  let { key }: { key: string } = $props()

  const artist = $derived(lib.artists.get(key))
  const duration = $derived(artist?.tracks.reduce((s, t) => s + t.duration, 0) ?? 0)
  /** Newest first, undated last; the sort is stable so ties keep alphabetical order. */
  const byDate = (a: Album, b: Album) => (!a.date !== !b.date ? (a.date ? -1 : 1) : b.date.localeCompare(a.date))
  const sections = $derived(
    albumKinds
      .map((kind) => ({ kind, albums: artist?.albums.filter((a) => a.kind === kind).sort(byDate) ?? [] }))
      .filter((s) => s.albums.length),
  )
</script>

{#if artist}
  <MediaHeader
    kind="Artiste"
    title={artistName(artist.name)}
    ids={[artist.cover]}
    round
    icon="artist"
    onplay={() => playTracks(artist.tracks)}
    onshuffle={() => shufflePlay(artist.tracks)}
  >
    {#snippet meta()}
      {#each sections as s}{kindCount(s.albums.length, s.kind)} · {/each}{plural(artist.tracks.length, 'titre')}, {fmtLong(duration)}
    {/snippet}
  </MediaHeader>

  {#each sections as s (s.kind)}
    <h2 class="section">{kindPlural[s.kind]}</h2>
    <div class="grid">
      {#each s.albums as a (a.key)}
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
  {/each}

  <h2 class="section">Titres</h2>
  <TrackTable tracks={artist.tracks} sortable />
{:else}
  <p class="missing">Cet artiste n'est plus dans la bibliothèque.</p>
{/if}

<style>
  .missing { padding: 40px 0; color: var(--text-dim); }
</style>
