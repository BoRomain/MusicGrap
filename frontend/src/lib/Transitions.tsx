import { Card, Slider, Switch } from '@romain/uilib'
import { SetCrossfade, SetCrossfadeOnSkip } from '$backend'
import { patchSettings, useApp } from './store'

function setCrossfade(v: number) {
  patchSettings({ crossfade: v })
  SetCrossfade(v)
}

function setOnSkip(on: boolean) {
  patchSettings({ crossfadeOnSkip: on })
  SetCrossfadeOnSkip(on)
}

export function Transitions() {
  const crossfade = useApp((s) => s.settings.crossfade) ?? 0
  const onSkip = useApp((s) => s.settings.crossfadeOnSkip) ?? false

  return (
    <div className="panel-stack">
      <Slider
        label="Fondu enchaîné"
        value={crossfade}
        onChange={setCrossfade}
        min={0}
        max={12}
        step={1}
        resetValue={0}
        format={(v) => (v === 0 ? 'Désactivé' : `${v} s`)}
      />
      <p className="hint">
        {crossfade === 0 ? 'Enchaînement sans blanc. ' : ''}La fin d'un titre se fond dans le début du suivant. La durée
        reste la même en mode slowed.
      </p>
      <Card>
        <Card.Row title="Fondu au changement manuel" description="Aussi quand je change de titre moi-même">
          <Switch aria-label="Fondu au changement manuel" checked={onSkip} onChange={setOnSkip} />
        </Card.Row>
      </Card>
    </div>
  )
}
