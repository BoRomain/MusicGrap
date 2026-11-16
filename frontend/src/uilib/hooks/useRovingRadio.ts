import type { KeyboardEvent } from 'react';

/** Arrow-key navigation for radiogroup-like components (ChipGroup, SegmentedControl). */
export function useRovingRadio<T>(items: { value: T; disabled: boolean }[], current: T, select: (v: T) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const enabled = items.filter((i) => !i.disabled);
    if (!enabled.length) return;
    const idx = Math.max(0, enabled.findIndex((i) => Object.is(i.value, current)));
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % enabled.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    if (next < 0) return;
    e.preventDefault();
    select(enabled[next].value);
    const group = e.currentTarget;
    requestAnimationFrame(() => {
      group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    });
  };
}
