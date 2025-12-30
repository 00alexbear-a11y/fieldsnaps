import { Capacitor } from '@capacitor/core';

/**
 * Get the base API URL based on the platform
 * - Web: Uses relative URLs (same server)
 * - Native: Uses production server URL
 * 
 * IMPORTANT: Update PRODUCTION_URL before deploying to production
 */
const PRODUCTION_URL = import.meta.env.VITE_API_URL || 'https://fieldsnaps.replit.app';

export function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_URL;
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
