import { Capacitor } from '@capacitor/core';

/**
 * Native Navigation Helper
 * 
 * In Capacitor apps, relative URLs don't work for backend auth endpoints.
 * This helper constructs full server URLs when running in native mode.
 */

/**
 * Get the base server URL
 * - In native (Capacitor), returns the server URL from config
 * - In web, returns empty string (uses relative URLs)
 */
function getServerUrl(): string {
  if (!Capacitor.isNativePlatform()) {
    return '';
  }
  
  // In native mode, we need the full server URL
  // This is set in capacitor.config.dev.ts during development
  // In production builds, this would be the production server URL
  return window.location.origin;
}

/**
 * Navigate to an auth endpoint
 * Constructs the correct URL for native vs web platforms
 * 
 * @param path - The API path (e.g., '/api/login', '/api/dev-login')
 */
export function navigateToAuthEndpoint(path: string): void {
  const serverUrl = getServerUrl();
  const fullUrl = `${serverUrl}${path}`;
  
  console.log('[Native Navigation]', {
    isNative: Capacitor.isNativePlatform(),
    path,
    serverUrl,
    fullUrl,
  });
  
  window.location.href = fullUrl;
}

/**
 * Check if running in native platform
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
