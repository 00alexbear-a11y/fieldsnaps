import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, ArrowLeft, Globe, Users, DollarSign } from 'lucide-react';
import { useLocation } from 'wouter';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

export default function Impact() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img 
                src={logoPath} 
                alt="FieldSnaps" 
                className="h-8 w-auto object-contain"
              />
              <span className="text-xl font-semibold">FieldSnaps</span>
            </div>
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/')}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Heart className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Your Subscription Makes a Global Impact
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            20% of every FieldSnaps subscription directly supports missionaries serving in some of 
            the hardest-to-reach places on earth. When you use FieldSnaps, you're not just running 
            your business better - you're changing lives around the world.
          </p>
        </div>
      </section>

      {/* The Commitment */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Why We Give</h2>
          </div>
          <Card className="p-8">
            <p className="text-lg text-muted-foreground leading-relaxed">
              We believe business should be about more than profit. Every subscription to FieldSnaps 
              contributes 20% toward supporting missionaries who are bringing hope, education, and 
              practical help to communities around the world. This isn't a marketing gimmick - it's our mission.
            </p>
          </Card>

          {/* Impact Stats Placeholders */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Card className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold">Coming Soon</div>
                <p className="text-sm text-muted-foreground">Missionaries Supported</p>
              </div>
            </Card>

            <Card className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold">Coming Soon</div>
                <p className="text-sm text-muted-foreground">Countries Reached</p>
              </div>
            </Card>

            <Card className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold">Coming Soon</div>
                <p className="text-sm text-muted-foreground">Given This Year</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Stories Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Stories of Impact</h2>
            <p className="text-xl text-muted-foreground">Coming Soon</p>
          </div>

          <Card className="p-8 text-center space-y-4">
            <p className="text-lg text-muted-foreground leading-relaxed">
              As we support missionaries through FieldSnaps, we'll share their stories here. 
              Check back soon to see the difference your subscription is making.
            </p>
          </Card>

          {/* Placeholder for future stories */}
          <div className="space-y-6 opacity-50">
            <Card className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                  <Heart className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-3">
                  <h3 className="text-xl font-semibold">Story Title</h3>
                  <p className="text-muted-foreground">
                    Missionary stories will appear here once we begin supporting field workers. 
                    Each story will highlight the work being done and how FieldSnaps contributions 
                    are making a difference.
                  </p>
                  <p className="text-sm text-muted-foreground">Location • Ministry Focus</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                  <Heart className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-3">
                  <h3 className="text-xl font-semibold">Story Title</h3>
                  <p className="text-muted-foreground">
                    Missionary stories will appear here once we begin supporting field workers. 
                    Each story will highlight the work being done and how FieldSnaps contributions 
                    are making a difference.
                  </p>
                  <p className="text-sm text-muted-foreground">Location • Ministry Focus</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl font-bold">Join Us in Making a Difference</h2>
          <p className="text-lg text-muted-foreground">
            Start your free trial today and become part of something bigger than just great software.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-start-trial-impact"
          >
            Start Free 7-Day Trial
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img 
                  src={logoPath} 
                  alt="FieldSnaps" 
                  className="h-6 w-auto object-contain"
                />
                <span className="font-semibold">FieldSnaps</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Professional photo documentation for field services
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/impact" className="hover:text-foreground transition-colors">Impact</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © 2025 FieldSnaps. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
