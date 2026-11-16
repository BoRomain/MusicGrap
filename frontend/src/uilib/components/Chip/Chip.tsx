import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { useControllable } from '../../hooks/useControllable';
import { useRovingRadio } from '../../hooks/useRovingRadio';
import { cx, normalizeOption, type Option } from '../../utils';
import './Chip.css';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected, className, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={rest.role === 'radio' ? undefined : selected}
      className={cx('ui-chip ui-focusable', selected && 'ui-chip--selected', className)}
      {...rest}
    />
  );
}

export interface ChipGroupProps<T extends string> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  options: Option<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  'aria-label'?: string;
}

/** Single-selection group of chips (presets). */
export function ChipGroup<T extends string>({ options, value, defaultValue, onChange, className, ...rest }: ChipGroupProps<T>) {
  const items = options.map(normalizeOption);
  const [current, setCurrent] = useControllable<T | undefined>(value, defaultValue ?? items[0]?.value, onChange as (v: T | undefined) => void);
  const onKeyDown = useRovingRadio(items, current, (v) => setCurrent(v));
  const focusIdx = Math.max(0, items.findIndex((i) => i.value === current));

  return (
    <div role="radiogroup" className={cx('ui-chip-group', className)} onKeyDown={onKeyDown} {...rest}>
      {items.map((o, i) => (
        <Chip
          key={o.value}
          role="radio"
          aria-checked={o.value === current}
          tabIndex={i === focusIdx ? 0 : -1}
          selected={o.value === current}
          disabled={o.disabled}
          onClick={() => setCurrent(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
