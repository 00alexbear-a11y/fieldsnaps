import { Fingerprint, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

export default function Login() {
  const [, setLocation] = useLocation();
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

  const handleSkip = () => {
    // Store skip flag in sessionStorage
    sessionStorage.setItem('skipAuth', 'true');
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4">
          <img 
            src={logoPath} 
            alt="FieldSnaps" 
            className="h-16 w-auto object-contain"
            data-testid="img-login-logo"
          />
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Welcome to FieldSnaps</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to capture and document job sites
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="p-6 space-y-4">
          <div className="space-y-3">
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
                {isWebAuthnLoading ? 'Authenticating...' : 'Sign In with Biometrics'}
              </Button>
            )}
            
            <Button
              variant={biometricSupported ? "outline" : "default"}
              size="default"
              className="w-full"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-login"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In with Replit
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {biometricSupported 
              ? 'Use Touch ID, Face ID, Windows Hello, or Replit to sign in'
              : 'Sign in with your Replit account to get started'}
          </p>
        </Card>

        {/* Skip Button for Testing */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-skip-auth"
          >
            Skip for now (Testing)
          </Button>
        </div>

        {/* Features List */}
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
            <p>Capture photos offline with instant sync when connected</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
            <p>Annotate and organize photos by project</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
            <p>View projects on an interactive map</p>
          </div>
        </div>
      </div>
    </div>
  );
}
