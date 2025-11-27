import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      console.log('[AuthCallback] Processing OAuth callback');
      
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const code = queryParams.get('code');
        const errorParam = queryParams.get('error');
        const errorDescription = queryParams.get('error_description');
        
        if (errorParam) {
          console.error('[AuthCallback] OAuth error:', errorParam, errorDescription);
          setError(errorDescription || errorParam);
          return;
        }
        
        if (accessToken && refreshToken) {
          console.log('[AuthCallback] Setting session from tokens');
          
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            console.error('[AuthCallback] Error setting session:', sessionError);
            setError(sessionError.message);
            return;
          }
          
          console.log('[AuthCallback] Session set successfully');
        } else if (code) {
          console.log('[AuthCallback] Exchanging code for session');
          
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('[AuthCallback] Error exchanging code:', exchangeError);
            setError(exchangeError.message);
            return;
          }
          
          console.log('[AuthCallback] Code exchanged successfully');
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            console.log('[AuthCallback] No tokens or code found, and no existing session');
            setError('Authentication failed. Please try again.');
            return;
          }
          
          console.log('[AuthCallback] Found existing session');
        }
        
        console.log('[AuthCallback] Redirecting to home');
        setLocation('/');
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    }
    
    handleCallback();
  }, [setLocation]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" data-testid="auth-callback-error">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-destructive">Authentication Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => setLocation('/login')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            data-testid="button-retry-login"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" data-testid="auth-callback-loading">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Completing sign in...</p>
    </div>
  );
}
