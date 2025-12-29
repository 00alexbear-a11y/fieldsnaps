import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SafeArea } from 'capacitor-plugin-safe-area';

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const IOS_FALLBACK_INSETS: SafeAreaInsets = {
  top: 59,
  right: 0,
  bottom: 34,
  left: 0,
};

export function SafeAreaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function initSafeArea() {
      console.log('[SafeArea] Initializing, isNative:', Capacitor.isNativePlatform());
      
      if (Capacitor.isNativePlatform()) {
        try {
          console.log('[SafeArea] Calling getSafeAreaInsets...');
          const result = await SafeArea.getSafeAreaInsets();
          console.log('[SafeArea] Plugin returned:', result);
          
          if (result && result.insets) {
            applyInsets(result.insets);
            console.log('[SafeArea] Insets applied from plugin:', result.insets);
          } else {
            console.warn('[SafeArea] No insets in result, using iOS fallback');
            applyInsets(IOS_FALLBACK_INSETS);
          }
          
          SafeArea.addListener('safeAreaChanged', (data: { insets: SafeAreaInsets }) => {
            console.log('[SafeArea] Safe area changed:', data.insets);
            applyInsets(data.insets);
          });
        } catch (error) {
          console.error('[SafeArea] Plugin failed:', error);
          console.log('[SafeArea] Using iOS fallback insets');
          applyInsets(IOS_FALLBACK_INSETS);
        }
      } else {
        console.log('[SafeArea] Web platform, using zero insets');
        applyInsets({ top: 0, right: 0, bottom: 0, left: 0 });
      }
    }

    function applyInsets(insets: SafeAreaInsets) {
      const root = document.documentElement;
      root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
      root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
      root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
      root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
      console.log('[SafeArea] CSS variables set:', {
        top: `${insets.top}px`,
        bottom: `${insets.bottom}px`,
      });
    }

    initSafeArea();

    return () => {
      if (Capacitor.isNativePlatform()) {
        SafeArea.removeAllListeners().catch(() => {});
      }
    };
  }, []);

  return <>{children}</>;
}
