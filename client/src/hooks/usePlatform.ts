import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  return isNative;
}

export function getPlatform() {
  return Capacitor.getPlatform();
}
