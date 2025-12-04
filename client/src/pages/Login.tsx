import { Fingerprint, LogIn, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { isDevModeEnabled } from '@/config/devMode';
import { 
  signInWithGoogle, 
  signInWithApple, 
  signInWithEmail, 
  signUpWithEmail, 
  resetPassword,
  initializeAuth, 
  onAuthStateChange 
} from '@/lib/supabaseAuth';

type AuthView = 'main' | 'email' | 'signup' | 'forgot-password';

export default function Login() {
  const [, setLocation] = useLocation();
  const { authenticateWithBiometric, checkBiometricSupport, isLoading: isWebAuthnLoading } = useWebAuthn();
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const isDevelopment = isDevModeEnabled();
  
  const [authView, setAuthView] = useState<AuthView>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    checkBiometricSupport().then(setBiometricSupported);
  }, [checkBiometricSupport]);

  useEffect(() => {
    initializeAuth();
    
    const unsubscribe = onAuthStateChange((session, user) => {
      if (session && user) {
        console.log('[Login] Auth state changed - user signed in:', user.email);
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

  const handleSignInWithGoogle = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await signInWithGoogle();
    } catch (error) {
      console.error('[Login] Google authentication failed:', error);
      setAuthError('Authentication failed. Please try again.');
      setIsAuthenticating(false);
    }
  };

  const handleSignInWithApple = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await signInWithApple();
    } catch (error) {
      console.error('[Login] Apple authentication failed:', error);
      setAuthError('Authentication failed. Please try again.');
      setIsAuthenticating(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setAuthError('Please enter your email and password');
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await signInWithEmail(email, password);
      setLocation('/');
    } catch (error: any) {
      console.error('[Login] Email sign-in failed:', error);
      setAuthError(error.message || 'Invalid email or password');
      setIsAuthenticating(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setAuthError('Please enter your email and password');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await signUpWithEmail(email, password);
      setAuthSuccess('Check your email to confirm your account');
      setAuthView('email');
    } catch (error: any) {
      console.error('[Login] Email sign-up failed:', error);
      setAuthError(error.message || 'Failed to create account');
      setIsAuthenticating(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setAuthError('Please enter your email address');
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await resetPassword(email);
      setAuthSuccess('Password reset email sent. Check your inbox.');
      setAuthView('email');
    } catch (error: any) {
      console.error('[Login] Password reset failed:', error);
      setAuthError(error.message || 'Failed to send reset email');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const showAppleSignIn = true;

  const renderMainView = () => (
    <>
      <div className="space-y-3">
        {isDevelopment && (
          <Button
            variant="default"
            size="default"
            className="w-full bg-orange-600 hover:bg-orange-700"
            onClick={() => window.location.href = '/api/dev-login'}
            data-testid="button-dev-login"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Dev Login (Simulator)
          </Button>
        )}
        
        {biometricSupported && (
          <Button
            variant={isDevelopment ? "outline" : "default"}
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
          variant={(biometricSupported || isDevelopment) ? "outline" : "default"}
          size="default"
          className="w-full"
          onClick={handleSignInWithGoogle}
          disabled={isAuthenticating}
          data-testid="button-login-google"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {isAuthenticating ? 'Signing in...' : 'Continue with Google'}
        </Button>

        {showAppleSignIn && (
          <Button
            variant="outline"
            size="default"
            className="w-full bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            onClick={handleSignInWithApple}
            disabled={isAuthenticating}
            data-testid="button-login-apple"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {isAuthenticating ? 'Signing in...' : 'Continue with Apple'}
          </Button>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="default"
          className="w-full"
          onClick={() => {
            setAuthError(null);
            setAuthSuccess(null);
            setAuthView('email');
          }}
          data-testid="button-login-email"
        >
          <Mail className="w-4 h-4 mr-2" />
          Continue with Email
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Sign in with your preferred method to access your projects
      </p>
    </>
  );

  const renderEmailView = () => (
    <form onSubmit={handleEmailSignIn} className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => {
          setAuthError(null);
          setAuthSuccess(null);
          setAuthView('main');
        }}
        data-testid="button-back-to-main"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isAuthenticating}
          autoComplete="email"
          data-testid="input-email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isAuthenticating}
          autoComplete="current-password"
          data-testid="input-password"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isAuthenticating || !email || !password}
        data-testid="button-signin-email"
      >
        {isAuthenticating ? 'Signing in...' : 'Sign In'}
      </Button>

      <div className="flex justify-between text-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-0 h-auto text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setAuthError(null);
            setAuthSuccess(null);
            setAuthView('forgot-password');
          }}
          data-testid="button-forgot-password"
        >
          Forgot password?
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-0 h-auto text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setAuthError(null);
            setAuthSuccess(null);
            setAuthView('signup');
          }}
          data-testid="button-goto-signup"
        >
          Create account
        </Button>
      </div>
    </form>
  );

  const renderSignUpView = () => (
    <form onSubmit={handleEmailSignUp} className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => {
          setAuthError(null);
          setAuthSuccess(null);
          setAuthView('email');
        }}
        data-testid="button-back-to-email"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold">Create your account</h2>
        <p className="text-sm text-muted-foreground">Enter your details to get started</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isAuthenticating}
          autoComplete="email"
          data-testid="input-signup-email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isAuthenticating}
          autoComplete="new-password"
          data-testid="input-signup-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isAuthenticating}
          autoComplete="new-password"
          data-testid="input-confirm-password"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isAuthenticating || !email || !password || !confirmPassword}
        data-testid="button-signup-submit"
      >
        {isAuthenticating ? 'Creating account...' : 'Create Account'}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        By signing up, you agree to our Terms of Service
      </p>
    </form>
  );

  const renderForgotPasswordView = () => (
    <form onSubmit={handleForgotPassword} className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => {
          setAuthError(null);
          setAuthSuccess(null);
          setAuthView('email');
        }}
        data-testid="button-back-to-email-forgot"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold">Reset your password</h2>
        <p className="text-sm text-muted-foreground">We'll send you a link to reset your password</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isAuthenticating}
          autoComplete="email"
          data-testid="input-reset-email"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isAuthenticating || !email}
        data-testid="button-reset-submit"
      >
        {isAuthenticating ? 'Sending...' : 'Send Reset Link'}
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-start">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="gap-2 text-muted-foreground hover:text-foreground"
            data-testid="button-back-to-home"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Button>
        </div>

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

        <Card className="p-6 space-y-4">
          {authError && (
            <div className="text-center text-sm text-destructive bg-destructive/10 p-3 rounded-lg" data-testid="text-auth-error">
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className="text-center text-sm text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 p-3 rounded-lg" data-testid="text-auth-success">
              {authSuccess}
            </div>
          )}

          {authView === 'main' && renderMainView()}
          {authView === 'email' && renderEmailView()}
          {authView === 'signup' && renderSignUpView()}
          {authView === 'forgot-password' && renderForgotPasswordView()}
        </Card>

        {authView === 'main' && (
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
        )}
      </div>
    </div>
  );
}
