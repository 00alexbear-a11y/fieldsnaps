import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Mail } from 'lucide-react';
import { useLocation } from 'wouter';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

export default function Waitlist() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
      <Card className="max-w-md w-full p-8 space-y-6 text-center">
        <div className="flex justify-center">
          <img 
            src={logoPath} 
            alt="FieldSnaps" 
            className="h-12 w-auto object-contain"
          />
        </div>
        
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">You're on the Waitlist!</h1>
          <p className="text-muted-foreground">
            Thanks for your interest in FieldSnaps. We're putting the finishing touches on the platform.
          </p>
        </div>

        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>We'll notify you by email when we launch</span>
          </div>
        </div>

        <div className="pt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Questions? Email{' '}
            <a 
              href="mailto:hello@fieldsnaps.com" 
              className="text-primary hover:underline"
            >
              hello@fieldsnaps.com
            </a>
          </p>
          <Button 
            variant="outline" 
            onClick={() => setLocation('/')}
            className="w-full"
            data-testid="button-back-home"
          >
            Back to Home
          </Button>
        </div>
      </Card>
    </div>
  );
}
