import { supabase, getRedirectUrl, isNativePlatform } from './supabase';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SocialLogin } from '@capgo/capacitor-social-login';
import type { Session, User, AuthError } from '@supabase/supabase-js';

// First-launch detection key - stored in Preferences (NOT Keychain)
// Preferences data is cleared on app uninstall, unlike iOS Keychain
const FIRST_LAUNCH_COMPLETED_KEY = 'fieldsnaps.first.launch.completed';

// Track if we're in the middle of a fresh-install session clear
// This prevents onAuthStateChange from immediately restoring the cached session
let freshInstallSessionCleared = false;

// Track if auth has been initialized to prevent multiple initialization calls
let authInitializationPromise: Promise<{ session: Session | null; user: User | null }> | null = null;

// Cache the auth result so subsequent calls return immediately without triggering effects
let cachedAuthResult: { session: Session | null; user: User | null } | null = null;
let isAuthInitialized = false;

// Check if user has completed initial login on this app install
async function hasCompletedFirstLaunch(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: FIRST_LAUNCH_COMPLETED_KEY });
    const completed = value === 'true';
    console.log('[SupabaseAuth] First launch check:', completed ? 'completed' : 'not completed');
    return completed;
  } catch (error) {
    console.error('[SupabaseAuth] Error checking first launch flag:', error);
    return false;
  }
}

// Mark that user has completed initial login
export async function setFirstLaunchCompleted(): Promise<void> {
  try {
    await Preferences.set({ key: FIRST_LAUNCH_COMPLETED_KEY, value: 'true' });
    // Reset the fresh-install flag so auth state changes work normally
    freshInstallSessionCleared = false;
    console.log('[SupabaseAuth] First launch marked as completed');
  } catch (error) {
    console.error('[SupabaseAuth] Error setting first launch flag:', error);
  }
}

// Clear the first launch flag (called on sign out)
export async function clearFirstLaunchFlag(): Promise<void> {
  try {
    await Preferences.remove({ key: FIRST_LAUNCH_COMPLETED_KEY });
    console.log('[SupabaseAuth] First launch flag cleared');
  } catch (error) {
    console.error('[SupabaseAuth] Error clearing first launch flag:', error);
  }
}

export interface SupabaseAuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
}

let deepLinkListenerRegistered = false;
let socialLoginInitialized = false;

// Initialize SocialLogin for native platforms
async function initializeSocialLogin(): Promise<void> {
  if (socialLoginInitialized) return;
  
  try {
    const platform = Capacitor.getPlatform();
    console.log('[SupabaseAuth] Initializing SocialLogin for platform:', platform);
    
    // Initialize with platform-specific options
    await SocialLogin.initialize({
      google: {
        // Web Client ID from Google Cloud Console (also used for iOS)
        webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '',
      },
      apple: {
        // Apple Sign-In doesn't require additional config here
        // It uses the app's entitlements
      },
    });
    
    socialLoginInitialized = true;
    console.log('[SupabaseAuth] SocialLogin initialized successfully');
  } catch (error) {
    console.error('[SupabaseAuth] Failed to initialize SocialLogin:', error);
    throw error;
  }
}

export async function signInWithGoogle(): Promise<void> {
  console.log('[SupabaseAuth] Starting Google OAuth sign-in');
  
  const isNative = isNativePlatform();
  console.log('[SupabaseAuth] Platform check for OAuth, isNative:', isNative);
  
  // For native iOS/Android, use native Google Sign-In SDK
  // This returns an ID token that we pass to Supabase signInWithIdToken
  if (isNative) {
    console.log('[SupabaseAuth] Using native Google Sign-In SDK');
    
    try {
      await initializeSocialLogin();
      
      // Perform native Google Sign-In
      const response = await SocialLogin.login({
        provider: 'google',
        options: {
          scopes: ['email', 'profile'],
        },
      });
      
      console.log('[SupabaseAuth] Native Google Sign-In result:', JSON.stringify(response));
      
      // Extract idToken from the response (type assertion needed as types may be outdated)
      const result = response.result as { idToken?: string; accessToken?: { token?: string } };
      
      if (result?.idToken) {
        // Use the ID token to authenticate with Supabase
        console.log('[SupabaseAuth] Got ID token, authenticating with Supabase...');
        
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
          access_token: result.accessToken?.token,
        });
        
        if (error) {
          console.error('[SupabaseAuth] Supabase signInWithIdToken error:', error);
          throw error;
        }
        
        // Mark first launch as completed after successful login
        await setFirstLaunchCompleted();
        
        console.log('[SupabaseAuth] Successfully authenticated with Supabase:', data.user?.id);
        return;
      } else {
        console.error('[SupabaseAuth] No ID token returned from Google Sign-In');
        throw new Error('No ID token returned from Google Sign-In');
      }
    } catch (error: any) {
      console.error('[SupabaseAuth] Native Google Sign-In error:', error);
      
      // Check if user cancelled
      if (error.message?.includes('cancelled') || error.message?.includes('canceled') || 
          error.code === 'USER_CANCELLED' || error.message?.includes('USER_CANCELLED')) {
        console.log('[SupabaseAuth] User cancelled Google Sign-In');
        return;
      }
      
      throw error;
    }
  }
  
  // Web flow - use default Supabase OAuth behavior
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
  
  // For native iOS, use native Apple Sign-In SDK
  if (isNative) {
    console.log('[SupabaseAuth] Using native Apple Sign-In SDK');
    
    try {
      await initializeSocialLogin();
      
      // Perform native Apple Sign-In
      const response = await SocialLogin.login({
        provider: 'apple',
        options: {
          scopes: ['email', 'name'],
        },
      });
      
      console.log('[SupabaseAuth] Native Apple Sign-In result:', JSON.stringify(response));
      
      // Extract idToken from the response (type assertion needed as types may be outdated)
      const result = response.result as { idToken?: string };
      
      if (result?.idToken) {
        // Use the ID token to authenticate with Supabase
        console.log('[SupabaseAuth] Got Apple ID token, authenticating with Supabase...');
        
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: result.idToken,
        });
        
        if (error) {
          console.error('[SupabaseAuth] Supabase signInWithIdToken (Apple) error:', error);
          throw error;
        }
        
        // Mark first launch as completed after successful login
        await setFirstLaunchCompleted();
        
        console.log('[SupabaseAuth] Successfully authenticated Apple user with Supabase:', data.user?.id);
        return;
      } else {
        console.error('[SupabaseAuth] No ID token returned from Apple Sign-In');
        throw new Error('No ID token returned from Apple Sign-In');
      }
    } catch (error: any) {
      console.error('[SupabaseAuth] Native Apple Sign-In error:', error);
      
      // Check if user cancelled
      if (error.message?.includes('cancelled') || error.message?.includes('canceled') || 
          error.code === 'USER_CANCELLED' || error.message?.includes('USER_CANCELLED') ||
          error.code === 1001) { // Apple Sign-In cancel code
        console.log('[SupabaseAuth] User cancelled Apple Sign-In');
        return;
      }
      
      throw error;
    }
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
  
  // Mark first launch as completed after successful login
  await setFirstLaunchCompleted();
  
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
  
  // Mark first launch as completed after successful sign-up (if session was created)
  if (data.session) {
    await setFirstLaunchCompleted();
  }
  
  console.log('[SupabaseAuth] Email sign-up successful');
  return { user: data.user, session: data.session };
}

