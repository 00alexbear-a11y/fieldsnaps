import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, MapPin, Share2, Cloud, Smartphone, Edit3, ArrowRight, Heart, LogIn } from 'lucide-react';
import { useLocation } from 'wouter';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { isDevModeEnabled } from '@/config/devMode';

export default function Landing() {
  const [, setLocation] = useLocation();
  const isDevelopment = isDevModeEnabled();

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
            <nav className="hidden md:flex items-center gap-4">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="#impact" className="text-muted-foreground hover:text-foreground transition-colors" onClick={(e) => { e.preventDefault(); setLocation('/impact'); }}>
                Impact
              </a>
              {isDevelopment && (
                <Button 
                  variant="default"
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => window.location.href = '/api/dev-login'}
                  data-testid="button-dev-login-header"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Dev Login
                </Button>
              )}
              <Button 
                variant={isDevelopment ? "outline" : "ghost"}
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
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-tight">
            Organize job photos.<br />
            Separate work from home.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            For contractors, project managers, and property owners who need construction documentation they can actually find.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-start-trial-hero"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-bold">PROFESSIONAL FEATURES THAT MATTER</h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              Every feature in FieldSnaps exists because it solves a real problem I faced on job sites. No bloat. Just what works.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Smart Organization</h3>
              <p className="text-muted-foreground mb-3">
                Group photos by project, job site, or client. Find any photo in seconds.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Unlimited projects</li>
                <li>• Unlimited photos</li>
                <li>• Easy search</li>
              </ul>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Edit3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Powerful Annotations</h3>
              <p className="text-muted-foreground mb-3">
                Mark issues with arrows, circles, text, and pen. Show clients exactly what needs attention.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Arrows</li>
                <li>• Text labels</li>
                <li>• Shapes</li>
                <li>• Freehand pen</li>
              </ul>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Share2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Instant Sharing</h3>
              <p className="text-muted-foreground mb-3">
                Generate shareable links in one click. Clients view photos without downloading apps or logging in.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Secure links</li>
                <li>• No login required</li>
                <li>• Works on any device</li>
              </ul>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Time & GPS Stamps</h3>
              <p className="text-muted-foreground mb-3">
                Automatic timestamps and location data. Proof of when and where photos were taken.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Timestamped</li>
                <li>• GPS tagged</li>
                <li>• Dispute protection</li>
              </ul>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Cloud className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Secure Cloud Storage</h3>
              <p className="text-muted-foreground mb-3">
                Never lose a photo. Automatic backup with fast CDN delivery. Access from anywhere.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Automatic backup</li>
                <li>• CDN delivery</li>
                <li>• Unlimited storage</li>
              </ul>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Works Everywhere</h3>
              <p className="text-muted-foreground mb-3">
                iOS, Android, and web. Take photos on site, organize them in the office, share from home.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Mobile apps</li>
                <li>• Web dashboard</li>
                <li>• Sync across devices</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl font-bold">SIMPLE, HONEST PRICING</h2>
            <p className="text-lg text-muted-foreground">
              No per-user fees. No forced minimums. No complicated tiers. Just one price.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Trial */}
            <Card className="p-8 space-y-6">
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">FREE 7-DAY TRIAL</h3>
                <p className="text-muted-foreground">Full Access • No Credit Card</p>
              </div>
              <p className="text-muted-foreground">
                Your trial starts when you create your first project - not at signup. 
                We only count days you're actually using it.
              </p>
            </Card>

            {/* Pro Plan */}
            <Card className="p-8 space-y-6 border-primary">
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-muted-foreground">THEN UPGRADE TO FIELDSNAPS PRO</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">$19.99</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Unlimited Projects</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Unlimited Photos & Videos</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Unlimited Users (1 or 100, same price)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Advanced Annotations</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Secure Cloud Storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Client Sharing Links</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Time & GPS Stamps</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Priority Support</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span>
                  <span>20% Supports Missionaries Worldwide</span>
                </li>
              </ul>
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-start-trial-pricing"
              >
                Start Free 7-Day Trial
              </Button>
              <p className="text-center text-sm text-muted-foreground pt-2">
                Your team grows. Your bill doesn't.
              </p>
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
          <h2 className="text-3xl font-bold">BUSINESS AS A FORCE FOR GOOD</h2>
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

      {/* Final CTA Section */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-4xl font-bold">READY TO DOCUMENT LIKE A PRO?</h2>
          <p className="text-lg text-muted-foreground">
            Start your free 7-day trial. No credit card required. 
            Your trial begins when you create your first project.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-start-trial-final"
          >
            Start Free Trial
          </Button>
          <p className="text-sm text-muted-foreground">
            Questions? Email hello@fieldsnaps.com
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <div className="flex items-center gap-3 justify-center">
                <img 
                  src={logoPath} 
                  alt="FieldSnaps" 
                  className="h-8 w-auto object-contain"
                />
                <span className="text-xl font-semibold">FIELDSNAPS</span>
              </div>
              <p className="text-muted-foreground">
                Professional photo documentation for contractors. Built by contractors.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <span>•</span>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <span>•</span>
              <a href="/impact" className="hover:text-foreground transition-colors">Impact</a>
              <span>•</span>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
              <span>•</span>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <span>•</span>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                © 2025 FieldSnaps • Made with purpose
              </p>
              <p className="text-sm text-muted-foreground">
                Social: <a href="https://instagram.com/getfieldsnaps" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Instagram @getfieldsnaps</a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
