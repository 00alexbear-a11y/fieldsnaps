import { Fingerprint, LogIn, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { useState, useEffect } from 'react';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { signInWithGoogle, initializeAuth, onAuthStateChange } from '@/lib/supabaseAuth';
import { useLocation } from 'wouter';

export default function NativeAppLogin() {
  const [, setLocation] = useLocation();
  const { authenticateWithBiometric, checkBiometricSupport, isLoading: isWebAuthnLoading } = useWebAuthn();
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // ONLY show dev login in Vite dev server - NEVER in builds
  // This is compile-time only and will be tree-shaken out of production
  const isDevMode = import.meta.env.DEV;

  useEffect(() => {
    checkBiometricSupport().then(setBiometricSupported);
  }, [checkBiometricSupport]);

  // Initialize Supabase auth and listen for auth state changes
  useEffect(() => {
    initializeAuth();
    
    // Listen for successful auth from OAuth callback
    const unsubscribe = onAuthStateChange((session, user) => {
      if (session && user) {
        console.log('[NativeAppLogin] Auth state changed - user signed in:', user.email);
        // Redirect to home on successful auth
        setLocation('/');
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [setLocation]);

  const handleBiometricLogin = async () => {
    const user = await authenticateWithBiometric();
    if (user) {
      window.location.href = '/';
    }
  };

  const handleDevLogin = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      console.log('[DevLogin] Using Dev Login (bypassing OAuth)');
      
      // Call backend dev-login endpoint which:
      // 1. Creates dev user with admin subscription
      // 2. Creates dev company with active subscription
      // 3. Creates a session and redirects to home
      window.location.href = '/api/dev-login';
    } catch (error) {
      console.error('[DevLogin] Dev login failed:', error);
      setAuthError('Dev login failed. Please try again.');
      setIsAuthenticating(false);
    }
  };

  const handleSignInWithGoogle = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      console.log('[Login] Starting Google OAuth authentication via Supabase');
      
      // This will redirect to Google OAuth page
      await signInWithGoogle();
      
      // Note: The page will redirect, so we won't reach here normally
      // If we do reach here, it means something went wrong
    } catch (error) {
      console.error('[Login] Google authentication failed:', error);
      setAuthError('Authentication failed. Please try again.');
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="h-screen bg-white dark:bg-black flex flex-col overflow-hidden">
      {/* Hero Section - Takes up most of screen */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8 overflow-y-auto">
        {/* Logo and Title */}
        <div className="flex flex-col items-center space-y-6">
          <img 
            src={logoPath} 
            alt="FieldSnaps" 
            className="h-20 w-auto object-contain"
            data-testid="img-native-login-logo"
          />
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">FieldSnaps</h1>
            <p className="text-lg text-muted-foreground max-w-sm">
              Professional photo documentation for construction teams
            </p>
          </div>
        </div>

        {/* Key Features */}
        <div className="space-y-4 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <p className="text-muted-foreground">Capture photos offline, sync when connected</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <p className="text-muted-foreground">Annotate and organize by project</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <p className="text-muted-foreground">Share securely with your team</p>
          </div>
        </div>
      </div>

      {/* Bottom CTA Section */}
      <div className="p-6 space-y-4 pb-8">
        {/* Error message */}
        {authError && (
          <div className="text-center text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            {authError}
          </div>
        )}

        {/* DEV LOGIN - Only visible in development mode */}
        {isDevMode && (
          <>
            <Button
              variant="default"
              size="lg"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
              onClick={handleDevLogin}
              disabled={isAuthenticating}
              data-testid="button-dev-login"
            >
              <Zap className="w-5 h-5 mr-2" />
              {isAuthenticating ? 'Logging in...' : 'Dev Login (Skip OAuth)'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-black px-2 text-muted-foreground">
                  Or use production login
                </span>
              </div>
            </div>
          </>
        )}
        
        {biometricSupported && (
          <Button
            variant="outline"
            size="default"
            className="w-full"
            onClick={handleBiometricLogin}
            disabled={isWebAuthnLoading}
            data-testid="button-biometric-login"
          >
            <Fingerprint className="w-4 h-4 mr-2" />
            {isWebAuthnLoading ? 'Authenticating...' : 'Sign In with Face ID'}
          </Button>
        )}
        
        {/* Google Sign-In Button */}
        <Button
          variant={biometricSupported && !isDevMode ? "outline" : "default"}
          size="default"
          className="w-full"
          onClick={handleSignInWithGoogle}
          disabled={isAuthenticating}
          data-testid="button-login-google"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isAuthenticating ? 'Signing in...' : 'Continue with Google'}
        </Button>

        <p className="text-xs text-muted-foreground text-center px-4 pt-2">
          {isDevMode 
            ? 'Dev Login gives instant access for testing. Use production login for real accounts.'
            : biometricSupported 
              ? 'Secure authentication with Face ID, Touch ID, or your Google account'
              : 'Sign in with your Google account to get started'}
        </p>
      </div>
    </div>
  );
}
