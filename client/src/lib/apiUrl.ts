import { Capacitor } from '@capacitor/core';

/**
 * Get the base API URL based on the platform
 * - Web: Uses relative URLs (same server)
 * - Native: Uses production server URL
 */
export function getApiBaseUrl(): string {
  // Check if running in native app
  if (Capacitor.isNativePlatform()) {
    // Use production server for native apps
    return 'https://fieldsnaps.replit.app';
  }
  
  // Web uses relative URLs (same server)
  return '';
}

/**
 * Convert a relative API path to an absolute URL if needed
 */
export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}
