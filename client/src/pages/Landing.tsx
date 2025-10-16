import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, MapPin, Share2, Cloud, Smartphone, Edit3, ArrowRight, Heart } from 'lucide-react';
import { useLocation } from 'wouter';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

export default function Landing() {
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
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="#impact" className="text-muted-foreground hover:text-foreground transition-colors" onClick={(e) => { e.preventDefault(); setLocation('/impact'); }}>
                Impact
              </a>
              <Button 
                variant="ghost" 
                onClick={() => setLocation('/login')}
                data-testid="button-signin-header"
              >
                Sign In
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto space-y-8">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              Document Every Detail.<br />Win Every Dispute.
            </h1>
            <p className="text-xl text-muted-foreground">
              Professional photo documentation for contractors, inspectors, and field service teams. 
              $19.99/month. No gimmicks.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="text-lg px-8"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-start-trial-hero"
              >
                Start Free 7-Day Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-sm text-muted-foreground">
                Trial starts when you create your first project
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
            <p className="text-muted-foreground text-lg">
              Built for professionals who need reliable documentation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Edit3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Photo Annotations</h3>
              <p className="text-muted-foreground">
                Add arrows, text, shapes, and pen marks to highlight issues and details
              </p>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Project Organization</h3>
              <p className="text-muted-foreground">
                Keep photos organized by project with automatic timestamping and tagging
              </p>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Share2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Easy Sharing</h3>
              <p className="text-muted-foreground">
                Generate secure share links for clients - no account required for viewing
              </p>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Cloud className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Cloud Storage with CDN</h3>
              <p className="text-muted-foreground">
                Secure, unlimited storage with fast global delivery for instant access
              </p>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Mobile-Friendly</h3>
              <p className="text-muted-foreground">
                Works perfectly on any device - phone, tablet, or desktop
              </p>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Map View</h3>
              <p className="text-muted-foreground">
                See all your projects on an interactive map with automatic geocoding
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, Honest Pricing</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Trial */}
            <Card className="p-8 space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Free Trial</h3>
                <div className="text-muted-foreground space-y-1">
                  <p>7 Days • Full Access • No Credit Card</p>
                  <p className="text-sm">Trial starts when you create your first project</p>
                </div>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>All Pro features included</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>No payment required</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Cancel anytime</span>
                </li>
              </ul>
            </Card>

            {/* Pro Plan */}
            <Card className="p-8 space-y-6 border-primary">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">FieldSnaps Pro</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">$19.99</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Unlimited Projects</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Unlimited Photos & Videos</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Advanced Annotations</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Secure Cloud Storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Client Sharing Links</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Priority Support</span>
                </li>
              </ul>
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-start-trial-pricing"
              >
                Start Free Trial
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section id="impact" className="py-24 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Business as a Force for Good</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            20% of FieldSnaps profits support missionaries serving overseas. 
            When you choose FieldSnaps, you're not just getting great software - 
            you're making a global impact.
          </p>
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => setLocation('/impact')}
            data-testid="button-see-impact"
          >
            See the Impact
            <ArrowRight className="w-4 h-4 ml-2" />
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
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
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
