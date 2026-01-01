/**
 * API URL utilities for cross-platform support
 * 
 * CRITICAL INSIGHT (Jan 2025):
 * On native Capacitor (iOS/Android), the app runs on capacitor://localhost.
 * The Capacitor HTTP plugin automatically resolves relative URLs against 
 * the configured server. If we prefix with https://fieldsnaps.replit.app,
 * it becomes a cross-origin request WITHOUT session cookies, causing 401/404.
 * 
 * SOLUTION: Always use relative URLs. Both web and native resolve them correctly.
 * - Web: relative to current origin
 * - Native: Capacitor HTTP plugin handles the resolution
 */

/**
 * Get the base API URL.
 * Returns empty string to use relative URLs (works on both web and native).
 * Only returns absolute URL if VITE_API_URL is explicitly set for special cases.
 */
export function getApiBaseUrl(): string {
  // Only use absolute URL if explicitly configured (e.g., for testing against different server)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Default: use relative URLs (works correctly on both web and native Capacitor)
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
