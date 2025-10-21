import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';

export type ToastPosition = 'top' | 'center' | 'bottom';
export type ToastDuration = 'short' | 'long';

export interface ToastOptions {
  text: string;
  duration?: ToastDuration;
  position?: ToastPosition;
}

export interface ShadcnToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

type ShadcnToastFunction = (options: ShadcnToastOptions) => void;

class NativeToast {
  private webToastFn: ShadcnToastFunction | null = null;

  /**
   * Register shadcn toast function for web fallback
   * Should be called once at app initialization or in components
   */
  setWebToast(toastFn: ShadcnToastFunction) {
    this.webToastFn = toastFn;
  }

  /**
   * Show toast notification
   * On iOS: Shows native toast
   * On web: Uses shadcn toast (if registered)
   */
  async show(options: ToastOptions | ShadcnToastOptions): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // Web: use shadcn toast if registered
      if (this.webToastFn && 'title' in options) {
        this.webToastFn(options as ShadcnToastOptions);
      } else if ('text' in options) {
        console.log('Toast (web fallback):', options.text);
      }
      return;
    }

    try {
      // iOS: show native toast
      const text = 'text' in options 
        ? options.text 
        : (options as ShadcnToastOptions).description 
          ? `${(options as ShadcnToastOptions).title}\n${(options as ShadcnToastOptions).description}`
          : (options as ShadcnToastOptions).title;

      const duration = 'duration' in options ? options.duration || 'short' : 'short';
      const position = 'position' in options ? options.position || 'bottom' : 'bottom';

      await Toast.show({ text, duration, position });
    } catch (error) {
      console.warn('Native toast failed:', error);
      // Fallback to web toast if available
      if (this.webToastFn && 'title' in options) {
        this.webToastFn(options as ShadcnToastOptions);
      }
    }
  }

  async success(text: string): Promise<void> {
    await this.show({ text, duration: 'short', position: 'bottom' });
  }

  async error(text: string): Promise<void> {
    await this.show({ text, duration: 'long', position: 'bottom' });
  }

  async info(text: string): Promise<void> {
    await this.show({ text, duration: 'short', position: 'bottom' });
  }

  isSupported(): boolean {
    return Capacitor.isNativePlatform();
  }
}

export const nativeToast = new NativeToast();
