import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export const nativeStatusBar = {
  async hide(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await StatusBar.hide();
    } catch (error) {
      console.warn('Status bar hide failed:', error);
    }
  },

  async show(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await StatusBar.show();
    } catch (error) {
      console.warn('Status bar show failed:', error);
    }
  },

  async setLight(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await StatusBar.setStyle({ style: Style.Light });
    } catch (error) {
      console.warn('Status bar style change failed:', error);
    }
  },

  async setDark(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (error) {
      console.warn('Status bar style change failed:', error);
    }
  },

  async setOverlay(isOverlay: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await StatusBar.setOverlaysWebView({ overlay: isOverlay });
    } catch (error) {
      console.warn('Status bar overlay failed:', error);
    }
  },
};
