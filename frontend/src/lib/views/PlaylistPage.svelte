<script lang="ts">
  import { DeletePlaylist, RenamePlaylist } from '$backend'
  import { app, back, coverIds, fmtLong, lib, playTracks, plural, shufflePlay } from '../store.svelte'
  import Icon from '../Icon.svelte'
  import MediaHeader from '../MediaHeader.svelte'
  import TrackTable from '../TrackTable.svelte'

  let { id }: { id: string } = $props()

  const playlist = $derived(app.playlists.find((p) => p.id === id))
  const entries = $derived(playlist ? lib.playlistTracks(playlist) : [])
  const tracks = $derived(entries.map((e) => e.track))
  const duration = $derived(tracks.reduce((s, t) => s + t.duration, 0))

  async function remove() {
    if (!playlist || !confirm(`Supprimer la playlist « ${playlist.name} » ?`)) return
    await DeletePlaylist(playlist.id)
    back()
  }
</script>

{#if playlist}
  <MediaHeader
    kind="Playlist"
    title={playlist.name}
    ids={coverIds(tracks)}
    icon="playlist"
    onplay={() => playTracks(tracks)}
    onshuffle={() => shufflePlay(tracks)}
    onrename={(name) => RenamePlaylist(playlist.id, name)}
  >
    {#snippet meta()}
      {plural(tracks.length, 'titre')}{#if tracks.length}, {fmtLong(duration)}{/if}
    {/snippet}
    {#snippet actions()}
      <button class="icon" title="Supprimer la playlist" onclick={remove}><Icon name="trash" size={22} /></button>
    {/snippet}
  </MediaHeader>

  {#if tracks.length}
    <TrackTable {tracks} playlistId={playlist.id} positions={entries.map((e) => e.index)} />
  {:else}
    <div class="empty">
      <h3>Cette playlist est vide</h3>
      <p>Fais un clic droit sur un titre, puis « Ajouter à la playlist ».</p>
    </div>
  {/if}
{:else}
  <p class="empty">Cette playlist n'existe plus.</p>
{/if}

<style>
  .icon { display: grid; color: var(--text-dim); transition: color 0.12s, transform 0.12s; }
  .icon:hover { color: var(--text); transform: scale(1.06); }
  .empty { padding: 24px 0; color: var(--text-dim); }
  .empty h3 { margin: 0 0 6px; color: var(--text); }
  .empty p { margin: 0; }
</style>
