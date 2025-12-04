import { supabase, getRedirectUrl, isNativePlatform } from './supabase';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { GenericOAuth2 } from '@capacitor-community/generic-oauth2';
import type { Session, User, AuthError } from '@supabase/supabase-js';

export interface SupabaseAuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
}

let deepLinkListenerRegistered = false;

// Supabase project configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

export async function signInWithGoogle(): Promise<void> {
  console.log('[SupabaseAuth] Starting Google OAuth sign-in');
  
  const isNative = isNativePlatform();
  console.log('[SupabaseAuth] Platform check for OAuth, isNative:', isNative);
  
  // For native iOS/Android, use GenericOAuth2 with ASWebAuthenticationSession
  // This is the proper iOS OAuth solution that handles URL scheme callbacks correctly
  if (isNative) {
    console.log('[SupabaseAuth] Using GenericOAuth2 with ASWebAuthenticationSession for native');
    
    try {
      // Generate the Supabase OAuth URL first to get PKCE code verifier stored
      const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'com.fieldsnaps.app://auth/callback',
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (oauthError || !oauthData.url) {
        console.error('[SupabaseAuth] Error generating OAuth URL:', oauthError);
        throw oauthError || new Error('No OAuth URL returned');
      }
      
      console.log('[SupabaseAuth] Supabase OAuth URL generated');
      console.log('[SupabaseAuth] Opening with GenericOAuth2 (ASWebAuthenticationSession)...');
      
      // Use GenericOAuth2 which uses ASWebAuthenticationSession on iOS
      // This properly handles the custom URL scheme callback
      const result = await GenericOAuth2.authenticate({
        authorizationBaseUrl: oauthData.url,
        accessTokenEndpoint: '', // Not needed, we just want the redirect
        appId: 'com.fieldsnaps.app',
        responseType: 'code',
        scope: 'openid email profile',
        pkceEnabled: false, // Supabase handles PKCE internally
        web: {
          redirectUrl: `${window.location.origin}/auth/callback`,
          windowOptions: 'height=600,left=0,top=0'
        },
        ios: {
          appId: 'com.fieldsnaps.app',
          redirectUrl: 'com.fieldsnaps.app://auth/callback',
        },
        android: {
          appId: 'com.fieldsnaps.app',
          redirectUrl: 'com.fieldsnaps.app://auth/callback',
        }
      });
      
      console.log('[SupabaseAuth] GenericOAuth2 returned:', JSON.stringify(result));
      
      // The result contains the authorization response URL
      // Extract the code and exchange it for a session
      if (result.authorization_response) {
        const responseUrl = result.authorization_response;
        console.log('[SupabaseAuth] Authorization response URL:', responseUrl);
        
        // Parse the URL to extract the code
        const urlParams = new URL(responseUrl.replace('com.fieldsnaps.app://', 'https://app/'));
        const code = urlParams.searchParams.get('code');
        
        if (code) {
          console.log('[SupabaseAuth] Found authorization code, exchanging for session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('[SupabaseAuth] Error exchanging code:', error);
            throw error;
          }
          
          console.log('[SupabaseAuth] Successfully authenticated user:', data.user?.id);
          return;
        }
      }
      
      // Also check for access_token directly in result
      if (result.access_token) {
        console.log('[SupabaseAuth] Found access token in result');
        // Handle direct token response if present
        return;
      }
      
      console.log('[SupabaseAuth] No authorization code found in response');
      
    } catch (error: any) {
      console.error('[SupabaseAuth] GenericOAuth2 error:', error);
      
      // User cancelled the auth flow
      if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        console.log('[SupabaseAuth] User cancelled authentication');
        return;
      }
      
      throw error;
    }
    
    return;
  }
  
  // Web flow - use default Supabase behavior
  const redirectTo = getRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  
  if (error) {
    console.error('[SupabaseAuth] Google OAuth error:', error);
    throw error;
  }
  
  console.log('[SupabaseAuth] OAuth initiated, URL:', data.url);
}

