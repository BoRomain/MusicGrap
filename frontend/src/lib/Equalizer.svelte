<script module lang="ts">
  import { DEFAULT_HZ } from './eqCurve'

  // Kept while the app runs, so the points stay put when the panel closes.
  // db is null while the curve follows the band gains (preset or saved settings).
  const memory = { hz: [...DEFAULT_HZ], db: null as number[] | null }
</script>

<script lang="ts">
  import { isMobile, SetEQGains, SetEQPreset } from '$backend'
  import { app } from './store.svelte'
  import { bandsCurve, clamp, fmtDb, fmtHz, MAX_DB, MAX_HZ, MIN_HZ, pointsCurve, sample, ZONES, type Point } from './eqCurve'

  const presetNames = ['Flat', 'Bass Boost', 'Treble Boost', 'Vocal', 'Rock', 'Electronic', 'Hip-Hop', 'Lo-Fi']
  const names = ['Graves', 'Médiums', 'Aigus']

  // Layout of the graph, in px.
  const H = isMobile ? 220 : 180
  const PAD = { l: 30, r: 14, t: 14, b: 24 }
  const HIT = isMobile ? 36 : 24

  let width = $state(0)
  let points = $state<Point[]>(memory.hz.map((hz, i) => ({ hz, db: memory.db?.[i] ?? 0 })))
  /** True once the user dragged a point: the curve then comes from the 3 points. */
  let editing = $state(memory.db !== null && app.settings.eqPreset === 'Custom')
  let active = $state(-1)

  const LOG_MIN = Math.log10(MIN_HZ)
  const LOG_SPAN = Math.log10(MAX_HZ) - LOG_MIN
  const x = (hz: number) => PAD.l + ((Math.log10(hz) - LOG_MIN) / LOG_SPAN) * (width - PAD.l - PAD.r)
  const y = (db: number) => PAD.t + ((MAX_DB - db) / (2 * MAX_DB)) * (H - PAD.t - PAD.b)
  const hzAt = (px: number) => 10 ** (LOG_MIN + ((px - PAD.l) / (width - PAD.l - PAD.r)) * LOG_SPAN)
  const dbAt = (py: number) => MAX_DB - ((py - PAD.t) / (H - PAD.t - PAD.b)) * 2 * MAX_DB

  const curve = $derived(editing ? pointsCurve(points) : bandsCurve(app.settings.eq ?? [], app.bands))
  /** Points as drawn: on the band curve until the user edits them. */
  const shown = $derived(editing ? points : points.map((p) => ({ hz: p.hz, db: curve(p.hz) })))

  const line = $derived.by(() => {
    if (!width) return ''
    const n = 120
    let d = ''
    for (let i = 0; i <= n; i++) {
      const px = PAD.l + (i / n) * (width - PAD.l - PAD.r)
      d += `${i ? 'L' : 'M'}${px.toFixed(1)},${y(curve(hzAt(px))).toFixed(1)}`
    }
    return d
  })
  const area = $derived(line && `${line}L${width - PAD.r},${y(0)}L${PAD.l},${y(0)}Z`)

  // ---- Sending the gains, at most once per frame ----

  let frame = 0
  function push() {
    memory.hz = points.map((p) => p.hz)
    memory.db = points.map((p) => p.db)
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const gains = sample(pointsCurve(points), app.bands)
      app.settings.eq = gains
      app.settings.eqPreset = 'Custom'
      SetEQGains(gains)
    })
  }

  /** Points take over from the band curve, starting where they are drawn. */
  function startEditing() {
    if (editing) return
    points = shown.map((p) => ({ hz: p.hz, db: Math.round(p.db * 2) / 2 }))
    editing = true
  }

  function move(i: number, hz: number, db: number) {
    startEditing()
    points[i] = { hz: clamp(hz, ...ZONES[i]), db: clamp(Math.round(db * 2) / 2, -MAX_DB, MAX_DB) }
    push()
  }

  async function applyPreset(name: string) {
    editing = false
    memory.db = null
    app.settings.eqPreset = name
    app.settings.eq = await SetEQPreset(name)
  }

  // ---- Pointer: grab the nearest point, double tap resets its gain ----

  let drag: { i: number; dx: number; dy: number } | null = null
  let lastTap = { i: -1, t: 0 }

  const target = (e: PointerEvent) => e.currentTarget as SVGSVGElement

  function local(e: PointerEvent) {
    const r = target(e).getBoundingClientRect()
    return { px: e.clientX - r.left, py: e.clientY - r.top }
  }

  function down(e: PointerEvent) {
    const { px, py } = local(e)
    let best = -1
    let dist = HIT
    shown.forEach((p, i) => {
      const d = Math.hypot(x(p.hz) - px, y(p.db) - py)
      if (d < dist) [best, dist] = [i, d]
    })
    if (best < 0) return
    e.preventDefault()
    const now = performance.now()
    if (lastTap.i === best && now - lastTap.t < 320) {
      move(best, shown[best].hz, 0)
      lastTap = { i: -1, t: 0 }
      return
    }
    lastTap = { i: best, t: now }
    const p = shown[best]
    drag = { i: best, dx: x(p.hz) - px, dy: y(p.db) - py }
    active = best
    target(e).setPointerCapture(e.pointerId)
  }

  function moveDrag(e: PointerEvent) {
    if (!drag) return
    const { px, py } = local(e)
    move(drag.i, hzAt(px + drag.dx), dbAt(py + drag.dy))
  }

  function up() {
    drag = null
    active = -1
  }

  // ---- Keyboard: arrows move the focused point ----

  function key(i: number, e: KeyboardEvent) {
    const p = shown[i]
    const step = e.shiftKey ? 3 : 1
    const ratio = 2 ** (step / 12) // a semitone per press, three with Shift
    const moves: Record<string, () => void> = {
      ArrowUp: () => move(i, p.hz, p.db + 0.5 * step),
      ArrowDown: () => move(i, p.hz, p.db - 0.5 * step),
      ArrowRight: () => move(i, p.hz * ratio, p.db),
      ArrowLeft: () => move(i, p.hz / ratio, p.db),
      '0': () => move(i, p.hz, 0),
    }
    if (moves[e.key]) {
      e.preventDefault()
      moves[e.key]()
    }
  }

  const label = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`)
</script>

<div class="eq">
  <div class="presets">
    {#each presetNames as name}
      <button class:active={app.settings.eqPreset === name} onclick={() => applyPreset(name)}>{name}</button>
    {/each}
    {#if app.settings.eqPreset === 'Custom'}<span class="custom">Personnalisé</span>{/if}
  </div>

  <div class="graph" bind:clientWidth={width} style="height:{H}px">
    {#if width}
      <svg
        {width}
        height={H}
        role="group"
        aria-label="Courbe de l'égaliseur"
        onpointerdown={down}
        onpointermove={moveDrag}
        onpointerup={up}
        onpointercancel={up}
      >
        {#each [MAX_DB, MAX_DB / 2, 0, -MAX_DB / 2, -MAX_DB] as db}
          <line class="grid" class:zero={db === 0} x1={PAD.l} x2={width - PAD.r} y1={y(db)} y2={y(db)} />
          <text class="axis" x={PAD.l - 6} y={y(db)} text-anchor="end" dominant-baseline="middle">{db > 0 ? '+' : ''}{db}</text>
        {/each}
        {#each app.bands as hz}
          <line class="tick" x1={x(hz)} x2={x(hz)} y1={PAD.t} y2={H - PAD.b} />
          <text class="axis" x={x(hz)} y={H - 6} text-anchor="middle">{label(hz)}</text>
        {/each}

        <path class="area" d={area} />
        <path class="line" d={line} />

        {#each shown as p, i}
          <g
            class="point"
            class:active={active === i}
            transform="translate({x(p.hz)},{y(p.db)})"
            role="slider"
            tabindex="0"
            aria-label={names[i]}
            aria-valuemin={-MAX_DB}
            aria-valuemax={MAX_DB}
            aria-valuenow={p.db}
            aria-valuetext="{fmtHz(p.hz)}, {fmtDb(p.db)}"
            onkeydown={(e) => key(i, e)}
          >
            <circle class="ring" r="11" />
            <circle class="dot" r="7" />
          </g>
        {/each}

        {#if active >= 0}
          {@const p = shown[active]}
          {@const tx = clamp(x(p.hz), PAD.l + 50, width - PAD.r - 50)}
          {@const ty = y(p.db) > PAD.t + 40 ? y(p.db) - 26 : y(p.db) + 34}
          <g class="tip" transform="translate({tx},{ty})">
            <rect x="-50" y="-13" width="100" height="22" rx="11" />
            <text text-anchor="middle" dominant-baseline="middle" y="-2">{fmtHz(p.hz)} · {fmtDb(p.db)}</text>
          </g>
        {/if}
      </svg>
    {/if}
  </div>
  <span class="hint">Glissez les points. {isMobile ? 'Double tap' : 'Double-clic'} : retour à 0 dB.</span>
</div>

<style>
  .presets { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 16px; }
  .presets button, .custom {
    padding: 5px 12px;
    border-radius: 999px;
    background: var(--surface);
    font-size: 12px;
  }
  .presets button:hover { background: var(--surface-hover); }
  .presets button.active { background: var(--accent); color: #111; font-weight: 700; }
  .custom { color: var(--accent); background: none; }

  .graph { position: relative; width: 100%; }
  svg { display: block; touch-action: none; cursor: default; overflow: visible; }
  .grid { stroke: rgba(255, 255, 255, 0.07); stroke-width: 1; }
  .grid.zero { stroke: rgba(255, 255, 255, 0.22); }
  .tick { stroke: rgba(255, 255, 255, 0.04); stroke-width: 1; }
  .axis { fill: var(--text-dim); font-size: 10px; font-variant-numeric: tabular-nums; }
  .area { fill: color-mix(in srgb, var(--accent) 22%, transparent); }
  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 3;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .point { cursor: grab; outline: none; }
  .point .ring { fill: color-mix(in srgb, var(--accent) 35%, transparent); transition: r 0.15s; }
  .point .dot { fill: #fff; stroke: var(--accent); stroke-width: 2; transition: r 0.15s; }
  .point:focus-visible .ring, .point.active .ring { r: 16px; }
  @media (hover: hover) { .point:hover .ring { r: 16px; } }
  .point.active { cursor: grabbing; }
  .point.active .dot { r: 9px; }
  .point:focus-visible .dot { stroke: #fff; stroke-width: 3; }
  .tip rect { fill: color-mix(in srgb, var(--bg1) 85%, black); stroke: var(--border); }
  .tip text { fill: var(--text); font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .hint { display: block; margin-top: 10px; font-size: 11px; color: var(--text-dim); }
  :global(html.mobile) .axis { font-size: 11px; }
</style>
