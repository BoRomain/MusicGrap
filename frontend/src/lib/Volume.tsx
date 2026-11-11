import { SetVolume } from '$backend'
import { fill, patchSettings, useApp } from './store'
import { Icon } from './Icon'
import './Volume.css'

function setVolume(v: number) {
  patchSettings({ volume: v })
  SetVolume(v)
}

/** Mute button + compact volume range (the UiLib Slider is too tall for the player bar). */
export function Volume() {
  const volume = useApp((s) => s.settings.volume) ?? 0
  return (
    <div className="volume">
      <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)} title="Muet">
        <Icon name={volume > 0 ? 'volume' : 'mute'} size={18} />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        style={fill(volume, 0, 1)}
        onChange={(e) => setVolume(+e.currentTarget.value)}
      />
    </div>
  )
}
