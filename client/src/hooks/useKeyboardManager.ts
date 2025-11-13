import { useState, useEffect } from 'react';
import { nativeKeyboard } from '@/lib/nativeKeyboard';

interface KeyboardState {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  visualViewportHeight: number;
}

/**
 * Hook to manage iOS keyboard interactions and viewport changes
 * Uses visualViewport API for accurate keyboard detection on iOS Safari
 * Works on both web and native platforms
 * 
 * @param isActive - Only track keyboard when true (prevents multiple listeners)
 */
export function useKeyboardManager(isActive: boolean = true) {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    keyboardHeight: 0,
    isKeyboardOpen: false,
    visualViewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') {
      return;
    }

    // Try visualViewport API first (works on modern iOS Safari and most mobile browsers)
    if (window.visualViewport) {
      const updateKeyboardState = () => {
        const visualViewport = window.visualViewport!;
        const windowHeight = window.innerHeight;
        const visualHeight = visualViewport.height;
        
        // Calculate keyboard height (difference between window and visual viewport)
        const keyboardHeight = Math.max(0, windowHeight - visualHeight);
        
        // Consider keyboard "open" if it takes up more than 150px
        const isKeyboardOpen = keyboardHeight > 150;

        setKeyboardState({
          keyboardHeight,
          isKeyboardOpen,
          visualViewportHeight: visualHeight,
        });

        // Update CSS custom properties for use in components
        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${keyboardHeight}px`
        );
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${visualHeight}px`
        );
      };

      // Initial update
      updateKeyboardState();

      // Listen to viewport changes (keyboard open/close, device rotation)
      window.visualViewport.addEventListener('resize', updateKeyboardState);
      window.visualViewport.addEventListener('scroll', updateKeyboardState);

      return () => {
        window.visualViewport?.removeEventListener('resize', updateKeyboardState);
        window.visualViewport?.removeEventListener('scroll', updateKeyboardState);
        
        // Clean up CSS properties
        if (isActive) {
          document.documentElement.style.removeProperty('--keyboard-height');
          document.documentElement.style.removeProperty('--visual-viewport-height');
        }
      };
    } else {
      // Fallback to Capacitor keyboard events for native platforms without visualViewport
      const removeDidShowListener = nativeKeyboard.addDidShowListener((info) => {
        const keyboardHeight = info.keyboardHeight;
        const visualViewportHeight = window.innerHeight - keyboardHeight;
        
        setKeyboardState({
          keyboardHeight,
          isKeyboardOpen: keyboardHeight > 150,
          visualViewportHeight,
        });

        // Update CSS custom properties
        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${keyboardHeight}px`
        );
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${visualViewportHeight}px`
        );
      });

      const removeDidHideListener = nativeKeyboard.addDidHideListener(() => {
        setKeyboardState({
          keyboardHeight: 0,
          isKeyboardOpen: false,
          visualViewportHeight: window.innerHeight,
        });

        // Reset CSS custom properties
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${window.innerHeight}px`
        );
      });

      return () => {
        removeDidShowListener();
        removeDidHideListener();
        
        // Clean up CSS properties
        if (isActive) {
          document.documentElement.style.removeProperty('--keyboard-height');
          document.documentElement.style.removeProperty('--visual-viewport-height');
        }
      };
    }
  }, [isActive]);

  return keyboardState;
}

/**
 * Hook to auto-scroll input into view when focused
 * Only active when dialog is open to avoid global side effects
 */
export function useAutoScrollInput(isActive: boolean = true) {
  useEffect(() => {
    if (!isActive) return;

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      
      // Only scroll for input elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true'
      ) {
        // Delay to allow keyboard animation to complete
        setTimeout(() => {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }, 300);
      }
    };

    // Use capture phase to catch focus on all elements
    document.addEventListener('focus', handleFocus, true);

    return () => {
      document.removeEventListener('focus', handleFocus, true);
    };
  }, [isActive]);
}
