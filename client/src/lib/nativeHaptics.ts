import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const haptics = {
  async light() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  async medium() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  async heavy() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  async success() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  async warning() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  async error() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  async selectionChanged() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.selectionStart();
      setTimeout(async () => {
        await Haptics.selectionEnd();
      }, 50);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },
};