export async function signInWithApple(): Promise<void> {
  console.log('[SupabaseAuth] Starting Apple OAuth sign-in');
  
  const isNative = isNativePlatform();
  
  // For native iOS, use GenericOAuth2 with ASWebAuthenticationSession
  if (isNative) {
    console.log('[SupabaseAuth] Using GenericOAuth2 with ASWebAuthenticationSession for Apple');
    
    try {
      // Generate the Supabase Apple OAuth URL first
      const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'com.fieldsnaps.app://auth/callback',
          skipBrowserRedirect: true,
        },
      });
      
      if (oauthError || !oauthData.url) {
        console.error('[SupabaseAuth] Error generating Apple OAuth URL:', oauthError);
        throw oauthError || new Error('No OAuth URL returned');
      }
      
      console.log('[SupabaseAuth] Supabase Apple OAuth URL generated');
      console.log('[SupabaseAuth] Opening with GenericOAuth2 (ASWebAuthenticationSession)...');
      
      // Use GenericOAuth2 which uses ASWebAuthenticationSession on iOS
      const result = await GenericOAuth2.authenticate({
        authorizationBaseUrl: oauthData.url,
        accessTokenEndpoint: '',
        appId: 'com.fieldsnaps.app',
        responseType: 'code',
        scope: 'openid email name',
        pkceEnabled: false,
        web: {
          redirectUrl: `${window.location.origin}/auth/callback`,
          windowOptions: 'height=600,left=0,top=0'
        },
        ios: {
          appId: 'com.fieldsnaps.app',
          redirectUrl: 'com.fieldsnaps.app://auth/callback',
        },
        android: {
          appId: 'com.fieldsnaps.app',
          redirectUrl: 'com.fieldsnaps.app://auth/callback',
        }
      });
      
      console.log('[SupabaseAuth] GenericOAuth2 Apple returned:', JSON.stringify(result));
      
      // Extract the code and exchange it for a session
      if (result.authorization_response) {
        const responseUrl = result.authorization_response;
        console.log('[SupabaseAuth] Apple authorization response URL:', responseUrl);
        
        const urlParams = new URL(responseUrl.replace('com.fieldsnaps.app://', 'https://app/'));
        const code = urlParams.searchParams.get('code');
        
        if (code) {
          console.log('[SupabaseAuth] Found Apple authorization code, exchanging for session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('[SupabaseAuth] Error exchanging Apple code:', error);
            throw error;
          }
          
          console.log('[SupabaseAuth] Successfully authenticated Apple user:', data.user?.id);
          return;
        }
      }
      
      console.log('[SupabaseAuth] No authorization code found in Apple response');
      
    } catch (error: any) {
      console.error('[SupabaseAuth] Apple GenericOAuth2 error:', error);
      
      if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        console.log('[SupabaseAuth] User cancelled Apple authentication');
        return;
      }
      
      throw error;
    }
    
    return;
  }
  
  // Web flow
  const redirectTo = getRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo,
    },
  });
  
  if (error) {
    console.error('[SupabaseAuth] Apple OAuth error:', error);
    throw error;
  }
  
  console.log('[SupabaseAuth] Apple OAuth initiated');
}

export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; session: Session | null }> {
  console.log('[SupabaseAuth] Starting email sign-in for:', email);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('[SupabaseAuth] Email sign-in error:', error);
    throw error;
  }
  
  console.log('[SupabaseAuth] Email sign-in successful');
  return { user: data.user, session: data.session };
}

export async function signUpWithEmail(email: string, password: string): Promise<{ user: User | null; session: Session | null }> {
  console.log('[SupabaseAuth] Starting email sign-up for:', email);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) {
    console.error('[SupabaseAuth] Email sign-up error:', error);
    throw error;
  }
  
  console.log('[SupabaseAuth] Email sign-up successful');
  return { user: data.user, session: data.session };
}

export async function signOut(): Promise<void> {
  console.log('[SupabaseAuth] Signing out');
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('[SupabaseAuth] Sign-out error:', error);
    throw error;
  }
  
  console.log('[SupabaseAuth] Sign-out successful');
}

export async function getSession(): Promise<Session | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('[SupabaseAuth] Get session error:', error);
    return null;
  }
  
  return session;
}

export async function getUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('[SupabaseAuth] Get user error:', error);
    return null;
  }
  
  return user;
}

export async function refreshSession(): Promise<Session | null> {
  console.log('[SupabaseAuth] Refreshing session');
  
  const { data: { session }, error } = await supabase.auth.refreshSession();
  
  if (error) {
    console.error('[SupabaseAuth] Refresh session error:', error);
    return null;
  }
  
  console.log('[SupabaseAuth] Session refreshed successfully');
  return session;
}

