import { Capacitor } from '@capacitor/core';

/**
 * Native Navigation Helper
 * 
 * In Capacitor apps, relative URLs don't work for backend auth endpoints.
 * This helper constructs full server URLs when running in native mode.
 */

/**
 * Server URL for native builds
 * 
 * IMPORTANT: Update this before building for production!
 * - Development: Your Replit dev server URL
 * - Production: Your production server URL (e.g., https://fieldsnaps.com)
 * 
 * This MUST match the server.url in your capacitor.config files.
 */
const SERVER_URL = 'https://b031dd5d-5c92-4902-b04b-e2a8255614a2-00-1nc5d7i5pn8nb.picard.replit.dev';

/**
 * Get the base server URL
 * - In native (Capacitor), returns the configured server URL
 * - In web, returns empty string (uses relative URLs)
 */
function getServerUrl(): string {
  if (!Capacitor.isNativePlatform()) {
    return '';
  }
  
  // In native mode, use the configured server URL
  // window.location.origin returns "capacitor://localhost" which is wrong!
  return SERVER_URL;
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
