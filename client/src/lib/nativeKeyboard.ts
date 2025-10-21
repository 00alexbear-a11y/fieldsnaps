import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';

export const nativeKeyboard = {
  async show(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await Keyboard.show();
    } catch (error) {
      console.warn('Keyboard show failed:', error);
    }
  },

  async hide(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await Keyboard.hide();
    } catch (error) {
      console.warn('Keyboard hide failed:', error);
    }
  },

  addWillShowListener(callback: (info: KeyboardInfo) => void): () => void {
    if (!Capacitor.isNativePlatform()) {
      return () => {};
    }

    const listener = Keyboard.addListener('keyboardWillShow', callback);
    return () => {
      listener.then(handle => handle.remove());
    };
  },

  addDidShowListener(callback: (info: KeyboardInfo) => void): () => void {
    if (!Capacitor.isNativePlatform()) {
      return () => {};
    }

    const listener = Keyboard.addListener('keyboardDidShow', callback);
    return () => {
      listener.then(handle => handle.remove());
    };
  },

  addWillHideListener(callback: () => void): () => void {
    if (!Capacitor.isNativePlatform()) {
      return () => {};
    }

    const listener = Keyboard.addListener('keyboardWillHide', callback);
    return () => {
      listener.then(handle => handle.remove());
    };
  },

  addDidHideListener(callback: () => void): () => void {
    if (!Capacitor.isNativePlatform()) {
      return () => {};
    }

    const listener = Keyboard.addListener('keyboardDidHide', callback);
    return () => {
      listener.then(handle => handle.remove());
    };
  },

  async setAccessoryBarVisible(visible: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await Keyboard.setAccessoryBarVisible({ isVisible: visible });
    } catch (error) {
      console.warn('Keyboard accessory bar visibility failed:', error);
    }
  },
};
