import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback, useRef } from "react";
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
import { setSentryUser, clearSentryUser, addSentryBreadcrumb } from "@/sentry";

interface AuthState {
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  isInitialized: boolean;
}

interface AuthContextValue {
  user: User | undefined;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSupabaseAuthenticated: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: typeof signInWithGoogle;
  signInWithApple: typeof signInWithApple;
  signInWithEmail: typeof signInWithEmail;
  signUpWithEmail: typeof signUpWithEmail;
  getAccessToken: () => string | null;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    supabaseUser: null,
    isInitialized: false,
  });

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const { session, user } = await initializeAuth();
        
        if (cancelled) return;
        
        setAuthState({
          session,
          supabaseUser: user,
          isInitialized: true,
        });
        
        if (session) {
          console.log('[AuthContext] Session found, invalidating user query to trigger fetch');
          queryClient.invalidateQueries({ queryKey: ["auth", "currentUser"] });
        }
        
        unsubscribe = onAuthStateChange((session, user) => {
          if (cancelled) return;
          console.log('[AuthContext] Auth state changed:', user?.id ?? 'signed out');
          setAuthState(prev => ({
            ...prev,
            session,
            supabaseUser: user,
          }));
          
          if (session) {
            console.log('[AuthContext] Session available after auth change, invalidating query');
            queryClient.invalidateQueries({ queryKey: ["auth", "currentUser"] });
          }
        });
      } catch (error) {
        if (cancelled) return;
        console.error('[AuthContext] Initialization error:', error);
        setAuthState(prev => ({ ...prev, isInitialized: true }));
      }
    };

    init();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient]);

  const queryEnabled = authState.isInitialized && !!authState.session;
  console.log('[AuthContext] Query enabled check:', { 
    isInitialized: authState.isInitialized, 
    hasSession: !!authState.session,
    enabled: queryEnabled 
  });

  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = authState.session;
  
  const refetchRef = useRef<(() => Promise<any>) | null>(null);
  
  const { data: user, isLoading: isLoadingUser, isFetching: isFetchingUser, refetch } = useQuery<User>({
    queryKey: ["auth", "currentUser"],
    retry: false,
    enabled: queryEnabled,
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
    queryFn: async () => {
      console.log('[AuthContext] ========== QUERY STARTING ==========');
      
      const currentSession = sessionRef.current;
      console.log('[AuthContext] Session from ref:', !!currentSession);
      console.log('[AuthContext] Fetching user data...');
      
      const token = currentSession?.access_token;
      console.log('[AuthContext] Token from session:', !!token, token ? token.substring(0, 30) + '...' : 'null');
      
      if (!token) {
        console.error('[AuthContext] No token in session - this should not happen');
        throw new Error('No session token available');
      }
      
      const apiUrl = getApiUrl('/api/auth/user');
      console.log('[AuthContext] Making request to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(10000),
      });
      
      console.log('[AuthContext] Response received:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.error('[AuthContext] Error response body:', errorBody);
        } catch (e) {
          console.error('[AuthContext] Could not read error body');
        }
        
        if (response.status === 401 || response.status === 403) {
          console.error('[AuthContext] Backend rejected token (401/403), clearing session');
          console.error('[AuthContext] Error details:', errorBody);
          clearSentryUser();
          try {
            await supabaseSignOut();
          } catch (e) {
            console.error('[AuthContext] Error signing out:', e);
          }
          setAuthState({
            session: null,
            supabaseUser: null,
            isInitialized: true,
          });
          throw new Error(`Session expired - ${errorBody || 'please login again'}`);
        }
        throw new Error(`Failed to fetch user: ${response.status} ${errorBody}`);
      }
      
      const userData = await response.json();
      
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

  refetchRef.current = refetch;
  
  useEffect(() => {
    if (queryEnabled && refetchRef.current) {
      console.log('[AuthContext] Query enabled - calling refetch directly');
      refetchRef.current();
    }
  }, [queryEnabled]);

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
      console.error('[AuthContext] Sign out error:', error);
      throw error;
    }
  }, [queryClient]);

  const getAccessToken = useCallback((): string | null => {
    return authState.session?.access_token ?? null;
  }, [authState.session]);

  const refetchUser = useCallback(async () => {
    if (refetchRef.current) {
      await refetchRef.current();
    }
  }, []);

  const isLoading = !authState.isInitialized || (authState.session && (isLoadingUser || (!user && isFetchingUser)));

  const value: AuthContextValue = {
    user,
    supabaseUser: authState.supabaseUser,
    session: authState.session,
    isLoading: !!isLoading,
    isAuthenticated: !!authState.session && !!user,
    isSupabaseAuthenticated: !!authState.session,
    signOut,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    getAccessToken,
    refetchUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
