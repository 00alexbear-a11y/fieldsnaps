import { Fingerprint, LogIn, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { useState, useEffect } from 'react';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { buildReplitAuthUrl, openOAuthInBrowser } from '@/lib/nativeOAuth';
import { getApiBaseUrl } from '@/lib/apiUrl';

// Get server URL based on platform
const getServerUrl = () => {
  const baseUrl = getApiBaseUrl();
  
  // If baseUrl is empty (web platform), use current origin
  if (!baseUrl) {
    return window.location.origin;
  }
  
  // Native platform - use the configured API base URL (production server)
  return baseUrl;
};

export default function NativeAppLogin() {
  const { authenticateWithBiometric, checkBiometricSupport, isLoading: isWebAuthnLoading } = useWebAuthn();
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    checkBiometricSupport().then(setBiometricSupported);
  }, [checkBiometricSupport]);

  const handleBiometricLogin = async () => {
    const user = await authenticateWithBiometric();
    if (user) {
      window.location.href = '/';
    }
  };

  const handleSignIn = async () => {
    const serverUrl = getServerUrl();
    const authUrl = buildReplitAuthUrl(serverUrl);
    await openOAuthInBrowser(authUrl);
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
        {biometricSupported && (
          <Button
            variant="default"
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
          variant={biometricSupported ? "outline" : "default"}
          size="default"
          className="w-full"
          onClick={handleSignIn}
          data-testid="button-login"
        >
          <LogIn className="w-4 h-4 mr-2" />
          Sign In
        </Button>

        <div className="text-center pt-2">
          <button
            onClick={handleSignIn}
            className="text-sm text-primary font-medium inline-flex items-center gap-1 hover-elevate active-elevate-2"
            data-testid="link-try-now"
          >
            Try Now - Start Free Trial
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center px-4">
          {biometricSupported 
            ? 'Secure authentication with Face ID, Touch ID, or your account'
            : 'Sign in or start your free trial to get started'}
        </p>
      </div>
    </div>
  );
}
