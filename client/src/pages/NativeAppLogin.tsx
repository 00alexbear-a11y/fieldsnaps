import { Fingerprint, LogIn, Zap, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { useState, useEffect } from 'react';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { 
  signInWithGoogle, 
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  initializeAuth, 
  onAuthStateChange 
} from '@/lib/supabaseAuth';
import { useLocation } from 'wouter';

type AuthView = 'main' | 'email-entry' | 'email-signin' | 'email-signup' | 'forgot-password';

export default function NativeAppLogin() {
  const [, setLocation] = useLocation();
  const { authenticateWithBiometric, checkBiometricSupport, isLoading: isWebAuthnLoading } = useWebAuthn();
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  
  // Email auth state
  const [authView, setAuthView] = useState<AuthView>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // ONLY show dev login in Vite dev server - NEVER in builds
  const isDevMode = import.meta.env.DEV;

  useEffect(() => {
    checkBiometricSupport().then(setBiometricSupported);
  }, [checkBiometricSupport]);

  // Initialize Supabase auth and listen for auth state changes
  useEffect(() => {
    initializeAuth();
    
    const unsubscribe = onAuthStateChange((session, user) => {
      if (session && user) {
        console.log('[NativeAppLogin] Auth state changed - user signed in:', user.email);
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
      console.log('[Login] Starting Apple OAuth authentication via Supabase');
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
      setAuthView('email-signin');
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
      setAuthView('email-signin');
    } catch (error: any) {
      console.error('[Login] Password reset failed:', error);
      setAuthError(error.message || 'Failed to send reset email');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const renderMainView = () => (
    <>
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
        variant={(biometricSupported || isDevMode) ? "outline" : "default"}
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

      {/* Apple Sign-In Button */}
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

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-black px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* Email Sign-In Button */}
      <Button
        variant="outline"
        size="default"
        className="w-full"
        onClick={() => {
          setAuthError(null);
          setAuthSuccess(null);
          setAuthView('email-entry');
        }}
        data-testid="button-login-email"
      >
        <Mail className="w-4 h-4 mr-2" />
        Continue with Email
      </Button>

      <p className="text-xs text-muted-foreground text-center px-4 pt-2">
        Sign in with your preferred method
      </p>
    </>
  );

  const renderEmailEntryView = () => (
    <div className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => {
          setAuthError(null);
          setAuthSuccess(null);
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setAuthView('main');
        }}
        data-testid="button-email-entry-back"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className="space-y-2">
        <Label htmlFor="email-entry">Email address</Label>
        <Input
          id="email-entry"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isAuthenticating}
          autoComplete="email"
          data-testid="input-email-entry"
        />
      </div>

      <div className="space-y-2 pt-2">
        <Button
          type="button"
          className="w-full"
          disabled={isAuthenticating || !email.includes('@')}
          onClick={() => {
            setAuthError(null);
            setPassword('');
            setAuthView('email-signin');
          }}
          data-testid="button-check-email"
        >
          Sign in
        </Button>
        
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isAuthenticating || !email.includes('@')}
          onClick={() => {
            setAuthError(null);
            setPassword('');
            setConfirmPassword('');
            setAuthView('email-signup');
          }}
          data-testid="button-goto-signup"
        >
          Create Account
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Enter your email, then choose to sign in or create a new account
      </p>
    </div>
  );

  const renderEmailSignInView = () => (
    <form onSubmit={handleEmailSignIn} className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => {
          setAuthError(null);
          setPassword('');
          setAuthView('email-entry');
        }}
        data-testid="button-email-back"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className="space-y-2">
        <Label htmlFor="email-signin">Email</Label>
        <Input
          id="email-signin"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isAuthenticating}
          autoComplete="email"
          data-testid="input-email-signin"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isAuthenticating}
          autoComplete="current-password"
          data-testid="input-email-password"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isAuthenticating || !email || !password}
        data-testid="button-email-submit"
      >
        {isAuthenticating ? 'Signing in...' : 'Sign In'}
      </Button>

      <div className="text-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary"
          onClick={() => {
            setAuthError(null);
            setAuthView('forgot-password');
          }}
          data-testid="button-forgot-password"
        >
          Forgot password?
        </Button>
      </div>
    </form>
  );

  const renderEmailSignUpView = () => (
    <form onSubmit={handleEmailSignUp} className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => {
          setAuthError(null);
          setPassword('');
          setConfirmPassword('');
          setAuthView('email-entry');
        }}
        data-testid="button-signup-back"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className="space-y-2">
        <Label htmlFor="email-signup">Email</Label>
        <Input
          id="email-signup"
          type="email"
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
          placeholder="Create a password (min 6 characters)"
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
          data-testid="input-signup-confirm-password"
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
          setAuthView('email-signin');
        }}
        data-testid="button-forgot-back"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className="text-center mb-4">
        <h3 className="font-semibold">Reset Password</h3>
        <p className="text-sm text-muted-foreground">
          Enter your email to receive a reset link
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-email">Email address</Label>
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
    <div className="min-h-screen bg-white dark:bg-black flex flex-col overflow-auto pb-safe pt-safe">
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
        <div className="w-full max-w-md space-y-6">
          {/* Logo and Title */}
          <div className="flex flex-col items-center space-y-3">
            <img 
              src={logoPath} 
              alt="FieldSnaps" 
              className="h-12 w-auto object-contain"
              data-testid="img-native-login-logo"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">FieldSnaps</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Professional photo documentation for construction teams
              </p>
            </div>
          </div>

          {/* Key Features - Only show on main view */}
          {authView === 'main' && (
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-muted-foreground">Capture photos offline, sync when connected</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-muted-foreground">Annotate and organize by project</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-muted-foreground">Share securely with your team</p>
              </div>
            </div>
          )}

          {/* Auth Card */}
          <Card className="p-5 space-y-3">
            {authError && (
              <div className="text-center text-sm text-destructive bg-destructive/10 p-2.5 rounded-lg" data-testid="text-auth-error">
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="text-center text-sm text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 p-2.5 rounded-lg" data-testid="text-auth-success">
                {authSuccess}
              </div>
            )}

            {authView === 'main' && renderMainView()}
            {authView === 'email-entry' && renderEmailEntryView()}
            {authView === 'email-signin' && renderEmailSignInView()}
            {authView === 'email-signup' && renderEmailSignUpView()}
            {authView === 'forgot-password' && renderForgotPasswordView()}
          </Card>
        </div>
      </div>
    </div>
  );
}
