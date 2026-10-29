<script lang="ts">
  import type { Snippet } from 'svelte'
  import Cover from './Cover.svelte'
  import Icon from './Icon.svelte'

  /** Big header of an album, artist or playlist page, with its play / shuffle actions. */
  let {
    kind,
    title,
    ids,
    round = false,
    icon = 'note',
    meta,
    actions,
    onplay,
    onshuffle,
    onrename,
  }: {
    kind: string
    title: string
    ids: string[]
    round?: boolean
    icon?: string
    meta?: Snippet
    actions?: Snippet
    onplay: () => void
    onshuffle: () => void
    onrename?: (name: string) => void
  } = $props()

  let editing = $state(false)

  function commit(e: Event & { currentTarget: HTMLInputElement }) {
    if (!editing) return
    editing = false
    const name = e.currentTarget.value.trim()
    if (name && name !== title) onrename?.(name)
  }

  function focus(el: HTMLInputElement) {
    el.focus()
    el.select()
  }
</script>

<header>
  <div class="art"><Cover {ids} {round} {icon} /></div>
  <div class="text">
    <span class="kind">{kind}</span>
    {#if editing}
      <input
        class="rename"
        value={title}
        use:focus
        onblur={commit}
        onkeydown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') editing = false
        }}
      />
    {:else if onrename}
      <h1><button class="title" title="Renommer" onclick={() => (editing = true)}>{title}</button></h1>
    {:else}
      <h1>{title}</h1>
    {/if}
    {#if meta}<div class="meta">{@render meta()}</div>{/if}
  </div>
</header>

<div class="bar">
  <button class="play" title="Lire" onclick={onplay}><Icon name="play" size={28} /></button>
  <button class="icon" title="Lecture aléatoire" onclick={onshuffle}><Icon name="shuffle" size={26} /></button>
  {#if onrename}
    <button class="icon" title="Renommer" onclick={() => (editing = true)}><Icon name="edit" size={22} /></button>
  {/if}
  {@render actions?.()}
</div>

<style>
  header {
    display: flex;
    align-items: flex-end;
    gap: 24px;
    padding: 24px 0 20px;
  }
  .art { flex: none; width: clamp(140px, 22vw, 220px); }
  .text { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .kind { font-size: 13px; font-weight: 700; }
  h1, .rename {
    margin: 0;
    font-size: clamp(28px, 5vw, 64px);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  h1 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .title { font: inherit; letter-spacing: inherit; text-align: left; padding: 0; }
  .rename {
    width: 100%;
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-family: inherit;
    outline: none;
  }
  .meta { font-size: 14px; color: var(--text-dim); }
  .meta :global(b) { color: var(--text); }
  .bar { display: flex; align-items: center; gap: 18px; padding: 8px 0 16px; }
  .play {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent);
    color: #111;
    transition: transform 0.12s;
  }
  .play:hover { transform: scale(1.05); }
  .icon { display: grid; color: var(--text-dim); transition: color 0.12s, transform 0.12s; }
  .icon:hover { color: var(--text); transform: scale(1.06); }
  @media (max-width: 640px) {
    header { flex-direction: column; align-items: flex-start; gap: 16px; padding: 16px 0 12px; }
    .art { width: 140px; }
    .play { width: 48px; height: 48px; }
  }
  @media (max-height: 560px) {
    header { padding: 12px 0 8px; }
    .art { width: 120px; }
  }
</style>
