/**
 * Development Mode Configuration
 * 
 * Controls whether dev login button appears in production builds.
 * Useful for testing iOS/Android builds locally before production deployment.
 * 
 * IMPORTANT: Set ENABLE_DEV_LOGIN_IN_NATIVE to false before deploying to production!
 */

import { Capacitor } from '@capacitor/core';

// Enable dev login in native builds (iOS/Android) for local testing
// Set to false before production deployment
const ENABLE_DEV_LOGIN_IN_NATIVE = true;

// Check if we're in development mode OR in a native app with dev login enabled
export const isDevModeEnabled = (): boolean => {
  const isWebDev = import.meta.env.DEV;
  const isNativeApp = Capacitor.isNativePlatform();
  const nativeDevEnabled = isNativeApp && ENABLE_DEV_LOGIN_IN_NATIVE;
  
  return isWebDev || nativeDevEnabled;
};

// Log current mode (helpful for debugging)
if (Capacitor.isNativePlatform()) {
  console.log('[DevMode] Native platform detected:', Capacitor.getPlatform());
  console.log('[DevMode] Dev login enabled:', isDevModeEnabled());
}
