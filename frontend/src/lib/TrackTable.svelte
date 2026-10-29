<script lang="ts">
  import type { library } from '../../wailsjs/go/models'
  import { albumKey, albumTitle, app, artistKey, artistName, fmtTime, go, playTracks } from './store.svelte'
  import Cover from './Cover.svelte'
  import Icon from './Icon.svelte'

  /**
   * Spotify-like track list. Double-click or Enter plays the list from that track,
   * right-click opens the context menu. positions are the playlist indexes of the rows, when showing a playlist.
   */
  let {
    tracks,
    playlistId,
    positions,
    numbers = 'index',
    showAlbum = true,
    showCover = true,
    sortable = false,
  }: {
    tracks: library.Track[]
    playlistId?: string
    positions?: number[]
    numbers?: 'index' | 'track'
    showAlbum?: boolean
    showCover?: boolean
    sortable?: boolean
  } = $props()

  type SortKey = 'title' | 'artist' | 'album' | 'duration'
  let sort = $state<{ key: SortKey; desc: boolean } | null>(null)
  let selected = $state('')

  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

  /** Row order, as indexes into tracks (the original order unless a column is sorted). */
  const order = $derived.by(() => {
    const idx = tracks.map((_, i) => i)
    if (!sort) return idx
    const { key, desc } = sort
    const val = (t: library.Track) => (key === 'artist' ? t.group : t[key])
    idx.sort((a, b) => {
      const x = val(tracks[a]), y = val(tracks[b])
      const c = typeof x === 'number' ? x - (y as number) : collator.compare(x as string, y as string)
      return desc ? -c : c
    })
    return idx
  })
  const rows = $derived(order.map((i) => tracks[i]))
  const multiDisc = $derived(numbers === 'track' && new Set(tracks.map((t) => t.discNo)).size > 1)

  function toggleSort(key: SortKey) {
    if (!sortable) return
    if (sort?.key !== key) sort = { key, desc: false }
    else if (!sort.desc) sort = { key, desc: true }
    else sort = null
  }

  function play(k: number) {
    playTracks(rows, k)
  }

  function openMenu(e: MouseEvent, k: number) {
    e.preventDefault()
    selected = rows[k].id
    app.menu = {
      x: e.clientX,
      y: e.clientY,
      tracks: [rows[k]],
      playlistId,
      index: positions?.[order[k]],
    }
  }

  function link(e: Event, fn: () => void) {
    e.stopPropagation()
    fn()
  }
</script>

