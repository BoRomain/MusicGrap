<script lang="ts">
  import { app, fmtLong, playTracks, plural, shufflePlay } from '../store.svelte'
  import MediaHeader from '../MediaHeader.svelte'
  import TrackTable from '../TrackTable.svelte'

  const duration = $derived(app.tracks.reduce((s, t) => s + t.duration, 0))
</script>

<MediaHeader
  kind="Bibliothèque"
  title="Tous les titres"
  ids={[]}
  icon="note"
  onplay={() => playTracks(app.tracks)}
  onshuffle={() => shufflePlay(app.tracks)}
>
  {#snippet meta()}{plural(app.tracks.length, 'titre')}, {fmtLong(duration)}{/snippet}
</MediaHeader>

<TrackTable tracks={app.tracks} sortable />
