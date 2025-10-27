/**
 * Native OAuth Helper with PKCE
 * 
 * Handles OAuth authentication flows for native iOS/Android apps using
 * ASWebAuthenticationSession (iOS) for automatic Safari dismissal.
 * 
 * Flow:
 * 1. User clicks "Sign In"
 * 2. App calls /api/native/oauth/start to get authorization URL with PKCE
 * 3. App opens ASWebAuthenticationSession with OAuth URL
 * 4. User authenticates and taps "Allow"
 * 5. Safari AUTOMATICALLY DISMISSES and returns authorization code
 * 6. App exchanges code for JWT tokens via /api/native/oauth/exchange
 * 7. Tokens stored in iOS Keychain, user logged in
 */

import { Capacitor } from '@capacitor/core';
import ASWebAuth from './asWebAuth';

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
 * Get the server URL based on environment
 */
function getServerUrl(): string {
  if (Capacitor.isNativePlatform()) {
    // Production server for native apps
    return 'https://fieldsnaps.replit.app';
  }
  // Web uses current origin
  return window.location.origin;
}

/**
 * Authenticate user using Replit OAuth with PKCE
 * 
 * This function:
 * 1. Calls backend to initiate PKCE flow
 * 2. Opens ASWebAuthenticationSession
 * 3. Exchanges authorization code for tokens
 * 
 * @returns User data and JWT tokens
 */
export async function authenticateWithReplit(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    displayName?: string;
    profilePicture?: string;
    companyId?: string;
    needsCompanySetup: boolean;
  };
}> {
  const serverUrl = getServerUrl();
  
  console.log('[Native OAuth] 🚀 Starting PKCE OAuth flow');
  
  // Step 1: Call backend to get authorization URL with PKCE
  console.log('[Native OAuth] 📞 Calling /api/native/oauth/start');
  
  const startResponse = await fetch(`${serverUrl}/api/native/oauth/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      redirect_uri: `${APP_URL_SCHEME}://${OAUTH_CALLBACK_PATH}`,
    }),
  });
  
  if (!startResponse.ok) {
    throw new Error('Failed to start OAuth flow');
  }
  
  const { authorization_url, state } = await startResponse.json();
  
  console.log('[Native OAuth] ✅ Got authorization URL');
  console.log('[Native OAuth] 📦 State:', state);
  
  // Step 2: Open ASWebAuthenticationSession
  console.log('[Native OAuth] 🌐 Opening ASWebAuthenticationSession');
  
  const authResult = await ASWebAuth.authenticate({
    url: authorization_url,
    callbackScheme: APP_URL_SCHEME,
  });
  
  console.log('[Native OAuth] ✅ Authentication completed, Safari dismissed automatically');
  console.log('[Native OAuth] 📦 Callback URL:', authResult.url);
  
  // Step 3: Parse callback parameters
  const params = authResult.params || {};
  const code = params.code;
  const returnedState = params.state;
  
  if (!code || !returnedState) {
    throw new Error('No authorization code received');
  }
  
  console.log('[Native OAuth] 🔑 Received authorization code');
  console.log('[Native OAuth] 📦 State matches:', returnedState === state);
  
  // Step 4: Exchange authorization code for JWT tokens
  console.log('[Native OAuth] 🔄 Exchanging code for tokens');
  
  const exchangeResponse = await fetch(`${serverUrl}/api/native/oauth/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      state: returnedState,
    }),
  });
  
  if (!exchangeResponse.ok) {
    throw new Error('Failed to exchange authorization code');
  }
  
  const tokens = await exchangeResponse.json();
  
  console.log('[Native OAuth] ✅ Tokens received successfully');
  console.log('[Native OAuth] 👤 User ID:', tokens.user.id);
  console.log('[Native OAuth] 🎫 Access token expires in:', tokens.expires_in, 'seconds');
  
  return tokens;
}

/**
 * Dev login for testing (bypasses OAuth)
 */
export async function devLogin(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: any;
}> {
  const serverUrl = getServerUrl();
  
  console.log('[Dev Login] 🔧 Using dev login endpoint');
  
  const response = await fetch(`${serverUrl}/api/dev-login?redirect_uri=${APP_URL_SCHEME}://${OAUTH_CALLBACK_PATH}`);
  
  if (!response.ok) {
    throw new Error('Dev login failed');
  }
  
  // Dev login redirects, so we need to handle it differently
  // For now, just return mock tokens
  return {
    access_token: 'dev-token',
    refresh_token: 'dev-refresh-token',
    expires_in: 3600,
    user: {
      id: 'dev-user-local',
      email: 'dev@fieldsnaps.local',
      displayName: 'Dev User',
      needsCompanySetup: false,
    },
  };
}
