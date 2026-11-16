import { useLayoutEffect, useRef, type HTMLAttributes } from 'react';
import { useControllable } from '../../hooks/useControllable';
import { useRovingRadio } from '../../hooks/useRovingRadio';
import { cx, normalizeOption, type Option } from '../../utils';
import './SegmentedControl.css';

export interface SegmentedControlProps<T extends string> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  options: Option<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  defaultValue,
  onChange,
  disabled,
  className,
  ...rest
}: SegmentedControlProps<T>) {
  const items = options.map(normalizeOption).map((o) => ({ ...o, disabled: o.disabled || !!disabled }));
  const [current, setCurrent] = useControllable<T | undefined>(value, defaultValue ?? items[0]?.value, onChange as (v: T | undefined) => void);
  const onKeyDown = useRovingRadio(items, current, (v) => setCurrent(v));
  const focusIdx = Math.max(0, items.findIndex((i) => i.value === current));
  const rootRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const placed = useRef(false);

  // Move the sliding indicator under the selected item (DOM writes only, no re-render).
  const place = (animate: boolean) => {
    const root = rootRef.current;
    const indicator = indicatorRef.current;
    if (!root || !indicator) return;
    const target = root.querySelector<HTMLElement>('.ui-segmented__item[aria-checked="true"]');
    if (!target) {
      indicator.style.opacity = '0';
      return;
    }
    const width = `${target.offsetWidth}px`;
    const transform = `translateX(${target.offsetLeft}px)`;
    if (indicator.style.width === width && indicator.style.transform === transform) return;
    if (!animate) indicator.classList.add('ui-segmented__indicator--instant');
    indicator.style.opacity = '1';
    indicator.style.width = width;
    indicator.style.transform = transform;
    if (!animate) {
      void indicator.offsetWidth; // flush styles before re-enabling the transition
      indicator.classList.remove('ui-segmented__indicator--instant');
    }
  };
  const placeRef = useRef(place);
  placeRef.current = place;

  // Selection change: animate (except the very first placement).
  useLayoutEffect(() => {
    place(placed.current);
    placed.current = true;
  }, [current, options.length]);

  // Resize (fonts, layout, rotation): re-measure without animation.
  // Created once: the observer fires on observe(), and the unchanged-position check
  // above keeps that first call from cancelling a running transition.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => placeRef.current(false));
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-disabled={disabled || undefined}
      className={cx('ui-segmented', disabled && 'ui-segmented--disabled', className)}
      onKeyDown={onKeyDown}
      {...rest}
    >
      <div ref={indicatorRef} className="ui-segmented__indicator" aria-hidden />
      {items.map((o, i) => {
        const selected = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === focusIdx ? 0 : -1}
            disabled={o.disabled}
            className={cx('ui-segmented__item ui-focusable', selected && 'ui-segmented__item--selected')}
            onClick={() => setCurrent(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
