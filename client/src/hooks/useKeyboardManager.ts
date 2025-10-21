import { useEffect, useRef } from 'react';
import { nativeKeyboard } from '@/lib/nativeKeyboard';

interface UseKeyboardManagerOptions {
  enabled?: boolean;
  scrollOffset?: number;
}

export function useKeyboardManager(options: UseKeyboardManagerOptions = {}) {
  const { enabled = true, scrollOffset = 20 } = options;
  const originalScrollY = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const removeDidShowListener = nativeKeyboard.addDidShowListener((info) => {
      const focusedElement = document.activeElement as HTMLElement;
      if (!focusedElement) return;

      originalScrollY.current = window.scrollY;

      const elementRect = focusedElement.getBoundingClientRect();
      const keyboardHeight = info.keyboardHeight;
      const viewportHeight = window.innerHeight;
      
      const elementBottom = elementRect.bottom;
      const visibleHeight = viewportHeight - keyboardHeight;

      if (elementBottom > visibleHeight - scrollOffset) {
        const scrollAmount = elementBottom - visibleHeight + scrollOffset;
        window.scrollBy({
          top: scrollAmount,
          behavior: 'smooth',
        });
      }
    });

    const removeDidHideListener = nativeKeyboard.addDidHideListener(() => {
      if (originalScrollY.current !== window.scrollY) {
        window.scrollTo({
          top: originalScrollY.current,
          behavior: 'smooth',
        });
      }
    });

    return () => {
      removeDidShowListener();
      removeDidHideListener();
    };
  }, [enabled, scrollOffset]);
}
