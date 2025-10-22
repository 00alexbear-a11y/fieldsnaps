/**
 * Native OAuth Helper
 * 
 * Handles OAuth authentication flows for native iOS/Android apps using
 * Capacitor's Browser plugin to open authentication in the system browser
 * (Safari/Chrome) instead of the in-app WebView.
 * 
 * Flow:
 * 1. User clicks "Sign In"
 * 2. App opens Safari with OAuth URL
 * 3. User authenticates in Safari
 * 4. Server redirects to custom URL scheme: com.fieldsnaps.app://callback?code=...
 * 5. iOS/Android opens the app via deep link
 * 6. App listener (in App.tsx) captures the callback and completes login
 */

import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

/**
 * Deep link URL scheme for this app
 * Matches the appUrlScheme in capacitor.config.ts
 */
export const APP_URL_SCHEME = 'com.fieldsnaps.app';

/**
 * OAuth callback path for deep linking
 */
export const OAUTH_CALLBACK_PATH = 'callback';

/**
 * Get the appropriate redirect URI based on platform
 * - Native (iOS/Android): Uses custom URL scheme for deep linking
 * - Web: Uses current origin
 */
export function getOAuthRedirectUri(): string {
  if (Capacitor.isNativePlatform()) {
    return `${APP_URL_SCHEME}://${OAUTH_CALLBACK_PATH}`;
  }
  // Web platform uses the current origin
  return `${window.location.origin}/auth/callback`;
}

/**
 * Open a URL in the system browser (Safari/Chrome) for OAuth authentication.
 * On native platforms, this opens Safari which can later redirect back to the app.
 * On web, this just navigates to the URL normally.
 * 
 * @param url - The full OAuth URL to open
 */
export async function openOAuthInBrowser(url: string): Promise<void> {
  console.log('[Native OAuth] Opening URL in browser:', url);
  
  if (Capacitor.isNativePlatform()) {
    try {
      // Open in system browser (Safari on iOS, Chrome on Android)
      // Use default presentation style for easier dismissal
      await Browser.open({ 
        url,
        windowName: '_self'
      });
      console.log('[Native OAuth] Browser opened successfully');
    } catch (error) {
      console.error('[Native OAuth] Failed to open browser:', error);
      throw error;
    }
  } else {
    // Web platform - just navigate normally
    window.location.href = url;
  }
}

/**
 * Close the system browser (if still open).
 * This is called after handling a deep link callback to ensure
 * the Safari view is dismissed.
 * 
 * Note: This only works reliably on iOS. On Android, the browser
 * may remain open.
 */
export async function closeBrowser(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.close();
      console.log('[Native OAuth] Browser closed');
    } catch (error) {
      // Browser might already be closed, this is fine
      console.log('[Native OAuth] Browser close attempted:', error);
    }
  }
}

/**
 * Build a dev login URL for native platforms.
 * This opens the dev login endpoint in Safari, which then redirects back to the app.
 * 
 * @param serverUrl - The backend server URL (from config or environment)
 * @returns The full dev login URL with redirect parameter
 */
export function buildDevLoginUrl(serverUrl: string): string {
  const redirectUri = getOAuthRedirectUri();
  return `${serverUrl}/api/dev-login?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Build a Replit Auth URL for native platforms.
 * This opens the Replit OAuth flow in Safari, which then redirects back to the app.
 * 
 * @param serverUrl - The backend server URL
 * @returns The full Replit Auth URL with redirect parameter
 */
export function buildReplitAuthUrl(serverUrl: string): string {
  const redirectUri = getOAuthRedirectUri();
  return `${serverUrl}/api/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Parse OAuth callback parameters from a deep link URL
 * Extracts query parameters like code, state, error, etc.
 * 
 * @param url - The deep link URL (e.g., "com.fieldsnaps.app://callback?code=abc123")
 * @returns Object containing parsed parameters
 */
export function parseOAuthCallback(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    console.log('[Native OAuth] Parsed callback params:', params);
    return params;
  } catch (error) {
    console.error('[Native OAuth] Failed to parse callback URL:', url, error);
    return {};
  }
}

/**
 * Check if a URL is an OAuth callback deep link
 * 
 * @param url - The URL to check
 * @returns true if this is an OAuth callback for this app
 */
export function isOAuthCallback(url: string): boolean {
  return url.startsWith(`${APP_URL_SCHEME}://${OAUTH_CALLBACK_PATH}`);
}
