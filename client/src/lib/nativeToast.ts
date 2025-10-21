import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';

export type ToastPosition = 'top' | 'center' | 'bottom';
export type ToastDuration = 'short' | 'long';

export interface ToastOptions {
  text: string;
  duration?: ToastDuration;
  position?: ToastPosition;
}

export const nativeToast = {
  async show(options: ToastOptions): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Toast (web fallback):', options.text);
      return;
    }

    try {
      await Toast.show({
        text: options.text,
        duration: options.duration || 'short',
        position: options.position || 'bottom',
      });
    } catch (error) {
      console.warn('Native toast failed:', error);
    }
  },

  async success(text: string): Promise<void> {
    await this.show({ text, duration: 'short', position: 'bottom' });
  },

  async error(text: string): Promise<void> {
    await this.show({ text, duration: 'long', position: 'bottom' });
  },

  async info(text: string): Promise<void> {
    await this.show({ text, duration: 'short', position: 'bottom' });
  },
};
