import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState(() => {
    // Use isNativePlatform() which is more reliable than getPlatform()
    // This method is what main.tsx uses and should work immediately
    const initialIsNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    console.log('[Platform Detection - Initial] isNativePlatform():', initialIsNative, 'getPlatform():', platform);
    return initialIsNative;
  });

  useEffect(() => {
    let pollCount = 0;
    const maxPolls = 100; // Poll for up to 10 seconds (100 * 100ms) to handle slow cold launches
    let intervalId: NodeJS.Timeout | null = null;
    
    const checkPlatform = () => {
      pollCount++;
      const detectedIsNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      
      console.log(`[Platform Detection - Poll ${pollCount}] isNativePlatform():`, detectedIsNative, 'getPlatform():', platform);
      
      // If we detected native platform or reached max polls, stop polling
      if (detectedIsNative || pollCount >= maxPolls) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        
        if (detectedIsNative && !isNative) {
          console.log('[Platform Detection] ✅ Native platform detected! Switching to native UI');
          setIsNative(true);
        } else if (pollCount >= maxPolls && !detectedIsNative) {
          console.log('[Platform Detection] ⏱️ Polling timeout (10s) - staying on web UI');
        }
      }
    };

    // Check immediately after mount
    checkPlatform();
    
    // If not native yet, keep polling every 100ms for up to 10 seconds
    if (!isNative) {
      intervalId = setInterval(checkPlatform, 100);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // Only run once on mount

  return isNative;
}

export function getPlatform() {
  return Capacitor.getPlatform();
}
