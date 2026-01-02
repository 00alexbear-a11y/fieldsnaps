import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SafeArea, type SafeAreaInsets as PluginSafeAreaInsets } from 'capacitor-plugin-safe-area';

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

function applyInsets(insets: SafeAreaInsets) {
  const root = document.documentElement;
  // Set both naming conventions for compatibility
  // --safe-area-* is used by sidebar.tsx and other components
  // --safe-area-inset-* matches native CSS env() naming
  root.style.setProperty('--safe-area-top', `${insets.top}px`);
  root.style.setProperty('--safe-area-bottom', `${insets.bottom}px`);
  root.style.setProperty('--safe-area-left', `${insets.left}px`);
  root.style.setProperty('--safe-area-right', `${insets.right}px`);
  root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
  root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
  root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
  root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
  console.log('[SafeArea] CSS variables set:', {
    top: `${insets.top}px`,
    bottom: `${insets.bottom}px`,
  });
}

export function SafeAreaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function initSafeArea() {
      console.log('[SafeArea] Initializing, platform:', Capacitor.getPlatform(), 'isNative:', Capacitor.isNativePlatform());
      
      if (!Capacitor.isNativePlatform()) {
        console.log('[SafeArea] Web platform - using zero insets');
        applyInsets({ top: 0, right: 0, bottom: 0, left: 0 });
        return;
      }

      try {
        console.log('[SafeArea] Calling plugin getSafeAreaInsets...');
        const result: PluginSafeAreaInsets = await SafeArea.getSafeAreaInsets();
        console.log('[SafeArea] Plugin returned:', result);
        
        if (result && result.insets) {
          applyInsets(result.insets);
          
          SafeArea.addListener('safeAreaChanged', (data: PluginSafeAreaInsets) => {
            console.log('[SafeArea] Safe area changed:', data.insets);
            applyInsets(data.insets);
          });
        } else {
          console.warn('[SafeArea] No insets in result, using iOS fallback');
          applyInsets(IOS_FALLBACK_INSETS);
        }
      } catch (error) {
        console.error('[SafeArea] Plugin call failed:', error);
        console.log('[SafeArea] Using iOS fallback insets');
        applyInsets(IOS_FALLBACK_INSETS);
      }
    }

    initSafeArea();

    return () => {
      try {
        if (Capacitor.isNativePlatform()) {
          SafeArea.removeAllListeners();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, []);

  return <>{children}</>;
}
