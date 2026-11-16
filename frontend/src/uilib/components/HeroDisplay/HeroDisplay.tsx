import type { ReactNode } from 'react';
import { useControllable } from '../../hooks/useControllable';
import { cx } from '../../utils';
import { Track } from '../Track/Track';
import './HeroDisplay.css';

export interface HeroDisplayProps {
  /** Small uppercase caption, e.g. "Vitesse". */
  label: ReactNode;
  value?: number;
  defaultValue?: number;
  /** When set, the hero becomes a draggable slider. */
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  origin?: number;
  resetValue?: number;
  /** Suffix shown small next to the value, e.g. "×". */
  unit?: string;
  format?: (value: number) => string;
  /** Secondary line, e.g. "0.0 demi-tons". */
  sub?: ReactNode;
  /** Replace the default disc icon. Pass `null` to hide it. */
  icon?: ReactNode;
  /** Rotate the disc icon (e.g. while audio plays). */
  spinning?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Disc({ spinning }: { spinning?: boolean }) {
  return (
    <svg className={cx('ui-disc', spinning && 'ui-disc--spinning')} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="31" fill="var(--ui-disc-bg)" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="var(--ui-disc-groove)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="var(--ui-disc-groove)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="9" fill="var(--ui-accent)" />
      <line x1="40" y1="45" x2="46" y2="54" stroke="var(--ui-disc-arm)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Big headline value with disc icon and fill background (e.g. playback speed). */
export function HeroDisplay({
  label,
  value,
  defaultValue,
  onChange,
  onChangeEnd,
  min = 0.5,
  max = 1.5,
  step = 0.01,
  origin,
  resetValue,
  unit,
  format = (v) => v.toFixed(2),
  sub,
  icon,
  spinning,
  disabled,
  className,
}: HeroDisplayProps) {
  const [v, setV] = useControllable(value, defaultValue ?? 1, onChange);
  const text = format(v);
  return (
    <Track
      className={cx('ui-hero', className)}
      value={v}
      min={min}
      max={max}
      step={step}
      origin={origin}
      onChange={onChange || value === undefined ? setV : undefined}
      onChangeEnd={onChangeEnd}
      resetValue={resetValue ?? defaultValue ?? 1}
      disabled={disabled}
      ariaLabel={typeof label === 'string' ? label : undefined}
      ariaValueText={unit ? `${text}${unit}` : text}
    >
      {icon !== null && <div className="ui-hero__icon">{icon ?? <Disc spinning={spinning} />}</div>}
      <div className="ui-hero__text">
        <div className="ui-hero__label">{label}</div>
        <div className="ui-hero__value">
          {text}
          {unit && <span className="ui-hero__unit">{unit}</span>}
        </div>
        {sub && <div className="ui-hero__sub">{sub}</div>}
      </div>
    </Track>
  );
}
