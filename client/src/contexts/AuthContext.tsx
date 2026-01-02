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
  isFetching: boolean;
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
          queryClient.invalidateQueries({ queryKey: ["auth", "currentUser"] });
        }
        
        unsubscribe = onAuthStateChange((session, user) => {
          if (cancelled) return;
          setAuthState(prev => ({
            ...prev,
            session,
            supabaseUser: user,
          }));
          
          if (session) {
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
  console.log('[Auth] queryEnabled:', queryEnabled, 'isInitialized:', authState.isInitialized, 'hasSession:', !!authState.session);

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
      const currentSession = sessionRef.current;
      const token = currentSession?.access_token;
      
      console.log('[Auth] Query starting, hasToken:', !!token);
      
      if (!token) {
        console.error('[Auth] No token available');
        throw new Error('No session token available');
      }
      
      const apiUrl = getApiUrl('/api/auth/user');
      console.log('[Auth] Fetching:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(10000),
      });
      
      console.log('[Auth] Response:', response.status, response.ok);
      
      // CRITICAL: Check content-type before parsing JSON
      // On native, if API URL is misconfigured, we might get HTML instead of JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const body = await response.text();
        console.error('[Auth] Expected JSON but got:', contentType, body.substring(0, 200));
        throw new Error(`API returned non-JSON response (${contentType}). Check VITE_API_URL config.`);
      }
      
      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch (e) {}
        
        console.error('[Auth] Error body:', errorBody.substring(0, 200));
        
        if (response.status === 401 || response.status === 403) {
          console.error('[Auth] Session rejected:', response.status);
          clearSentryUser();
          try {
            await supabaseSignOut();
          } catch (e) {}
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
      console.log('[Auth] User loaded:', userData?.id);
      
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
    isFetching: isFetchingUser,
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
