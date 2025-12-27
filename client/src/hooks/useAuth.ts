import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import type { User } from "@shared/schema";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { 
  onAuthStateChange, 
  initializeAuth, 
  signOut as supabaseSignOut,
  signInWithGoogle,
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/supabaseAuth";
import { getApiUrl } from "@/lib/apiUrl";
import { tokenManager } from "@/lib/tokenManager";
import { setSentryUser, clearSentryUser, addSentryBreadcrumb } from "@/sentry";

interface AuthState {
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  isInitialized: boolean;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    supabaseUser: null,
    isInitialized: false,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let initCompleted = false;

    const init = async () => {
      try {
        const { session, user } = await initializeAuth();
        initCompleted = true;
        
        setAuthState({
          session,
          supabaseUser: user,
          isInitialized: true,
        });
        
        if (session) {
          // Use invalidateQueries instead of resetQueries to trigger a refetch
          // resetQueries clears the cache but doesn't trigger refetch when enabled changes
          console.log('[useAuth] Session found, invalidating user query to trigger fetch');
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        }
        
        // Register auth state change listener AFTER initialization completes
        // This prevents race conditions where cached Keychain sessions override
        // the fresh-install session clear
        unsubscribe = onAuthStateChange((session, user) => {
          console.log('[useAuth] Auth state changed:', user?.id ?? 'signed out');
          setAuthState(prev => ({
            ...prev,
            session,
            supabaseUser: user,
          }));
          
          // Use invalidateQueries to trigger refetch - prevents stale user data from
          // causing incorrect onboarding/routing decisions
          if (session) {
            console.log('[useAuth] Session available after auth change, invalidating query');
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          }
        });
      } catch (error) {
        console.error('[useAuth] Initialization error:', error);
        initCompleted = true;
        setAuthState(prev => ({ ...prev, isInitialized: true }));
      }
    };

    init();

    return () => {
      unsubscribe?.();
    };
  }, [queryClient]);

  // Log enabled state for debugging
  const queryEnabled = authState.isInitialized && !!authState.session;
  console.log('[useAuth] Query enabled check:', { 
    isInitialized: authState.isInitialized, 
    hasSession: !!authState.session,
    enabled: queryEnabled 
  });

  const { data: user, isLoading: isLoadingUser, isFetching: isFetchingUser, refetch } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: queryEnabled,
    // Don't refetch on window focus - user data doesn't change often
    refetchOnWindowFocus: false,
    // Set staleTime to 0 to ensure fresh fetch when enabled changes
    // The enabled flag already prevents unnecessary fetches
    staleTime: 0,
    // Force refetch when query becomes enabled
    refetchOnMount: 'always',
    // CRITICAL: gcTime controls how long inactive queries stay in cache
    // Set to 0 to clear cache immediately when query is disabled
    gcTime: 0,
    queryFn: async () => {
      console.log('[useAuth] ========== QUERY STARTING ==========');
      console.log('[useAuth] Session available:', !!authState.session);
      console.log('[useAuth] Fetching user data...');
      
      // Use tokenManager for consistency with other queries (same token source)
      console.log('[useAuth] Getting token from tokenManager...');
      const token = await tokenManager.getValidAccessToken();
      console.log('[useAuth] Token result:', !!token, token ? token.substring(0, 30) + '...' : 'null');
      
      if (!token) {
        console.error('[useAuth] No valid token available');
        throw new Error('No valid token');
      }
      
      const apiUrl = getApiUrl('/api/auth/user');
      console.log('[useAuth] Token obtained, making request to:', apiUrl);
      
      // Use getApiUrl to ensure iOS native app hits the correct backend server
      // Add 10 second timeout to prevent hanging requests
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      console.log('[useAuth] Response received:', response.status, response.statusText);
      
      if (!response.ok) {
        // Handle 401/403: Backend doesn't recognize the Supabase token
        // Clear the invalid session to prevent infinite loading state
        if (response.status === 401 || response.status === 403) {
          console.log('[useAuth] Backend rejected token (401/403), clearing session');
          clearSentryUser();
          try {
            await supabaseSignOut();
          } catch (e) {
            console.error('[useAuth] Error signing out:', e);
          }
          setAuthState({
            session: null,
            supabaseUser: null,
            isInitialized: true,
          });
          throw new Error('Session expired - please login again');
        }
        throw new Error('Failed to fetch user');
      }
      
      const userData = await response.json();
      
      // Set Sentry user context for error tracking
      if (userData && userData.id) {
        setSentryUser({
          id: userData.id,
          email: userData.email,
          subscriptionStatus: userData.subscriptionStatus,
        });
        addSentryBreadcrumb("User authenticated", {
          userId: userData.id,
          subscriptionStatus: userData.subscriptionStatus,
        });
      }
      
      return userData;
    },
  });

  const signOut = useCallback(async () => {
    try {
      await supabaseSignOut();
      clearSentryUser();
      addSentryBreadcrumb("User logged out");
      setAuthState({
        session: null,
        supabaseUser: null,
        isInitialized: true,
      });
      queryClient.clear();
    } catch (error) {
      console.error('[useAuth] Sign out error:', error);
      throw error;
    }
  }, [queryClient]);

  const getAccessToken = useCallback((): string | null => {
    return authState.session?.access_token ?? null;
  }, [authState.session]);

  // isLoading is true when:
  // 1. Auth is not initialized, OR
  // 2. Session exists AND (user query is loading OR (user doesn't exist AND query is fetching))
  // The extra check for !user && isFetchingUser handles the case where cache was reset
  // and we're waiting for fresh user data before making routing decisions
  const isLoading = !authState.isInitialized || (authState.session && (isLoadingUser || (!user && isFetchingUser)));

  return {
    user,
    supabaseUser: authState.supabaseUser,
    session: authState.session,
    isLoading,
    isAuthenticated: !!authState.session && !!user,
    isSupabaseAuthenticated: !!authState.session,
    signOut,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    getAccessToken,
  };
}
