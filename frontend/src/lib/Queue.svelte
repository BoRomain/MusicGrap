<script lang="ts">
  import { GetQueue } from '$backend'
  import type { library } from '../../wailsjs/go/models'
  import { app, fmtTime } from './store.svelte'

  let queue = $state<library.Track[]>([])

  // Refresh whenever the track or the play order changes.
  $effect(() => {
    app.now?.track.id
    app.settings.shuffle
    app.settings.repeat
    GetQueue().then((q) => {
      queue = q ?? []
    })
  })
</script>

{#if queue.length === 0}
  <p class="empty">La file d'attente est vide.</p>
{:else}
  <ol>
    {#each queue.slice(0, 50) as t, i (i)}
      <li class:current={i === 0}>
        <span class="title">{t.title}</span>
        <span class="artist">{t.artist}</span>
        <span class="dur">{fmtTime(t.duration)}</span>
      </li>
    {/each}
  </ol>
  {#if queue.length > 50}<p class="empty">… et {queue.length - 50} autres</p>{/if}
{/if}

<style>
  ol { list-style: none; margin: 0; padding: 0; }
  li {
    display: grid;
    grid-template-columns: 1fr auto;
    padding: 6px 4px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }
  .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .artist { grid-row: 2; font-size: 12px; color: var(--text-dim); }
  .dur { grid-row: 1 / 3; grid-column: 2; align-self: center; font-size: 12px; color: var(--text-dim); }
  .current .title { color: var(--accent); font-weight: 700; }
  .empty { color: var(--text-dim); font-size: 13px; }
</style>