{#snippet head(key: SortKey | null, label: string, cls = '')}
  {#if sortable && key}
    <button class="th {cls}" class:sorted={sort?.key === key} onclick={() => toggleSort(key)}>
      {label}{#if sort?.key === key}<span class="arrow">{sort.desc ? '▼' : '▲'}</span>{/if}
    </button>
  {:else}
    <span class="th {cls}">{label}</span>
  {/if}
{/snippet}

<div class="table" class:noalbum={!showAlbum} role="grid">
  <div class="head">
    <span class="th num">#</span>
    {@render head('title', 'Titre')}
    {#if showAlbum}{@render head('album', 'Album', 'col-album')}{/if}
    {#if sortable}
      <button class="th dur" class:sorted={sort?.key === 'duration'} onclick={() => toggleSort('duration')} title="Durée">
        <Icon name="clock" size={16} />
      </button>
    {:else}
      <span class="th dur" title="Durée"><Icon name="clock" size={16} /></span>
    {/if}
  </div>

  {#each rows as t, k (playlistId ? `${positions?.[order[k]]}` : t.id)}
    {@const current = app.now?.track.id === t.id}
    {#if multiDisc && (k === 0 || rows[k - 1].discNo !== t.discNo)}
      <div class="disc"><Icon name="album" size={16} /> Disque {t.discNo || 1}</div>
    {/if}
    <div
      class="row"
      class:current
      class:selected={selected === t.id}
      role="row"
      tabindex="0"
      onclick={() => (selected = t.id)}
      ondblclick={() => play(k)}
      onkeydown={(e) => e.key === 'Enter' && play(k)}
      oncontextmenu={(e) => openMenu(e, k)}
    >
      <span class="num">
        {#if current && !app.state.paused}
          <span class="bars" aria-label="En lecture"><i></i><i></i><i></i></span>
        {:else}
          <span class="n">{numbers === 'track' ? t.trackNo || '–' : k + 1}</span>
        {/if}
        <button class="rowplay" title="Lire" onclick={(e) => link(e, () => play(k))}><Icon name="play" size={16} /></button>
      </span>
      <span class="main">
        {#if showCover}<span class="thumb"><Cover ids={[t.id]} /></span>{/if}
        <span class="names">
          <span class="title">{t.title}</span>
          <button class="sub link" onclick={(e) => link(e, () => go({ view: 'artist', key: artistKey(t.group) }))}>
            {artistName(t.artist)}
          </button>
        </span>
      </span>
      {#if showAlbum}
        <span class="album">
          <button class="link" onclick={(e) => link(e, () => go({ view: 'album', key: albumKey(t) }))}>{albumTitle(t.album)}</button>
        </span>
      {/if}
      <span class="dur">
        <button class="more" title="Plus d'options" onclick={(e) => { e.stopPropagation(); openMenu(e, k) }}>
          <Icon name="more" size={18} />
        </button>
        {fmtTime(t.duration)}
      </span>
    </div>
  {/each}
</div>

<style>
  .table { --cols: 44px minmax(0, 5fr) minmax(0, 3fr) 90px; }
  .table.noalbum { --cols: 44px minmax(0, 1fr) 90px; }
  /* The album column goes first, then the numbers. */
  @media (max-width: 700px) {
    .table, .table.noalbum { --cols: 36px minmax(0, 1fr) 76px; }
    .album, .th.col-album { display: none; }
    .head, .row { gap: 8px; padding: 0 8px; }
  }
  @media (max-width: 480px) {
    .table, .table.noalbum { --cols: minmax(0, 1fr) 64px; }
    .num { display: none; }
    .thumb { width: 36px; }
    .dur { gap: 4px; }
  }
  .head, .row {
    display: grid;
    grid-template-columns: var(--cols);
    align-items: center;
    gap: 12px;
    padding: 0 12px;
  }
  .head {
    position: sticky;
    top: var(--sticky-top, 0);
    z-index: 1;
    height: 36px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg1) 85%, black);
  }
  .th {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-dim);
    text-align: left;
    padding: 0;
  }
  button.th:hover, .th.sorted { color: var(--text); }
  .arrow { font-size: 8px; color: var(--accent); }
  .th.num { justify-content: center; }
  .th.dur { justify-content: flex-end; }
  .disc {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 12px 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-dim);
  }
  .row {
    min-height: 56px;
    border-radius: 6px;
    cursor: default;
    content-visibility: auto;
    contain-intrinsic-size: auto 56px;
  }
  .row:hover { background: var(--surface); }
  .row.selected, .row:focus-visible { background: var(--surface-hover); outline: none; }
  .num { position: relative; display: grid; place-items: center; color: var(--text-dim); font-variant-numeric: tabular-nums; }
  .rowplay { position: absolute; inset: 0; display: none; place-items: center; color: var(--text); }
  .row:hover .rowplay { display: grid; }
  .row:hover .num > :not(.rowplay) { visibility: hidden; }
  .main { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .thumb { flex: none; width: 40px; }
  .thumb :global(.cover) { border-radius: 4px; box-shadow: none; }
  .names { display: flex; flex-direction: column; min-width: 0; }
  .title, .sub, .album { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-size: 15px; }
  .current .title, .current .n { color: var(--accent); }
  .sub, .album { font-size: 13px; color: var(--text-dim); text-align: left; }
  .link { max-width: 100%; padding: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: inherit; }
  .link:hover { color: var(--text); text-decoration: underline; }
  .row:hover .sub, .row:hover .album { color: var(--text); }
  .dur {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    font-size: 13px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .more { display: grid; color: var(--text-dim); visibility: hidden; }
  .more:hover { color: var(--text); }
  .row:hover .more, .row.selected .more { visibility: visible; }
  .bars { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
  .bars i { width: 3px; background: var(--accent); animation: bounce 0.9s ease-in-out infinite; }
  .bars i:nth-child(2) { animation-delay: -0.3s; }
  .bars i:nth-child(3) { animation-delay: -0.6s; }
  @keyframes bounce { 0%, 100% { height: 30%; } 50% { height: 100%; } }
</style>
