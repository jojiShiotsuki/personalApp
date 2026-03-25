import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly reveals streamed text character-by-character instead of in chunks.
 * Takes the raw streamed content and returns a progressively revealed version.
 */
export function useTypewriter(sourceText: string, charsPerFrame = 3): string {
  const [displayText, setDisplayText] = useState('');
  const rafRef = useRef<number>(0);
  const indexRef = useRef(0);

  useEffect(() => {
    // If source is empty, reset
    if (!sourceText) {
      setDisplayText('');
      indexRef.current = 0;
      return;
    }

    // If source grew, animate the new chars
    const animate = () => {
      if (indexRef.current < sourceText.length) {
        const nextIndex = Math.min(indexRef.current + charsPerFrame, sourceText.length);
        indexRef.current = nextIndex;
        setDisplayText(sourceText.slice(0, nextIndex));
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sourceText, charsPerFrame]);

  // When source text is finalized (streaming done), show everything immediately
  return displayText || sourceText;
}
