import { useEffect } from 'react';

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrlKey?: boolean; metaKey?: boolean } = {}
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { ctrlKey = false, metaKey = false } = options;

      // Only trigger if key matches and we're not in an input/textarea
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
                     target.tagName === 'TEXTAREA' ||
                     target.isContentEditable;

      if (
        event.key.toLowerCase() === key.toLowerCase() &&
        (event.ctrlKey || event.metaKey) === (ctrlKey || metaKey) &&
        !isInput
      ) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}
