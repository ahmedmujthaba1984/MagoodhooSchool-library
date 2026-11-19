import { useEffect } from 'react';

let activeScrollLockCount = 0;

/**
 * Safely locks document body scrolling while a modal/drawer is open,
 * with reference counting and guaranteed cleanup on unmount.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;

    activeScrollLockCount += 1;
    document.body.style.overflow = 'hidden';

    return () => {
      activeScrollLockCount = Math.max(0, activeScrollLockCount - 1);
      if (activeScrollLockCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [locked]);
}

/**
 * Emergency reset called on route/tab transitions so a closed modal or drawer
 * can never leave the document frozen.
 */
export function resetBodyScrollLock(): void {
  activeScrollLockCount = 0;
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
}
