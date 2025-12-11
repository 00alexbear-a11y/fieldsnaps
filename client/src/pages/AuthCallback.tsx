import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { updatePassword, signOut } from '@/lib/supabaseAuth';
import { Loader2, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

type CallbackMode = 'loading' | 'recovery' | 'success' | 'error';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<CallbackMode>('loading');
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function handleCallback() {
      console.log('[AuthCallback] Processing callback');
      
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const code = queryParams.get('code');
        const errorParam = queryParams.get('error');
        const errorDescription = queryParams.get('error_description');
        const callbackType = queryParams.get('type');
        
        console.log('[AuthCallback] Callback type:', callbackType);
        
        if (errorParam) {
          console.error('[AuthCallback] OAuth error:', errorParam, errorDescription);
          setError(errorDescription || errorParam);
          setMode('error');
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
            setMode('error');
            return;
          }
          
          console.log('[AuthCallback] Session set successfully');
          
          if (callbackType === 'recovery') {
            console.log('[AuthCallback] Recovery flow detected, showing password reset form');
            setMode('recovery');
            return;
          }
        } else if (code) {
          console.log('[AuthCallback] Exchanging code for session');
          
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('[AuthCallback] Error exchanging code:', exchangeError);
            setError(exchangeError.message);
            setMode('error');
            return;
          }
          
          console.log('[AuthCallback] Code exchanged successfully');
          
          if (callbackType === 'recovery') {
            console.log('[AuthCallback] Recovery flow detected, showing password reset form');
            setMode('recovery');
            return;
          }
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            console.log('[AuthCallback] No tokens or code found, and no existing session');
            setError('Authentication failed. Please try again.');
            setMode('error');
            return;
          }
          
          console.log('[AuthCallback] Found existing session');
          
          if (callbackType === 'recovery') {
            console.log('[AuthCallback] Recovery flow detected, showing password reset form');
            setMode('recovery');
            return;
          }
        }
        
        console.log('[AuthCallback] Redirecting to projects');
        setLocation('/projects');
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err);
        setError('An unexpected error occurred. Please try again.');
        setMode('error');
      }
    }
    
    handleCallback();
  }, [setLocation]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await updatePassword(newPassword);
      console.log('[AuthCallback] Password updated successfully');
      
      // Sign out after password update so user can log in fresh
      await signOut();
      console.log('[AuthCallback] Signed out after password update');
      
      setMode('success');
    } catch (err: any) {
      console.error('[AuthCallback] Password update error:', err);
      setError(err.message || 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRecovery = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[AuthCallback] Error signing out:', err);
    }
    // Force full page reload to prevent App.tsx guards from redirecting back
    window.location.href = '/login';
  };

  if (mode === 'recovery') {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Back button to escape recovery flow */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={handleCancelRecovery}
            data-testid="button-cancel-recovery"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Login
          </Button>

          <div className="flex flex-col items-center space-y-3">
            <img 
              src={logoPath} 
              alt="FieldSnaps" 
              className="h-12 w-auto object-contain"
              data-testid="img-reset-logo"
            />
            <h1 className="text-2xl font-bold">Set New Password</h1>
            <p className="text-muted-foreground text-center">
              Enter your new password below
            </p>
          </div>

          <Card className="p-5">
            {error && (
              <div className="text-center text-sm text-destructive bg-destructive/10 p-2.5 rounded-lg mb-4" data-testid="text-reset-error">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    disabled={isSubmitting}
                    autoFocus
                    data-testid="input-new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  disabled={isSubmitting}
                  data-testid="input-confirm-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !newPassword || !confirmPassword}
                data-testid="button-reset-password"
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  if (mode === 'success') {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold">Password Updated</h1>
            <p className="text-muted-foreground">
              Your password has been successfully updated.
            </p>
          </div>

          <Button
            onClick={() => setLocation('/login')}
            className="w-full"
            data-testid="button-continue-login"
          >
            Continue to Login
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" data-testid="auth-callback-error">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-destructive">Authentication Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button
            onClick={() => setLocation('/login')}
            data-testid="button-retry-login"
          >
            Try Again
          </Button>
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
