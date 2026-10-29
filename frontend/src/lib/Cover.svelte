<script lang="ts">
  import { coverUrl } from '$backend'
  import Icon from './Icon.svelte'

  /**
   * Artwork of a track (served by the Go side, see coverUrl), with a placeholder when there is none.
   * With 4 ids or more, shows a 2×2 mosaic, like Spotify playlists.
   */
  let { ids, icon = 'note', round = false }: { ids: string[]; icon?: string; round?: boolean } = $props()

  const tiles = $derived(ids.length >= 4 ? ids.slice(0, 4) : ids.slice(0, 1))
  let failed = $state<Record<string, boolean>>({})
</script>

<div class="cover" class:round class:mosaic={tiles.length === 4}>
  {#each tiles as id (id)}
    {#if failed[id]}
      <div class="placeholder"><Icon name={icon} size={tiles.length === 4 ? 20 : 40} /></div>
    {:else}
      <img src={coverUrl(id)} alt="" loading="lazy" draggable="false" onerror={() => (failed[id] = true)} />
    {/if}
  {:else}
    <div class="placeholder"><Icon name={icon} size={40} /></div>
  {/each}
</div>

<style>
  .cover {
    display: grid;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 6px;
    background: var(--surface);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }
  .cover.round { border-radius: 50%; }
  .cover.mosaic { grid-template-columns: 1fr 1fr; }
  img, .placeholder { width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
  .placeholder {
    display: grid;
    place-items: center;
    color: var(--text-dim);
    background: linear-gradient(135deg, color-mix(in srgb, var(--bg2) 70%, #333), color-mix(in srgb, var(--bg1) 70%, #222));
  }
</style>
