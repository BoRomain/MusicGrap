<script lang="ts">
  import { albumTitle, app, artistName, go, lib, playTracks, plural } from '../store.svelte'
  import Card from '../Card.svelte'
  import TrackTable from '../TrackTable.svelte'

  const q = $derived(app.query.trim().toLowerCase())
  const has = (s: string) => s.toLowerCase().includes(q)

  const songs = $derived(q ? app.tracks.filter((t) => has(`${t.title} ${t.artist} ${t.album}`)) : [])
  const albums = $derived(q ? [...lib.albums.values()].filter((a) => has(`${a.title} ${a.artist}`)) : [])
  const artists = $derived(q ? [...lib.artists.values()].filter((a) => has(a.name)) : [])
</script>

{#if !q}
  <h2 class="section">Parcourir</h2>
  <div class="browse">
    <button style="--c:#e13300" onclick={() => go({ view: 'albums' })}>Albums<span>{lib.albums.size}</span></button>
    <button style="--c:#1e3264" onclick={() => go({ view: 'artists' })}>Artistes<span>{lib.artists.size}</span></button>
    <button style="--c:#8400e7" onclick={() => go({ view: 'songs' })}>Titres<span>{app.tracks.length}</span></button>
    {#each app.playlists as p, i (p.id)}
      <button style="--c:{['#27856a', '#e8115b', '#148a08', '#bc5900', '#509bf5'][i % 5]}" onclick={() => go({ view: 'playlist', key: p.id })}>
        {p.name}<span>{plural(p.trackIds.length, 'titre')}</span>
      </button>
    {/each}
  </div>
{:else if !songs.length && !albums.length && !artists.length}
  <div class="none">
    <h2>Aucun résultat pour « {app.query.trim()} »</h2>
    <p>Vérifie l'orthographe ou essaie d'autres mots-clés.</p>
  </div>
{:else}
  {#if songs.length}
    <h2 class="section">Titres</h2>
    <TrackTable tracks={songs.slice(0, 100)} />
    {#if songs.length > 100}<p class="more">… et {songs.length - 100} autres titres</p>{/if}
  {/if}

  {#if artists.length}
    <h2 class="section">Artistes</h2>
    <div class="grid">
      {#each artists.slice(0, 12) as ar (ar.key)}
        <Card
          ids={[ar.tracks[0].id]}
          round
          icon="artist"
          title={artistName(ar.name)}
          subtitle="Artiste"
          onopen={() => go({ view: 'artist', key: ar.key })}
          onplay={() => playTracks(ar.tracks)}
        />
      {/each}
    </div>
  {/if}

  {#if albums.length}
    <h2 class="section">Albums</h2>
    <div class="grid">
      {#each albums.slice(0, 24) as a (a.key)}
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
  {/if}
{/if}

<style>
  .browse {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
  }
  @media (max-width: 640px) {
    .browse { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .browse button { height: 96px; padding: 12px; font-size: 18px; }
  }
  .browse button {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 120px;
    padding: 16px;
    border-radius: 8px;
    background: var(--c);
    font-size: 22px;
    font-weight: 800;
    text-align: left;
    overflow: hidden;
    transition: transform 0.15s;
  }
  .browse button:hover { transform: scale(1.02); }
  .browse span { font-size: 13px; font-weight: 400; opacity: 0.85; }
  .none { padding: 60px 0; text-align: center; }
  .none p, .more { color: var(--text-dim); }
</style>
