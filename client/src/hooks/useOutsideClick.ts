import { RefObject, useEffect } from 'react';

export function useOutsideClick(ref: RefObject<HTMLElement | null>, onOutsideClick: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutsideClick();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutsideClick, active]);
}
