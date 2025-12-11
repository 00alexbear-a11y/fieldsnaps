import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

export default function CompanySetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast({
        title: "Company name required",
        description: "Please enter a name for your company",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      await apiRequest('POST', '/api/companies', { name: companyName });
      
      // Invalidate user query to refresh company data
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

      toast({
        title: "Company created!",
        description: `Welcome to ${companyName}`,
      });

      // Redirect to projects page
      setLocation('/projects');
    } catch (error: any) {
      // If user already has a company (e.g., from production DB sync), just redirect
      if (error.message?.includes('already belongs to a company')) {
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
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
      setIsCreating(false);
    }
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
            data-testid="img-company-setup-logo"
          />
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Create Your Company</h1>
            <p className="mt-2 text-muted-foreground">
              Set up your team workspace to get started
            </p>
          </div>
        </div>

        {/* Company Setup Form */}
        <Card className="p-6">
          <form onSubmit={handleCreateCompany} className="space-y-6">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-10 h-10 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                type="text"
                placeholder="Enter your company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isCreating}
                autoFocus
                data-testid="input-company-name"
              />
              <p className="text-xs text-muted-foreground">
                This will be visible to all team members and clients
              </p>
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full"
              disabled={isCreating || !companyName.trim()}
              data-testid="button-create-company"
            >
              {isCreating ? 'Creating...' : 'Create Company & Continue'}
            </Button>
          </form>
        </Card>

        {/* Info Card */}
        <Card className="p-4 bg-muted/50">
          <h3 className="font-semibold mb-2">What happens next?</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
              <span>You'll be the company owner with full access</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
              <span>You can invite team members from settings</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
              <span>Billing is $19.99 per user per month</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
