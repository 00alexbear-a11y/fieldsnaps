import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables. Auth features may not work.');
}

// In-memory cache for all Supabase storage keys to prevent repeated SecureStorage reads
// Supabase SDK v2 uses key format: sb-{project_ref}-auth-token
const storageCache: Map<string, string | null> = new Map();

// Use getPlatform() which is more reliable than isNativePlatform()
// isNativePlatform() can return false on iOS in some edge cases
function checkIsNative(): boolean {
  try {
    const platform = Capacitor.getPlatform();
    const isNative = platform !== 'web';
    console.log(`[Supabase] Platform check: ${platform}, isNative: ${isNative}`);
    return isNative;
  } catch (e) {
    console.log('[Supabase] Platform check failed, assuming web');
    return false;
  }
}

async function getFromSecureStorage(key: string): Promise<string | null> {
  try {
    const result = await SecureStorage.get(key);
    if (!result) return null;
    
    let rawValue: string;
    if (typeof result === 'object' && 'data' in result) {
      rawValue = (result as any).data;
    } else {
      rawValue = result as string;
    }
    
    if (!rawValue) return null;
    
    if (typeof rawValue === 'string' && rawValue.startsWith('"') && rawValue.endsWith('"')) {
      return JSON.parse(rawValue);
    }
    
    return rawValue;
  } catch (error) {
    console.log('[Supabase Storage] SecureStorage get failed, falling back to localStorage');
    return window.localStorage?.getItem(key) ?? null;
  }
}

async function setToSecureStorage(key: string, value: string): Promise<void> {
  try {
    await SecureStorage.set(key, value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    console.log('[Supabase Storage] SecureStorage set failed, using localStorage');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  }
}

async function removeFromSecureStorage(key: string): Promise<void> {
  try {
    await SecureStorage.remove(key);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    console.log('[Supabase Storage] SecureStorage remove failed, using localStorage');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  }
}

// Call checkIsNative() at module load time for storage selection
const isNative = checkIsNative();

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      storage: isNative ? {
        getItem: async (key: string) => {
          // Check in-memory cache first to avoid repeated SecureStorage reads
          if (storageCache.has(key)) {
            return storageCache.get(key) ?? null;
          }
          const value = await getFromSecureStorage(key);
          storageCache.set(key, value);
          return value;
        },
        setItem: async (key: string, value: string) => {
          storageCache.set(key, value);
          await setToSecureStorage(key, value);
        },
        removeItem: async (key: string) => {
          storageCache.delete(key);
          await removeFromSecureStorage(key);
        },
      } : {
        getItem: (key: string) => {
          if (typeof window !== 'undefined') {
            return window.localStorage.getItem(key);
          }
          return null;
        },
        setItem: (key: string, value: string) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, value);
          }
        },
        removeItem: (key: string) => {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(key);
          }
        },
      },
    },
  }
);

export function getRedirectUrl(): string {
  // Use getPlatform() which is more reliable than isNativePlatform()
  try {
    const platform = Capacitor.getPlatform();
    if (platform !== 'web') {
      return 'com.fieldsnaps.app://auth/callback';
    }
  } catch (e) {
    // Fall through to web redirect
  }
  return `${window.location.origin}/auth/callback`;
}

export function isNativePlatform(): boolean {
  // Use getPlatform() which is more reliable than isNativePlatform()
  try {
    const platform = Capacitor.getPlatform();
    return platform !== 'web';
  } catch (e) {
    return false;
  }
}
