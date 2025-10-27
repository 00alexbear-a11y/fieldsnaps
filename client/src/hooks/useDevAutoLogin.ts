import { useEffect, useRef } from 'react';
import { queryClient } from '@/lib/queryClient';

/**
 * Automatically logs in as dev user during development for faster testing.
 * This is compile-time gated and tree-shaken from production builds.
 */
export function useDevAutoLogin() {
  const hasAttemptedLogin = useRef(false);

  useEffect(() => {
    // Only run in development mode
    if (!import.meta.env.DEV) {
      return;
    }

    // Only run once
    if (hasAttemptedLogin.current) {
      return;
    }

    hasAttemptedLogin.current = true;

    // Automatically login as dev user
    const autoLogin = async () => {
      try {
        console.log('[DevAutoLogin] Automatically logging in as dev user...');
        const response = await fetch('/api/dev-login', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          console.log('[DevAutoLogin] ✅ Auto-login successful');
          // Invalidate auth query to trigger re-fetch with new session
          await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          console.log('[DevAutoLogin] 🔄 Auth query invalidated');
        } else {
          console.warn('[DevAutoLogin] ⚠️ Auto-login failed:', response.status);
        }
      } catch (error) {
        console.error('[DevAutoLogin] ❌ Auto-login error:', error);
      }
    };

    autoLogin();
  }, []);
}
