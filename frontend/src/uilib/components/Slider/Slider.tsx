import type { ReactNode } from 'react';
import { useControllable } from '../../hooks/useControllable';
import { cx } from '../../utils';
import { Track } from '../Track/Track';
import './Slider.css';

export interface SliderProps {
  label: ReactNode;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Value where the fill starts (default `min`). */
  origin?: number;
  /** Value restored on double tap / Delete key. Default `defaultValue ?? min`. */
  resetValue?: number;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

/** Full-width fill slider: label left, value right (e.g. "Reverb 0%"). */
export function Slider({
  label,
  value,
  defaultValue,
  onChange,
  onChangeEnd,
  min = 0,
  max = 100,
  step = 1,
  origin,
  resetValue,
  format = String,
  disabled,
  className,
}: SliderProps) {
  const [v, setV] = useControllable(value, defaultValue ?? min, onChange);
  const text = format(v);
  return (
    <Track
      className={cx('ui-slider', className)}
      value={v}
      min={min}
      max={max}
      step={step}
      origin={origin}
      onChange={setV}
      onChangeEnd={onChangeEnd}
      resetValue={resetValue ?? defaultValue ?? min}
      disabled={disabled}
      ariaLabel={typeof label === 'string' ? label : undefined}
      ariaValueText={text}
    >
      <span className="ui-slider__label">{label}</span>
      <span className="ui-slider__value">{text}</span>
    </Track>
  );
}
