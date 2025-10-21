import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

export const nativeSplashScreen = {
  async show(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await SplashScreen.show({
        showDuration: 2000,
        autoHide: false,
      });
    } catch (error) {
      console.warn('Splash screen show failed:', error);
    }
  },

  async hide(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await SplashScreen.hide();
    } catch (error) {
      console.warn('Splash screen hide failed:', error);
    }
  },
};
