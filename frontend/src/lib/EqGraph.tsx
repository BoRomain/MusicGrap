import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { isMobile } from '$backend'
import { clamp, fmtDb, fmtHz, MAX_DB, MAX_HZ, MIN_HZ, type Point } from './eqCurve'
import { cx } from './cx'
import './EqGraph.css'

const NAMES = ['Graves', 'Médiums', 'Aigus']

// Layout of the graph, in px.
const H = isMobile ? 220 : 180
const PAD = { l: 30, r: 14, t: 14, b: 24 }
const HIT = isMobile ? 36 : 24
const LOG_MIN = Math.log10(MIN_HZ)
const LOG_SPAN = Math.log10(MAX_HZ) - LOG_MIN

const label = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`)

/**
 * Draggable 3-point EQ curve (no UiLib equivalent). Shows `curve`, with the points at `points`;
 * onMove gets a point index and its wanted position, the parent clamps and stores it.
 */
export function EqGraph({
  curve,
  points,
  bands,
  onMove,
}: {
  curve: (hz: number) => number
  points: Point[]
  bands: number[]
  onMove: (i: number, hz: number, db: number) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(-1)
  const drag = useRef<{ i: number; dx: number; dy: number } | null>(null)
  const lastTap = useRef({ i: -1, t: 0 })

  useLayoutEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const x = (hz: number) => PAD.l + ((Math.log10(hz) - LOG_MIN) / LOG_SPAN) * (width - PAD.l - PAD.r)
  const y = (db: number) => PAD.t + ((MAX_DB - db) / (2 * MAX_DB)) * (H - PAD.t - PAD.b)
  const hzAt = (px: number) => 10 ** (LOG_MIN + ((px - PAD.l) / (width - PAD.l - PAD.r)) * LOG_SPAN)
  const dbAt = (py: number) => MAX_DB - ((py - PAD.t) / (H - PAD.t - PAD.b)) * 2 * MAX_DB

  let line = ''
  if (width) {
    const n = 120
    for (let i = 0; i <= n; i++) {
      const px = PAD.l + (i / n) * (width - PAD.l - PAD.r)
      line += `${i ? 'L' : 'M'}${px.toFixed(1)},${y(curve(hzAt(px))).toFixed(1)}`
    }
  }
  const area = line && `${line}L${width - PAD.r},${y(0)}L${PAD.l},${y(0)}Z`

  // ---- Pointer: grab the nearest point, double tap resets its gain ----

  function local(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { px: e.clientX - r.left, py: e.clientY - r.top }
  }

  function down(e: PointerEvent<SVGSVGElement>) {
    const { px, py } = local(e)
    let best = -1
    let dist = HIT
    points.forEach((p, i) => {
      const d = Math.hypot(x(p.hz) - px, y(p.db) - py)
      if (d < dist) [best, dist] = [i, d]
    })
    if (best < 0) return
    e.preventDefault()
    const now = performance.now()
    if (lastTap.current.i === best && now - lastTap.current.t < 320) {
      onMove(best, points[best].hz, 0)
      lastTap.current = { i: -1, t: 0 }
      return
    }
    lastTap.current = { i: best, t: now }
    const p = points[best]
    drag.current = { i: best, dx: x(p.hz) - px, dy: y(p.db) - py }
    setActive(best)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function move(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d) return
    const { px, py } = local(e)
    onMove(d.i, hzAt(px + d.dx), dbAt(py + d.dy))
  }

  function up() {
    drag.current = null
    setActive(-1)
  }

  // ---- Keyboard: arrows move the focused point ----

  function key(i: number, e: KeyboardEvent) {
    const p = points[i]
    const step = e.shiftKey ? 3 : 1
    const ratio = 2 ** (step / 12) // a semitone per press, three with Shift
    const moves: Record<string, () => void> = {
      ArrowUp: () => onMove(i, p.hz, p.db + 0.5 * step),
      ArrowDown: () => onMove(i, p.hz, p.db - 0.5 * step),
      ArrowRight: () => onMove(i, p.hz * ratio, p.db),
      ArrowLeft: () => onMove(i, p.hz / ratio, p.db),
      '0': () => onMove(i, p.hz, 0),
    }
    if (moves[e.key]) {
      e.preventDefault()
      moves[e.key]()
    }
  }

  const tip = active >= 0 ? points[active] : null

  return (
    <div className="eq-graph" ref={box} style={{ height: H }}>
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="group"
          aria-label="Courbe de l'égaliseur"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {[MAX_DB, MAX_DB / 2, 0, -MAX_DB / 2, -MAX_DB].map((db) => (
            <g key={db}>
              <line className={cx('grid', db === 0 && 'zero')} x1={PAD.l} x2={width - PAD.r} y1={y(db)} y2={y(db)} />
              <text className="axis" x={PAD.l - 6} y={y(db)} textAnchor="end" dominantBaseline="middle">
                {db > 0 ? '+' : ''}
                {db}
              </text>
            </g>
          ))}
          {bands.map((hz) => (
            <g key={hz}>
              <line className="tick" x1={x(hz)} x2={x(hz)} y1={PAD.t} y2={H - PAD.b} />
              <text className="axis" x={x(hz)} y={H - 6} textAnchor="middle">
                {label(hz)}
              </text>
            </g>
          ))}

          <path className="area" d={area} />
          <path className="line" d={line} />

          {points.map((p, i) => (
            <g
              key={i}
              className={cx('point', active === i && 'active')}
              transform={`translate(${x(p.hz)},${y(p.db)})`}
              role="slider"
              tabIndex={0}
              aria-label={NAMES[i]}
              aria-valuemin={-MAX_DB}
              aria-valuemax={MAX_DB}
              aria-valuenow={p.db}
              aria-valuetext={`${fmtHz(p.hz)}, ${fmtDb(p.db)}`}
              onKeyDown={(e) => key(i, e)}
            >
              <circle className="ring" r={11} />
              <circle className="dot" r={7} />
            </g>
          ))}

          {tip && (
            <g
              className="tip"
              transform={`translate(${clamp(x(tip.hz), PAD.l + 50, width - PAD.r - 50)},${
                y(tip.db) > PAD.t + 40 ? y(tip.db) - 26 : y(tip.db) + 34
              })`}
            >
              <rect x={-50} y={-13} width={100} height={22} rx={11} />
              <text textAnchor="middle" dominantBaseline="middle" y={-2}>
                {fmtHz(tip.hz)} · {fmtDb(tip.db)}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
