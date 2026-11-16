import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import { clamp, cx, snap } from '../../utils';
import './Track.css';

export interface TrackProps {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Value where the fill starts. Defaults to `min`. Use 0 for bipolar ranges. */
  origin?: number;
  /** When omitted the track is read-only (display only). */
  onChange?: (v: number) => void;
  /** Called when the user releases the pointer or uses the keyboard. */
  onChangeEnd?: (v: number) => void;
  /** Value restored on double click / double tap / Delete key. */
  resetValue?: number;
  disabled?: boolean;
  ariaLabel?: string;
  ariaValueText?: string;
  className?: string;
  children?: ReactNode;
}

/** Internal fill track shared by Slider, ValueTile and HeroDisplay. */
export function Track({
  value,
  min,
  max,
  step,
  origin = min,
  onChange,
  onChangeEnd,
  resetValue,
  disabled,
  ariaLabel,
  ariaValueText,
  className,
  children,
}: TrackProps) {
  const interactive = !!onChange && !disabled;
  const span = max - min || 1;
  const ratio = clamp((value - min) / span, 0, 1);
  const originRatio = clamp((origin - min) / span, 0, 1);
  /** Time the last plain tap (press + release without moving) ended. */
  const lastTap = useRef(0);
  /** Press that may be the second tap of a double tap: no value change until we know. */
  const pendingReset = useRef(false);

  const commit = (v: number) => {
    const next = clamp(snap(v, min, step), min, max);
    onChange?.(next);
    return next;
  };

  const onPointerDown = usePointerDrag(({ ratioX, phase, moved }) => {
    if (phase === 'start') {
      pendingReset.current = resetValue !== undefined && Date.now() - lastTap.current < 300;
      if (pendingReset.current) return;
    }
    if (pendingReset.current) {
      // Second press turned into a drag: a normal drag, not a reset.
      if (moved) pendingReset.current = false;
      else if (phase === 'end') {
        // Second tap released without moving: double tap, reset.
        pendingReset.current = false;
        lastTap.current = 0;
        onChangeEnd?.(commit(resetValue!));
        return;
      } else return;
    }
    const v = commit(min + ratioX * span);
    if (phase === 'end') {
      // Only a plain tap can open a double tap; a drag never does.
      lastTap.current = moved ? 0 : Date.now();
      onChangeEnd?.(v);
    }
  }, !interactive);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const big = step * 10 > span ? step : step * 10;
    const map: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    };
    if (e.key in map) {
      e.preventDefault();
      onChangeEnd?.(commit(map[e.key]));
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && resetValue !== undefined) {
      e.preventDefault();
      onChangeEnd?.(commit(resetValue));
    }
  };

  const style = {
    '--ui-p': ratio,
    '--ui-fill-from': Math.min(ratio, originRatio),
    '--ui-fill-size': Math.abs(ratio - originRatio),
  } as CSSProperties;

  const isSlider = !!onChange;

  return (
    <div
      className={cx('ui-track', interactive && 'ui-track--interactive ui-focusable', disabled && 'ui-track--disabled', className)}
      style={style}
      role={isSlider ? 'slider' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      aria-valuemin={isSlider ? min : undefined}
      aria-valuemax={isSlider ? max : undefined}
      aria-valuenow={isSlider ? value : undefined}
      aria-valuetext={isSlider ? ariaValueText : undefined}
      aria-disabled={disabled || undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onKeyDown={onKeyDown}
    >
      <div className="ui-track__fill" aria-hidden />
      <div className="ui-track__edge" aria-hidden />
      <div className="ui-track__content">{children}</div>
    </div>
  );
}