export async function signOut(): Promise<void> {
  console.log('[SupabaseAuth] Signing out');
  
  // Clear the first-launch flag so user sees login screen next time
  await clearFirstLaunchFlag();
  
  // Reset auth initialization cache so next login reinitializes properly
  isAuthInitialized = false;
  cachedAuthResult = null;
  authInitializationPromise = null;
  
  // On native platforms, also sign out from SocialLogin to clear cached Google account
  // This ensures Google prompts for account selection on next login
  if (isNativePlatform() && socialLoginInitialized) {
    try {
      await SocialLogin.logout({ provider: 'google' });
      console.log('[SupabaseAuth] SocialLogin Google logout successful');
    } catch (socialError) {
      // Don't block signout if SocialLogin logout fails
      console.warn('[SupabaseAuth] SocialLogin logout error (non-blocking):', socialError);
    }
  }
  
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
      
      // Mark first launch as completed after successful OAuth
      await setFirstLaunchCompleted();
      
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
        
        // Mark first launch as completed after successful OAuth
        await setFirstLaunchCompleted();
        
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
    
    // If we just cleared the session for a fresh install, ignore INITIAL_SESSION events
    // that try to restore cached Keychain tokens. But ALLOW SIGNED_IN events from active logins.
    if (freshInstallSessionCleared && session && event === 'INITIAL_SESSION') {
      console.log('[SupabaseAuth] Ignoring cached INITIAL_SESSION event during fresh-install clear');
      return;
    }
    
    // If user actively signed in, reset the fresh-install flag so future events work normally
    if (event === 'SIGNED_IN' && freshInstallSessionCleared) {
      console.log('[SupabaseAuth] Active sign-in detected, resetting fresh-install flag');
      freshInstallSessionCleared = false;
    }
    
    // Update the auth cache when auth state changes
    // This ensures initializeAuth returns fresh data after login/logout
    if (event === 'SIGNED_IN' && session) {
      cachedAuthResult = { session, user: session.user };
      isAuthInitialized = true;
    } else if (event === 'SIGNED_OUT') {
      cachedAuthResult = null;
      isAuthInitialized = false;
      authInitializationPromise = null;
    }
    
    callback(session, session?.user ?? null);
  });
  
  return () => {
    subscription.unsubscribe();
  };
}

export async function initializeAuth(): Promise<{ session: Session | null; user: User | null }> {
  // If already fully initialized, return cached result immediately
  // This prevents multiple components from triggering repeated initialization
  if (isAuthInitialized && cachedAuthResult) {
    return cachedAuthResult;
  }
  
  // If initialization is in progress, wait for it
  if (authInitializationPromise) {
    console.log('[SupabaseAuth] Auth initialization already in progress, returning existing promise');
    return authInitializationPromise;
  }
  
  // Create the initialization promise
  authInitializationPromise = (async () => {
    try {
      console.log('[SupabaseAuth] Initializing auth');
      
      setupDeepLinkListener();
      
      // Trust Supabase SDK's built-in session management
      // It handles persistence via SecureStorage/Capacitor Preferences automatically
      const session = await getSession();
      const user = session?.user ?? null;
      
      console.log('[SupabaseAuth] Auth initialized, user:', user?.id ?? 'none');
      
      const result = { session, user };
      
      // Cache the result and mark as initialized
      cachedAuthResult = result;
      isAuthInitialized = true;
      
      // Clear the promise since we're done (result is now in cache)
      authInitializationPromise = null;
      
      return result;
    } catch (error) {
      console.error('[SupabaseAuth] Initialization failed:', error);
      // Reset on failure to allow retry
      authInitializationPromise = null;
      cachedAuthResult = null;
      isAuthInitialized = false;
      throw error;
    }
  })();
  
  return authInitializationPromise;
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
