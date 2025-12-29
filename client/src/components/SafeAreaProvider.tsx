import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function SafeAreaProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function initSafeArea() {
      if (Capacitor.isNativePlatform()) {
        try {
          const { SafeArea } = await import('capacitor-plugin-safe-area');
          
          const { insets } = await SafeArea.getSafeAreaInsets();
          applyInsets(insets);
          
          await SafeArea.addListener('safeAreaChanged', (data: { insets: SafeAreaInsets }) => {
            applyInsets(data.insets);
          });
          
          console.log('[SafeArea] Insets applied:', insets);
        } catch (error) {
          console.error('[SafeArea] Failed to get safe area insets:', error);
          applyFallbackInsets();
        }
      } else {
        applyFallbackInsets();
      }
      setReady(true);
    }

    function applyInsets(insets: SafeAreaInsets) {
      const root = document.documentElement;
      root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
      root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
      root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
      root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
    }

    function applyFallbackInsets() {
      const root = document.documentElement;
      const computedTop = getComputedStyle(root).getPropertyValue('padding-top');
      
      if (!computedTop || computedTop === '0px') {
        root.style.setProperty('--safe-area-inset-top', '0px');
        root.style.setProperty('--safe-area-inset-right', '0px');
        root.style.setProperty('--safe-area-inset-bottom', '0px');
        root.style.setProperty('--safe-area-inset-left', '0px');
      }
    }

    initSafeArea();

    return () => {
      if (Capacitor.isNativePlatform()) {
        import('capacitor-plugin-safe-area').then(({ SafeArea }) => {
          SafeArea.removeAllListeners();
        }).catch(() => {});
      }
    };
  }, []);

  return <>{children}</>;
}
