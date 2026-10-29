<script lang="ts">
  import Cover from './Cover.svelte'
  import Icon from './Icon.svelte'

  /** Grid card for an album, artist or playlist: click opens it, the round button plays it. */
  let {
    ids,
    title,
    subtitle = '',
    round = false,
    icon = 'note',
    onopen,
    onplay,
  }: {
    ids: string[]
    title: string
    subtitle?: string
    round?: boolean
    icon?: string
    onopen: () => void
    onplay: () => void
  } = $props()
</script>

<div class="card" class:round role="button" tabindex="0" onclick={onopen} onkeydown={(e) => e.key === 'Enter' && onopen()}>
  <div class="art">
    <Cover {ids} {round} {icon} />
    <button
      class="play"
      title="Lire"
      onclick={(e) => {
        e.stopPropagation()
        onplay()
      }}
    >
      <Icon name="play" size={22} />
    </button>
  </div>
  <span class="title">{title}</span>
  {#if subtitle}<span class="sub">{subtitle}</span>{/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 12px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.2s;
    content-visibility: auto;
    contain-intrinsic-size: auto 240px;
  }
  .card:hover, .card:focus-visible { background: var(--surface-hover); outline: none; }
  .art { position: relative; margin-bottom: 8px; }
  .play {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--accent);
    color: #111;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.2s, transform 0.2s;
  }
  .play:hover { transform: scale(1.06) !important; }
  .card:hover .play, .card:focus-within .play { opacity: 1; transform: none; }
  .title, .sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-weight: 700; }
  .round .title, .round .sub { text-align: center; }
  .sub { font-size: 13px; color: var(--text-dim); }
</style>
