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
          // Use resetQueries to CLEAR cache (not just invalidate) - this ensures
          // fresh data is loaded with proper loading state, preventing stale
          // user data (e.g., missing companyId) from causing wrong routing
          queryClient.resetQueries({ queryKey: ["/api/auth/user"] });
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
          
          // Use resetQueries to CLEAR cache - prevents stale user data from
          // causing incorrect onboarding/routing decisions
          queryClient.resetQueries({ queryKey: ["/api/auth/user"] });
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

  const { data: user, isLoading: isLoadingUser, isFetching: isFetchingUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: authState.isInitialized && !!authState.session,
    // Don't refetch on window focus - user data doesn't change often
    refetchOnWindowFocus: false,
    // Cache user data for 5 minutes to prevent infinite refetch loop
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!authState.session?.access_token) {
        throw new Error('No session');
      }
      
      // Use getApiUrl to ensure iOS native app hits the correct backend server
      const response = await fetch(getApiUrl('/api/auth/user'), {
        headers: {
          'Authorization': `Bearer ${authState.session.access_token}`,
        },
      });
      
      if (!response.ok) {
        // Handle 401/403: Backend doesn't recognize the Supabase token
        // Clear the invalid session to prevent infinite loading state
        if (response.status === 401 || response.status === 403) {
          console.log('[useAuth] Backend rejected token (401/403), clearing session');
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
      
      return response.json();
    },
  });

  const signOut = useCallback(async () => {
    try {
      await supabaseSignOut();
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
