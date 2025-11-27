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

    const init = async () => {
      try {
        const { session, user } = await initializeAuth();
        setAuthState({
          session,
          supabaseUser: user,
          isInitialized: true,
        });
        
        if (session) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        }
      } catch (error) {
        console.error('[useAuth] Initialization error:', error);
        setAuthState(prev => ({ ...prev, isInitialized: true }));
      }
    };

    init();

    unsubscribe = onAuthStateChange((session, user) => {
      console.log('[useAuth] Auth state changed:', user?.id ?? 'signed out');
      setAuthState(prev => ({
        ...prev,
        session,
        supabaseUser: user,
      }));
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    });

    return () => {
      unsubscribe?.();
    };
  }, [queryClient]);

  const { data: user, isLoading: isLoadingUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: authState.isInitialized && !!authState.session,
    queryFn: async () => {
      if (!authState.session?.access_token) {
        throw new Error('No session');
      }
      
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${authState.session.access_token}`,
        },
      });
      
      if (!response.ok) {
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

  const isLoading = !authState.isInitialized || (authState.session && isLoadingUser);

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
