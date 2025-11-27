import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables. Auth features may not work.');
}

const SUPABASE_AUTH_KEY = 'supabase.auth.token';
let cachedSession: string | null = null;

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

const isNative = Capacitor.isNativePlatform();

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
          if (cachedSession && key === SUPABASE_AUTH_KEY) {
            return cachedSession;
          }
          const value = await getFromSecureStorage(key);
          if (key === SUPABASE_AUTH_KEY) {
            cachedSession = value;
          }
          return value;
        },
        setItem: async (key: string, value: string) => {
          if (key === SUPABASE_AUTH_KEY) {
            cachedSession = value;
          }
          await setToSecureStorage(key, value);
        },
        removeItem: async (key: string) => {
          if (key === SUPABASE_AUTH_KEY) {
            cachedSession = null;
          }
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
  if (Capacitor.isNativePlatform()) {
    return 'com.fieldsnaps.app://auth/callback';
  }
  return `${window.location.origin}/auth/callback`;
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