async function handleOAuthCallback(url: string): Promise<boolean> {
  console.log('[SupabaseAuth] Processing potential OAuth callback:', url);
  
  if (!url.includes('auth/callback') && !url.includes('#access_token')) {
    console.log('[SupabaseAuth] URL is not an OAuth callback');
    return false;
  }
  
  console.log('[SupabaseAuth] Processing OAuth callback');
  
  // Close the in-app browser on iOS (it doesn't auto-close)
  if (isNativePlatform()) {
    try {
      console.log('[SupabaseAuth] Closing in-app browser');
      await Browser.close();
    } catch (e) {
      console.log('[SupabaseAuth] Browser close failed (may already be closed):', e);
    }
  }
  
  try {
    // Handle custom scheme URLs (com.fieldsnaps.app://...)
    // Convert to a proper URL format for parsing
    let urlToParse = url;
    if (url.startsWith('com.fieldsnaps.app://')) {
      urlToParse = url.replace('com.fieldsnaps.app://', 'https://fieldsnaps.app/');
    }
    
    const parsedUrl = new URL(urlToParse);
    
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    
    // Check hash fragment first (implicit flow)
    const fragment = parsedUrl.hash.substring(1);
    if (fragment) {
      const params = new URLSearchParams(fragment);
      accessToken = params.get('access_token');
      refreshToken = params.get('refresh_token');
    }
    
    // Check query params if not in fragment
    if (!accessToken) {
      accessToken = parsedUrl.searchParams.get('access_token');
      refreshToken = parsedUrl.searchParams.get('refresh_token');
    }
    
    if (accessToken && refreshToken) {
      console.log('[SupabaseAuth] Found tokens in callback, setting session');
      
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      
      if (error) {
        console.error('[SupabaseAuth] Error setting session:', error);
        throw error;
      }
      
      await supabase.auth.refreshSession();
      
      console.log('[SupabaseAuth] Session set successfully, user:', data.user?.id);
      return true;
    } else {
      // Check for authorization code (PKCE flow)
      const code = parsedUrl.searchParams.get('code');
      if (code) {
        console.log('[SupabaseAuth] Found authorization code, exchanging for session');
        
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('[SupabaseAuth] Error exchanging code:', error);
          throw error;
        }
        
        console.log('[SupabaseAuth] Code exchanged successfully, user:', data.user?.id);
        return true;
      }
    }
  } catch (error) {
    console.error('[SupabaseAuth] Error processing OAuth callback:', error);
  }
  
  return false;
}

export function setupDeepLinkListener(): void {
  if (deepLinkListenerRegistered) {
    console.log('[SupabaseAuth] Deep link listener already registered');
    return;
  }
  
  // Use a more reliable native check - getPlatform() instead of isNativePlatform()
  // isNativePlatform() can return false on iOS in some edge cases
  const isNative = isNativePlatform();
  console.log('[SupabaseAuth] Platform check for deep link listener, isNative:', isNative);
  
  if (!isNative) {
    console.log('[SupabaseAuth] Not native platform, skipping deep link listener');
    return;
  }
  
  console.log('[SupabaseAuth] Setting up deep link listener for OAuth callbacks');
  
  // Check if app was launched with a URL (cold start from deep link)
  App.getLaunchUrl().then((launchUrl) => {
    console.log('[SupabaseAuth] getLaunchUrl result:', launchUrl);
    if (launchUrl?.url) {
      console.log('[SupabaseAuth] App launched with URL:', launchUrl.url);
      handleOAuthCallback(launchUrl.url);
    }
  }).catch((error) => {
    console.error('[SupabaseAuth] Error getting launch URL:', error);
  });
  
  // Listen for deep links when app is already running
  App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
    console.log('[SupabaseAuth] *** appUrlOpen event received ***');
    console.log('[SupabaseAuth] App opened with URL:', event.url);
    const result = await handleOAuthCallback(event.url);
    console.log('[SupabaseAuth] OAuth callback handled, result:', result);
  });
  
  deepLinkListenerRegistered = true;
  console.log('[SupabaseAuth] Deep link listener registered successfully');
}

export function onAuthStateChange(callback: (session: Session | null, user: User | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('[SupabaseAuth] Auth state changed:', event);
    callback(session, session?.user ?? null);
  });
  
  return () => {
    subscription.unsubscribe();
  };
}

export async function initializeAuth(): Promise<{ session: Session | null; user: User | null }> {
  console.log('[SupabaseAuth] Initializing auth');
  
  setupDeepLinkListener();
  
  const session = await getSession();
  const user = session?.user ?? null;
  
  console.log('[SupabaseAuth] Auth initialized, user:', user?.id ?? 'none');
  
  return { session, user };
}

export async function resetPassword(email: string): Promise<void> {
  console.log('[SupabaseAuth] Sending password reset email to:', email);
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
  });
  
  if (error) {
    console.error('[SupabaseAuth] Password reset error:', error);
    throw error;
  }
  
  console.log('[SupabaseAuth] Password reset email sent');
}

export async function updatePassword(newPassword: string): Promise<void> {
  console.log('[SupabaseAuth] Updating password');
  
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  if (error) {
    console.error('[SupabaseAuth] Update password error:', error);
    throw error;
  }
  
  console.log('[SupabaseAuth] Password updated successfully');
}
