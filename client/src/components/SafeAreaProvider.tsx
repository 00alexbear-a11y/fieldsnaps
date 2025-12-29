import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

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

      // Check if SafeArea plugin is available via Capacitor.Plugins
      const plugins = (Capacitor as any).Plugins;
      const SafeAreaPlugin = plugins?.SafeArea;
      
      if (!SafeAreaPlugin) {
        console.log('[SafeArea] Plugin not available in Capacitor.Plugins, using iOS fallback');
        applyInsets(IOS_FALLBACK_INSETS);
        return;
      }

      try {
        console.log('[SafeArea] Plugin found, calling getSafeAreaInsets...');
        const result = await SafeAreaPlugin.getSafeAreaInsets();
        console.log('[SafeArea] Plugin returned:', result);
        
        if (result && result.insets) {
          applyInsets(result.insets);
          
          // Listen for changes
          SafeAreaPlugin.addListener('safeAreaChanged', (data: { insets: SafeAreaInsets }) => {
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
      // Cleanup listeners if plugin is available
      try {
        const plugins = (Capacitor as any).Plugins;
        const SafeAreaPlugin = plugins?.SafeArea;
        if (SafeAreaPlugin?.removeAllListeners) {
          SafeAreaPlugin.removeAllListeners();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, []);

  return <>{children}</>;
}
