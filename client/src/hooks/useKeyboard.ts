import { useState, useEffect, useCallback } from 'react';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

interface UseKeyboardResult {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
  hideKeyboard: () => Promise<void>;
}

export function useKeyboard(): UseKeyboardResult {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const platform = Capacitor.getPlatform();
    
    const setupListeners = async () => {
      try {
        if (platform === 'ios') {
          const showListener = await Keyboard.addListener('keyboardWillShow', (info: KeyboardInfo) => {
            setKeyboardHeight(info.keyboardHeight);
            setIsKeyboardVisible(true);
          });
          
          const hideListener = await Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardHeight(0);
            setIsKeyboardVisible(false);
          });
          
          return () => {
            showListener.remove();
            hideListener.remove();
          };
        } else {
          const showListener = await Keyboard.addListener('keyboardDidShow', (info: KeyboardInfo) => {
            setKeyboardHeight(info.keyboardHeight);
            setIsKeyboardVisible(true);
          });
          
          const hideListener = await Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardHeight(0);
            setIsKeyboardVisible(false);
          });
          
          return () => {
            showListener.remove();
            hideListener.remove();
          };
        }
      } catch (error) {
        console.warn('[useKeyboard] Failed to setup keyboard listeners:', error);
        return () => {};
      }
    };
    
    let cleanup: (() => void) | undefined;
    
    setupListeners().then(cleanupFn => {
      cleanup = cleanupFn;
    });
    
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const hideKeyboard = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Keyboard.hide();
      } catch (error) {
        console.warn('[useKeyboard] Failed to hide keyboard:', error);
      }
    }
  }, []);

  return {
    keyboardHeight,
    isKeyboardVisible,
    hideKeyboard,
  };
}
