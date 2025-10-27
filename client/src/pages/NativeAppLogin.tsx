import { Fingerprint, LogIn, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { useState, useEffect } from 'react';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { authenticateWithReplit } from '@/lib/nativeOAuth';
import { tokenManager } from '@/lib/tokenManager';

export default function NativeAppLogin() {
  const { authenticateWithBiometric, checkBiometricSupport, isLoading: isWebAuthnLoading } = useWebAuthn();
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // ONLY show dev login in Vite dev server - NEVER in builds
  // This is compile-time only and will be tree-shaken out of production
  const isDevMode = import.meta.env.DEV;

  useEffect(() => {
    checkBiometricSupport().then(setBiometricSupported);
  }, [checkBiometricSupport]);

  const handleBiometricLogin = async () => {
    const user = await authenticateWithBiometric();
    if (user) {
      window.location.href = '/';
    }
  };

  const handleDevLogin = async () => {
    try {
      setIsAuthenticating(true);
      console.log('[DevLogin] 🚀 Using Dev Login (bypassing OAuth)');
      
      // Call backend dev-login endpoint which:
      // 1. Creates dev user with admin subscription
      // 2. Creates dev company with active subscription
      // 3. Creates a session and redirects to home
      console.log('[DevLogin] 📡 Calling /api/dev-login...');
      window.location.href = '/api/dev-login';
    } catch (error) {
      console.error('[DevLogin] ❌ Dev login failed:', error);
      alert('Dev login failed. Check console for details.');
      setIsAuthenticating(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsAuthenticating(true);
      console.log('[Login] 🚀 Starting OAuth authentication');
      
      // Authenticate using new PKCE flow with ASWebAuthenticationSession
      const result = await authenticateWithReplit();
      
      console.log('[Login] ✅ Authentication successful');
      console.log('[Login] 💾 Storing tokens in Keychain');
      
      // Store tokens in iOS Keychain via tokenManager
      await tokenManager.storeTokens(
        result.access_token,
        result.refresh_token,
        result.expires_in
      );
      
      console.log('[Login] ✅ Tokens stored successfully');
      console.log('[Login] 🎉 Login complete, redirecting...');
      
      // Redirect based on user state
      if (result.user.needsCompanySetup) {
        window.location.href = '/onboarding/company-setup';
      } else {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('[Login] ❌ Authentication failed:', error);
      alert('Authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* Hero Section - Takes up most of screen */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
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
        
        <Button
          variant={biometricSupported && !isDevMode ? "outline" : "default"}
          size="default"
          className="w-full"
          onClick={handleSignIn}
          disabled={isAuthenticating}
          data-testid="button-login"
        >
          <LogIn className="w-4 h-4 mr-2" />
          {isAuthenticating ? 'Authenticating...' : 'Sign In with Replit'}
        </Button>

        <p className="text-xs text-muted-foreground text-center px-4 pt-2">
          {isDevMode 
            ? 'Dev Login gives instant access for testing. Use production login for real accounts.'
            : biometricSupported 
              ? 'Secure authentication with Face ID, Touch ID, or your account'
              : 'Sign in to get started with your free trial'}
        </p>
      </div>
    </div>
  );
}
