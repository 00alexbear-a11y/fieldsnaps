import { Capacitor } from '@capacitor/core';

/**
 * API URL utilities for cross-platform support
 * 
 * CRITICAL INSIGHT (Jan 2025):
 * On native Capacitor (iOS/Android), the app runs on capacitor://localhost.
 * Absolute URLs like https://fieldsnaps.replit.app cause cross-origin requests
 * WITHOUT session cookies, resulting in 401/404 errors and HTML redirects.
 * 
 * SOLUTION: 
 * - Native: ALWAYS use relative URLs (Capacitor resolves against configured server)
 * - Web: Can use VITE_API_URL if set, otherwise relative URLs work fine
 */

/**
 * Get the base API URL.
 * - Native platforms: ALWAYS returns empty string (relative URLs required)
 * - Web: Returns VITE_API_URL if set, otherwise empty string
 */
export function getApiBaseUrl(): string {
  // CRITICAL: Native platforms MUST use relative URLs to avoid cross-origin issues
  // Even if VITE_API_URL is set, ignore it on native!
  if (Capacitor.isNativePlatform()) {
    return '';
  }
  
  // Web: Can use absolute URL if explicitly configured
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Default: relative URLs work on web too
  return '';
}

/**
 * Convert a relative API path to a full URL if needed.
 * Leaves already-absolute URLs unchanged (blob:, https://, http://, capacitor://, data:, file://).
 * This is critical for native apps where camera/IndexedDB return absolute blob: or file: URLs.
 */
export function getApiUrl(path: string): string {
  // Early return for empty/null paths
  if (!path) {
    return path;
  }
  
  // Early return for already-absolute URLs (blob:, https:, http:, capacitor:, data:, file:)
  if (path.startsWith('blob:') || 
      path.startsWith('data:') || 
      path.startsWith('http://') || 
      path.startsWith('https://') ||
      path.startsWith('capacitor://') ||
      path.startsWith('file://')) {
    return path;
  }
  
  const baseUrl = getApiBaseUrl();
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}
