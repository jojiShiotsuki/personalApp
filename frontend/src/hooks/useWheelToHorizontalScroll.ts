import { useEffect } from 'react';

/**
 * Translates vertical mouse-wheel deltas into horizontal scroll on the
 * referenced element. Defers to native vertical scroll when the cursor
 * is over a child that has scrollable vertical content in the wheel
 * direction (identified by the `data-col-scroll` attribute) — that way
 * a kanban column can scroll its own cards before the board slides
 * sideways.
 *
 * No-op when the user is already scrolling horizontally (trackpad
 * two-finger) so the translation does not double-apply.
 *
 * Assumption: the referenced element's identity is stable for the
 * component's lifetime. The effect re-runs only on ref-object change,
 * not on `ref.current` mutations — swapping the underlying node after
 * mount would leave the listener bound to the stale element.
 */
export function useWheelToHorizontalScroll(
  ref: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const target = e.target as HTMLElement | null;
      const col = target?.closest<HTMLElement>('[data-col-scroll]');
      if (col) {
        const { scrollTop, scrollHeight, clientHeight } = col;
        const scrollingDown = e.deltaY > 0;
        const canScrollMore = scrollingDown
          ? scrollTop + clientHeight < scrollHeight - 1
          : scrollTop > 0;
        if (canScrollMore) return;
      }

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref]);
}
