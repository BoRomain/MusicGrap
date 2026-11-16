import { useCallback, useRef } from 'react';

export interface DragInfo {
  /** Horizontal position inside the element, 0..1 (clamped). */
  ratioX: number;
  /** Vertical position inside the element, 0..1 (clamped, 0 = top). */
  ratioY: number;
  phase: 'start' | 'move' | 'end';
  /** True once the pointer has moved more than a few px from where it was pressed (sticky). */
  moved: boolean;
}

/** Distance in px a touch must travel before its direction is decided. */
const TOUCH_SLOP = 8;

/**
 * Pointer-events based drag (mouse, pen and touch).
 * Returns an onPointerDown handler to spread on the target element.
 *
 * Touch input waits for the gesture direction before it does anything:
 * a vertical move is left to the browser (native scroll, no value change),
 * a horizontal move starts the drag, and a touch released without moving is a tap.
 */
export function usePointerDrag(onDrag: (info: DragInfo) => void, disabled = false) {
  const cb = useRef(onDrag);
  cb.current = onDrag;

  return useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const el = e.currentTarget;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      let rect = el.getBoundingClientRect();
      let started = false;
      let moved = false;

      const emit = (ev: { clientX: number; clientY: number }, phase: DragInfo['phase']) => {
        const ratioX = rect.width ? (ev.clientX - rect.left) / rect.width : 0;
        const ratioY = rect.height ? (ev.clientY - rect.top) / rect.height : 0;
        cb.current({
          ratioX: Math.min(1, Math.max(0, ratioX)),
          ratioY: Math.min(1, Math.max(0, ratioY)),
          phase,
          moved,
        });
      };

      const start = (ev: { clientX: number; clientY: number }) => {
        started = true;
        rect = el.getBoundingClientRect();
        try {
          el.setPointerCapture(pointerId);
        } catch {
          /* ignore */
        }
        // Exposed for CSS: hover-like feedback while dragging, also on touch.
        el.setAttribute('data-dragging', '');
        emit(ev, 'start');
      };

      const cleanup = () => {
        el.removeAttribute('data-dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', end);
        el.removeEventListener('pointercancel', end);
      };

      function move(ev: PointerEvent) {
        if (ev.pointerId !== pointerId) return;
        const dx = Math.abs(ev.clientX - startX);
        const dy = Math.abs(ev.clientY - startY);
        if (dx >= TOUCH_SLOP || dy >= TOUCH_SLOP) moved = true;
        if (!started) {
          if (!moved) return;
          // Vertical intent: let the browser scroll, never touch the value.
          if (dy > dx) return cleanup();
          start(ev);
        }
        emit(ev, 'move');
      }

      function end(ev: PointerEvent) {
        if (ev.pointerId !== pointerId) return;
        if (ev.type === 'pointerup') {
          // Touch released without moving: a tap.
          if (!started) start(ev);
          emit(ev, 'end');
        }
        cleanup();
      }

      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      if (e.pointerType !== 'touch') start(e);
    },
    [disabled],
  );
}
