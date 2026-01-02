import { Capacitor } from '@capacitor/core';

/**
 * API URL utilities for cross-platform support
 * 
 * CRITICAL INSIGHT (Jan 2025 - Updated):
 * On native Capacitor (iOS/Android), the app runs on capacitor://localhost.
 * Relative URLs like /api/auth/user resolve to capacitor://localhost/api/auth/user
 * which serves the bundled index.html (status 200!) - NOT the actual backend.
 * 
 * SOLUTION: 
 * - Native: MUST use absolute URLs (VITE_API_URL) to reach real backend
 *   Since we use Bearer tokens (not cookies), cross-origin is OK
 * - Web: Use relative URLs (same origin, cookies work fine)
 */

/**
 * Get the base API URL.
 * - Native platforms: Returns VITE_API_URL to reach the real backend
 * - Web: Returns empty string (relative URLs work via same origin)
 */
export function getApiBaseUrl(): string {
  // CRITICAL: Native platforms MUST use absolute URLs to reach real backend
  // Relative URLs resolve to capacitor://localhost which serves HTML, not API
  if (Capacitor.isNativePlatform()) {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl) {
      return apiUrl;
    }
    // Fallback - should never happen if env is configured correctly
    console.error('[API] VITE_API_URL not set for native platform!');
    return 'https://fieldsnaps.replit.app';
  }
  
  // Web: relative URLs work fine (same origin)
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
