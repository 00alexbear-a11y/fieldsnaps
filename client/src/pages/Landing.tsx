import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Camera, 
  MapPin, 
  Share2, 
  Cloud, 
  Search, 
  Link as LinkIcon,
  Folder,
  CheckCircle2, 
  X, 
  LogIn,
  ChevronDown,
  Users
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { isDevModeEnabled } from '@/config/devMode';

export default function Landing() {
  const [, setLocation] = useLocation();
  const isDevelopment = isDevModeEnabled();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  
  const waitlistMutation = useMutation({
    mutationFn: async (data: { email: string; name?: string }) => {
      // Use fetch directly since this is a public endpoint (no auth needed)
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to join waitlist');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "You're on the list!",
        description: "Check your email for confirmation.",
      });
      setEmail('');
      setName('');
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: "Please try again later.",
      });
    },
  });
  
  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    waitlistMutation.mutate({ email, name: name || undefined });
  };

  const faqs = [
    {
      q: "When does FieldSnaps launch?",
      a: "We're launching January 2026. Waitlist members get first access and 90 days free."
    },
    {
      q: "Which devices will it work on?",
      a: "iOS (iPhone), Android, and web. Take photos on your phone, organize from anywhere."
    },
    {
      q: "What happens to my photos if I cancel?",
      a: "You can export all photos anytime. Your photos, your data—we never lock you in."
    },
    {
      q: "Do my clients need to download an app?",
      a: "Nope. They click your link and view photos in their browser. Works on any device."
    },
    {
      q: "How much storage do I get?",
      a: "Unlimited. Upload as many photos and videos as you need."
    },
    {
      q: "Can I use this with my team?",
      a: "Yes. Add unlimited users for $19.99 each per month. No minimums, no team caps."
    },
    {
      q: "How is this different from Google Photos?",
      a: "FieldSnaps is built specifically for job documentation—auto-organize by project, timestamp proof, team sharing, and no personal photos mixed in."
    },
    {
      q: "What if I have bad cell service on site?",
      a: "Works offline. Take photos on site, they automatically sync when you're back on WiFi."
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-50">
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
            <nav className="hidden md:flex items-center gap-6">
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-how-it-works">
                How it Works
              </a>
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">
                Features
              </a>
              <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-faq">
                FAQ
              </a>
              {isDevelopment && (
                <Button 
                  variant="default"
                  className="bg-orange-600"
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
      <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Coming Soon Badge */}
          <div className="text-center mb-6">
            <span className="inline-block px-4 py-1.5 bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium tracking-wide uppercase">
              Coming Soon
            </span>
          </div>

          {/* Headline */}
          <div className="text-center space-y-6 mb-12">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]">
              Organize job photos.<br />
              Separate work from home.
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Keep construction documentation out of your camera roll—where it belongs.
            </p>
            <p className="text-lg text-muted-foreground">
              Launching January 2026
            </p>
          </div>

          {/* Email Capture Form */}
          <form onSubmit={handleWaitlistSubmit} className="max-w-2xl mx-auto mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-base flex-1"
                required
                data-testid="input-email-hero"
              />
              <Button 
                type="submit"
                size="lg"
                className="bg-orange-600 hover-elevate whitespace-nowrap"
                disabled={waitlistMutation.isPending}
                data-testid="button-join-waitlist-hero"
              >
                {waitlistMutation.isPending ? 'Joining...' : 'Join the Waitlist'}
              </Button>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground mb-16">
            Join 500+ contractors already waiting
          </p>

          {/* Hero Image Placeholder */}
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-border">
            <div className="aspect-video bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
              <div className="text-center space-y-3 p-8">
                <Camera className="w-16 h-16 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground max-w-md">
                  Split-screen comparison: chaotic camera roll vs organized FieldSnaps interface
                </p>
                <p className="text-xs text-muted-foreground italic">
                  [Hero image placeholder - add your split-screen comparison here]
                </p>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Free for the first 90 days</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>iOS & Android</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>No credit card required</span>
            </div>
          </div>
        </div>
      </section>

      {/* Old Way vs New Way Comparison */}
      <section className="py-24 bg-muted/30 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-semibold mb-4">
              The old way vs. the FieldSnaps way
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Before */}
            <Card className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <X className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="text-2xl font-bold">Before FieldSnaps</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• Job photos buried in 1,000+ personal pics</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• Texting photos one by one wastes data</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• Can't find that photo from two weeks ago</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• No backup if you lose your phone</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• No proof you sent photos to clients</span>
                </li>
              </ul>
            </Card>

            {/* After */}
            <Card className="p-8 space-y-6 border-2 border-primary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">With FieldSnaps</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• All job photos auto-organized by project</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• Share 20+ photos with one link</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• Find any photo in 3 seconds with search</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• Automatic cloud backup</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <span className="text-lg leading-relaxed">• Shareable links with timestamp proof</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-semibold">
              Three steps. Zero hassle.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              FieldSnaps works the way you already work—just better.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
            {/* Step 1 */}
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 text-4xl font-bold mb-4">
                1
              </div>
              <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Take photos on site</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Use your phone's camera like normal. FieldSnaps runs in the background.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 text-4xl font-bold mb-4">
                2
              </div>
              <Folder className="w-12 h-12 mx-auto text-muted-foreground" />
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Auto-organizes by project</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Photos automatically sort into project folders. No manual filing required.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 text-4xl font-bold mb-4">
                3
              </div>
              <LinkIcon className="w-12 h-12 mx-auto text-muted-foreground" />
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Share with one link</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Send clients or team members a link. They view photos instantly—no app needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Grid */}
      <section id="features" className="py-24 bg-muted/30 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-semibold">
              Built for contractors, by contractors
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Folder className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Smart Organization</h3>
              <p className="text-muted-foreground leading-relaxed">
                Auto-organize by project, date, location. Never dig through camera roll chaos again.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Instant Search</h3>
              <p className="text-muted-foreground leading-relaxed">
                Find photos in seconds, not minutes. Search by project name, date, or what's in the photo.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <LinkIcon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">One-Link Sharing</h3>
              <p className="text-muted-foreground leading-relaxed">
                Stop texting photos individually. Share 20+ photos with one link—no app required.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Cloud className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Cloud Backup</h3>
              <p className="text-muted-foreground leading-relaxed">
                Never lose photos if you lose your phone. Everything backed up automatically to the cloud.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Works Offline</h3>
              <p className="text-muted-foreground leading-relaxed">
                Take photos on site with spotty service. Upload later on WiFi to save your data plan.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Team Access</h3>
              <p className="text-muted-foreground leading-relaxed">
                Share projects with crew or subcontractors. Everyone stays on the same page.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-semibold">
              Questions? We've got answers.
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover-elevate"
                  data-testid={`button-faq-${index}`}
                >
                  <span className="font-semibold text-lg pr-4">{faq.q}</span>
                  <ChevronDown 
                    className={`w-5 h-5 shrink-0 transition-transform ${
                      expandedFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-5 text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-[#1d1d1f] text-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-6">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
              Stop losing photos.<br />
              Start documenting like a pro.
            </h2>
            <p className="text-xl text-gray-400">
              Join the waitlist and get 90 days free when we launch.
            </p>
          </div>

          {/* Email Form */}
          <form onSubmit={handleWaitlistSubmit} className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-base flex-1 bg-white text-black"
                required
                data-testid="input-email-footer"
              />
              <Button 
                type="submit"
                size="lg"
                className="bg-orange-600 hover-elevate whitespace-nowrap"
                disabled={waitlistMutation.isPending}
                data-testid="button-join-waitlist-footer"
              >
                {waitlistMutation.isPending ? 'Joining...' : 'Join the Waitlist'}
              </Button>
            </div>
          </form>

          <p className="text-sm text-gray-500">
            No spam. Just one email when we launch. Unsubscribe anytime.
          </p>

          <p className="text-base text-gray-400">
            Join 500+ contractors already on the waitlist
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0d0d0d] text-gray-400 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center space-y-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img 
              src={logoPath} 
              alt="FieldSnaps" 
              className="h-8 w-auto object-contain opacity-80"
            />
            <span className="text-xl font-semibold text-white">FieldSnaps</span>
          </div>
          <p className="text-sm max-w-md mx-auto">
            Built for contractors who need their photos organized—not buried.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm">
            <a href="/privacy" className="hover:text-white transition-colors" data-testid="link-privacy">Privacy</a>
            <span className="text-gray-600">|</span>
            <a href="/terms" className="hover:text-white transition-colors" data-testid="link-terms">Terms</a>
            <span className="text-gray-600">|</span>
            <a href="mailto:hello@fieldsnaps.com" className="hover:text-white transition-colors" data-testid="link-email">
              hello@fieldsnaps.com
            </a>
          </div>
          <p className="text-xs text-gray-600">
            © 2025 FieldSnaps. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
