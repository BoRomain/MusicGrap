import { useCallback, useRef, useState } from 'react';

/** Supports both controlled (`value`) and uncontrolled (`defaultValue`) usage. */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void) {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const currentRef = useRef(current);
  currentRef.current = current;

  const set = useCallback(
    (next: T) => {
      if (Object.is(next, currentRef.current)) return;
      if (!controlled) setInner(next);
      currentRef.current = next;
      onChange?.(next);
    },
    [controlled, onChange],
  );

  return [current, set] as const;
}
