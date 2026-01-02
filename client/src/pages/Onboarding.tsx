import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, User, ArrowRight, ArrowLeft, Check, Users, Link2, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/apiUrl';
import { useAuthContext } from '@/contexts/AuthContext';
import { signOut } from '@/lib/supabaseAuth';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type UserRole } from '@shared/permissions';

type OnboardingStep = 'profile' | 'company';

interface InviteValidation {
  companyName: string;
  valid: boolean;
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [joinMode, setJoinMode] = useState<'create' | 'join'>('create');
  const [inviteValidation, setInviteValidation] = useState<InviteValidation | null>(null);
  const [isValidatingInvite, setIsValidatingInvite] = useState(false);

  const { user } = useAuthContext();

  useEffect(() => {
    if (user) {
      if (user.firstName) setFirstName(user.firstName);
      if (user.lastName) setLastName(user.lastName);
      
      // If user already has a company, skip onboarding entirely
      // This handles cases where user lands on /onboarding but already has a company
      if (user.companyId) {
        console.log('[Onboarding] User already has company, redirecting to projects');
        setLocation('/projects');
      }
    }
  }, [user, setLocation]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (token) {
      setInviteToken(token);
      setJoinMode('join');
      validateInviteToken(token);
    }
  }, []);

  const validateInviteToken = async (token: string) => {
    if (!token || token.length < 10) {
      setInviteValidation(null);
      return;
    }
    
    setIsValidatingInvite(true);
    try {
      const response = await fetch(getApiUrl(`/api/companies/invite/${token}`));
      if (response.ok) {
        const data = await response.json();
        setInviteValidation({ companyName: data.companyName, valid: true });
      } else {
        const error = await response.json();
        setInviteValidation(null);
        toast({
          title: "Invalid invite link",
          description: error.error || "The invite link is invalid or expired",
          variant: "destructive",
        });
      }
    } catch (error) {
      setInviteValidation(null);
    } finally {
      setIsValidatingInvite(false);
    }
  };

  const handleProfileSubmit = async () => {
    if (!firstName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your first name",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest('PUT', '/api/auth/user/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] });
      setStep('company');
    } catch (error: any) {
      toast({
        title: "Failed to update profile",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      toast({
        title: "Company name required",
        description: "Please enter a name for your company",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/api/companies', { name: companyName });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] });

      toast({
        title: "Welcome to FieldSnaps!",
        description: `${companyName} has been created. Let's get started!`,
      });

      setLocation('/projects');
    } catch (error: any) {
      // If user already has a company (e.g., from production DB sync), just redirect
      if (error.message?.includes('already belongs to a company')) {
        await queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] });
        toast({
          title: "Welcome back!",
          description: "Redirecting to your projects...",
        });
        setLocation('/projects');
        return;
      }
      
      toast({
        title: "Failed to create company",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinCompany = async () => {
    if (!inviteToken) {
      toast({
        title: "Invite code required",
        description: "Please enter your invite code",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('POST', `/api/companies/invite/${inviteToken}/accept`, {});
      await queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] });

      toast({
        title: "Welcome to the team!",
        description: `You've joined ${inviteValidation?.companyName || 'the company'}`,
      });

      setLocation('/projects');
    } catch (error: any) {
      // If user already has a company, just redirect
      if (error.message?.includes('already belongs to a company')) {
        await queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] });
        toast({
          title: "Welcome back!",
          description: "Redirecting to your projects...",
        });
        setLocation('/projects');
        return;
      }
      
      toast({
        title: "Failed to join company",
        description: error.message || "The invite may be invalid or expired",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.clear();
      // Use window.location to force full page reload, ensuring auth state is re-evaluated
      // This prevents race conditions where App.tsx guards redirect back before session clears
      window.location.href = '/login';
    } catch (error) {
      console.error('[Onboarding] Sign out error:', error);
      // Force redirect even if signOut fails
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <img 
            src={logoPath} 
            alt="FieldSnaps" 
            className="h-14 w-auto object-contain"
            data-testid="img-onboarding-logo"
          />
        </div>

        <div className="flex justify-center gap-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${step === 'profile' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'company' ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        {step === 'profile' && (
          <Card className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Tell us about yourself</h2>
              <p className="text-muted-foreground mt-1">This helps your team identify you</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                  data-testid="input-first-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-last-name"
                />
              </div>

              <Button
                onClick={handleProfileSubmit}
                className="w-full mt-4"
                disabled={!firstName.trim()}
                data-testid="button-continue-profile"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {step === 'company' && (
          <Card className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Set up your workspace</h2>
              <p className="text-muted-foreground mt-1">Create a company or join an existing team</p>
            </div>

            <div className="flex gap-2 mb-6">
              <Button
                variant={joinMode === 'create' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setJoinMode('create')}
                data-testid="button-mode-create"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Create New
              </Button>
              <Button
                variant={joinMode === 'join' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setJoinMode('join')}
                data-testid="button-mode-join"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Join Team
              </Button>
            </div>

            {joinMode === 'create' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="ABC Construction"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={isSubmitting}
                    data-testid="input-company-name"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be visible to all team members
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep('profile')}
                    disabled={isSubmitting}
                    data-testid="button-back-to-profile"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateCompany}
                    className="flex-1"
                    disabled={isSubmitting || !companyName.trim()}
                    data-testid="button-create-company"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Company'}
                    <Check className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium text-sm mb-2">What's included:</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-500" />
                      You'll be the company Admin
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-500" />
                      Invite unlimited team members
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-500" />
                      $19.99/user/month after trial
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteToken">Invite Code</Label>
                  <Input
                    id="inviteToken"
                    type="text"
                    placeholder="Paste your invite code"
                    value={inviteToken}
                    onChange={(e) => {
                      setInviteToken(e.target.value);
                      if (e.target.value.length > 10) {
                        validateInviteToken(e.target.value);
                      }
                    }}
                    disabled={isSubmitting || isValidatingInvite}
                    data-testid="input-invite-token"
                  />
                  {isValidatingInvite && (
                    <p className="text-xs text-muted-foreground">Validating invite...</p>
                  )}
                  {inviteValidation && (
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Join <strong>{inviteValidation.companyName}</strong>
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep('profile')}
                    disabled={isSubmitting}
                    data-testid="button-back-to-profile-join"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleJoinCompany}
                    className="flex-1"
                    disabled={isSubmitting || !inviteToken || !inviteValidation}
                    data-testid="button-join-company"
                  >
                    {isSubmitting ? 'Joining...' : 'Join Team'}
                    <Users className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Ask your team admin for an invite link
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Escape hatch - always visible sign out option */}
        <div className="text-center pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground gap-2"
            data-testid="button-signout-onboarding"
          >
            <LogOut className="w-4 h-4" />
            Sign Out & Return to Login
          </Button>
        </div>
      </div>
    </div>
  );
}
