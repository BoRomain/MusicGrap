import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Next, Prev, Seek, SetRepeat, SetShuffle, TogglePause } from '$backend'
import { fill, fmtTime, patchSettings, patchState, useApp } from './store'
import { cx } from './cx'
import { Icon } from './Icon'
import './Transport.css'

const REPEAT_MODES = ['off', 'all', 'one']

function cycleRepeat() {
  const cur = useApp.getState().settings.repeat
  const next = REPEAT_MODES[(REPEAT_MODES.indexOf(cur) + 1) % REPEAT_MODES.length]
  patchSettings({ repeat: next })
  patchState({ repeat: next })
  SetRepeat(next)
}

function toggleShuffle() {
  const on = !useApp.getState().settings.shuffle
  patchSettings({ shuffle: on })
  SetShuffle(on)
}

/**
 * Playback controls + seek bar. In the bar the seek bar sits under the controls;
 * in cinema mode it spans the width above them, and extra is shown at the right of the controls.
 * The seek bar stays a compact native range: UiLib's Slider is a 52px panel.
 */
export function Transport({ cinema = false, extra }: { cinema?: boolean; extra?: ReactNode }) {
  const st = useApp((s) => s.state)
  const trackDuration = useApp((s) => s.now?.track.duration ?? 0)
  const shuffle = useApp((s) => s.settings.shuffle)
  const repeat = useApp((s) => s.settings.repeat)

  const [seeking, setSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)
  // Shortly after a seek, keep showing the target: a progress tick sent before the seek may still arrive.
  const [settling, setSettling] = useState(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(settleTimer.current), [])

  const position = seeking || (settling && Math.abs(st.position - seekValue) > 1.5) ? seekValue : st.position
  const duration = st.duration || trackDuration || 0

  function seekTo(v: number) {
    setSeekValue(v)
    patchState({ position: v })
    setSeeking(false)
    setSettling(true)
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => setSettling(false), 500)
    Seek(v)
  }

  const big = cinema ? 1.35 : 1

  return (
    <div className={cx('transport', cinema && 'cinema')}>
      <div className="controls">
        <span />
        <div className="buttons">
          <button className={cx('small', shuffle && 'on')} title="Aléatoire" onClick={toggleShuffle}>
            <Icon name="shuffle" size={18 * big} />
          </button>
          <button title="Précédent" onClick={() => Prev()}>
            <Icon name="prev" size={22 * big} />
          </button>
          <button className="play" title="Lecture / pause (Espace)" onClick={() => TogglePause()}>
            <Icon name={st.hasTrack && !st.paused ? 'pause' : 'play'} size={22 * big} />
          </button>
          <button title="Suivant" onClick={() => Next()}>
            <Icon name="next" size={22 * big} />
          </button>
          <button
            className={cx('small', repeat !== 'off' && 'on')}
            title={repeat === 'one' ? 'Répéter le titre' : repeat === 'all' ? 'Répéter tout' : 'Répétition désactivée'}
            onClick={cycleRepeat}
          >
            <Icon name="repeat" size={18 * big} />
            {repeat === 'one' && <span className="one">1</span>}
          </button>
        </div>
        <div className="extra">{extra}</div>
      </div>
      <div className="seek">
        <span>{fmtTime(position)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={position}
          style={fill(position, 0, duration || 1)}
          disabled={!st.hasTrack}
          onChange={(e) => {
            setSeeking(true)
            setSeekValue(+e.currentTarget.value)
          }}
          // React's onChange fires on every input; the seek is sent once the drag or key press ends.
          onPointerUp={(e) => seeking && seekTo(+e.currentTarget.value)}
          onKeyUp={(e) => seeking && seekTo(+e.currentTarget.value)}
        />
        <span>{fmtTime(duration)}</span>
      </div>
    </div>
  )
}
