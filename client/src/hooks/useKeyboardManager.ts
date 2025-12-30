import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { nativeKeyboard } from '@/lib/nativeKeyboard';

interface KeyboardState {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  visualViewportHeight: number;
}

/**
 * Hook to manage iOS keyboard interactions and viewport changes
 * Uses Capacitor Keyboard plugin on iOS native (visualViewport doesn't work in WKWebView)
 * Falls back to visualViewport API on web
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

    const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

    // On iOS native, ALWAYS use Capacitor keyboard events
    // visualViewport events don't fire correctly in WKWebView when body isn't scroll container
    if (isNativeIOS) {
      console.log('[KeyboardManager] Using Capacitor keyboard events for iOS native');
      
      const removeWillShowListener = nativeKeyboard.addWillShowListener((info) => {
        const keyboardHeight = info.keyboardHeight;
        const visualViewportHeight = window.innerHeight - keyboardHeight;
        
        console.log('[KeyboardManager] Keyboard will show:', keyboardHeight);
        
        setKeyboardState({
          keyboardHeight,
          isKeyboardOpen: true,
          visualViewportHeight,
        });

        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${keyboardHeight}px`
        );
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${visualViewportHeight}px`
        );
        document.documentElement.classList.add('keyboard-open');
      });

      const removeWillHideListener = nativeKeyboard.addWillHideListener(() => {
        console.log('[KeyboardManager] Keyboard will hide');
        
        setKeyboardState({
          keyboardHeight: 0,
          isKeyboardOpen: false,
          visualViewportHeight: window.innerHeight,
        });

        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${window.innerHeight}px`
        );
        document.documentElement.classList.remove('keyboard-open');
      });

      return () => {
        removeWillShowListener();
        removeWillHideListener();
        
        if (isActive) {
          document.documentElement.style.removeProperty('--keyboard-height');
          document.documentElement.style.removeProperty('--visual-viewport-height');
          document.documentElement.classList.remove('keyboard-open');
        }
      };
    }

    // For web and Android, use visualViewport API if available
    if (window.visualViewport) {
      const updateKeyboardState = () => {
        const visualViewport = window.visualViewport!;
        const windowHeight = window.innerHeight;
        const visualHeight = visualViewport.height;
        
        const keyboardHeight = Math.max(0, windowHeight - visualHeight);
        const isKeyboardOpen = keyboardHeight > 150;

        setKeyboardState({
          keyboardHeight,
          isKeyboardOpen,
          visualViewportHeight: visualHeight,
        });

        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${keyboardHeight}px`
        );
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${visualHeight}px`
        );
        
        if (isKeyboardOpen) {
          document.documentElement.classList.add('keyboard-open');
        } else {
          document.documentElement.classList.remove('keyboard-open');
        }
      };

      updateKeyboardState();

      window.visualViewport.addEventListener('resize', updateKeyboardState);
      window.visualViewport.addEventListener('scroll', updateKeyboardState);

      return () => {
        window.visualViewport?.removeEventListener('resize', updateKeyboardState);
        window.visualViewport?.removeEventListener('scroll', updateKeyboardState);
        
        if (isActive) {
          document.documentElement.style.removeProperty('--keyboard-height');
          document.documentElement.style.removeProperty('--visual-viewport-height');
          document.documentElement.classList.remove('keyboard-open');
        }
      };
    } else {
      // Fallback for older browsers without visualViewport
      const removeDidShowListener = nativeKeyboard.addDidShowListener((info) => {
        const keyboardHeight = info.keyboardHeight;
        const visualViewportHeight = window.innerHeight - keyboardHeight;
        
        setKeyboardState({
          keyboardHeight,
          isKeyboardOpen: keyboardHeight > 150,
          visualViewportHeight,
        });

        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${keyboardHeight}px`
        );
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${visualViewportHeight}px`
        );
        document.documentElement.classList.add('keyboard-open');
      });

      const removeDidHideListener = nativeKeyboard.addDidHideListener(() => {
        setKeyboardState({
          keyboardHeight: 0,
          isKeyboardOpen: false,
          visualViewportHeight: window.innerHeight,
        });

        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${window.innerHeight}px`
        );
        document.documentElement.classList.remove('keyboard-open');
      });

      return () => {
        removeDidShowListener();
        removeDidHideListener();
        
        if (isActive) {
          document.documentElement.style.removeProperty('--keyboard-height');
          document.documentElement.style.removeProperty('--visual-viewport-height');
          document.documentElement.classList.remove('keyboard-open');
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
      
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true'
      ) {
        setTimeout(() => {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }, 300);
      }
    };

    document.addEventListener('focus', handleFocus, true);

    return () => {
      document.removeEventListener('focus', handleFocus, true);
    };
  }, [isActive]);
}
