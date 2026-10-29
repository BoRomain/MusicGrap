<script lang="ts">
  import { artistName, go, lib, playTracks, plural } from '../store.svelte'
  import Card from '../Card.svelte'
</script>

<h2 class="section">Artistes</h2>

<div class="grid">
  {#each lib.artists.values() as ar (ar.key)}
    <Card
      ids={[ar.tracks[0].id]}
      round
      icon="artist"
      title={artistName(ar.name)}
      subtitle={plural(ar.albums.length, 'album')}
      onopen={() => go({ view: 'artist', key: ar.key })}
      onplay={() => playTracks(ar.tracks)}
    />
  {/each}
</div>
