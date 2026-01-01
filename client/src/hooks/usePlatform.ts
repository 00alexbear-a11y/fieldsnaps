import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useIsNativeApp(): boolean {
  // PERFORMANCE FIX: Capacitor.isNativePlatform() is reliable and returns immediately
  // No polling needed - it was causing 100x console.log calls that blocked iOS WKWebView
  const [isNative] = useState(() => {
    const initialIsNative = Capacitor.isNativePlatform();
    // Only log once on initial detection (not in a loop)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Platform] isNative:', initialIsNative, 'platform:', Capacitor.getPlatform());
    }
    return initialIsNative;
  });

  return isNative;
}

export function getPlatform() {
  return Capacitor.getPlatform();
}
