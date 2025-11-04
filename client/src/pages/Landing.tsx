import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, MapPin, Share2, Cloud, Smartphone, Edit3, ArrowRight, Heart, LogIn, CheckCircle2, X, Wifi, DollarSign, Clock, Search, Link as LinkIcon } from 'lucide-react';
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
  
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  
  const waitlistMutation = useMutation({
    mutationFn: async (data: { email: string; name?: string }) => {
      return apiRequest('/api/waitlist', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "You're on the list!",
        description: "We'll notify you when FieldSnaps launches.",
      });
      setWaitlistOpen(false);
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
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                How it Works
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

      {/* Hero Section - Pain-Driven */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-5xl mx-auto text-center space-y-10">
          <div className="space-y-6">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-tight">
              Stop Wasting 9 Hours a Week<br />
              Searching for Photos
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              FieldSnaps keeps your construction photos organized, backed up, and shareable—so you can focus on the job, not your camera roll.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="text-lg px-8 w-full sm:w-auto"
              onClick={() => setWaitlistOpen(true)}
              data-testid="button-join-waitlist-hero"
            >
              Join Waitlist
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-sm text-muted-foreground">
              7-day free trial • No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Before/After Problem Section */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">The Problem Every Contractor Faces</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              You take hundreds of job photos, but they end up scattered, lost, or impossible to find when you need them.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Before - The Old Way */}
            <Card className="p-8 space-y-6 border-destructive/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <X className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="text-2xl font-bold">The Old Way</h3>
              </div>
              <ul className="space-y-4 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <span>Job photos mixed with 1,000+ personal photos in your camera roll</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <span>Send 20 photos individually via text (60MB of cellular data wasted)</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <span>Scroll for 10 minutes trying to find that photo from 2 weeks ago</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <span>No backup—lose your phone, lose all your documentation</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <span>Client says "I never saw those photos" (no proof you sent them)</span>
                </li>
              </ul>
            </Card>

            {/* After - The FieldSnaps Way */}
            <Card className="p-8 space-y-6 border-primary">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">The FieldSnaps Way</h3>
              </div>
              <ul className="space-y-4 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>All job photos auto-organized by project (separate from personal pics)</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>Share 20+ photos with one link (zero data wasted, no downloads needed)</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>Find any photo in 3 seconds with search by project, date, or location</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>Automatic cloud backup—never lose a photo again</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>Shareable links with timestamp proof (clients can't say they didn't see it)</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Three Core Benefits */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">Three Things FieldSnaps Does Better</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We solved the exact problems contractors told us they face every single day.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Benefit 1: Never Lose a Photo */}
            <Card className="p-8 space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Cloud className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Never Lose a Photo</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Automatic cloud backup means your job photos are safe even if you drop your phone in concrete.
                </p>
              </div>
              <div className="pt-4 border-t border-border space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Auto-sync to cloud</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Unlimited storage</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Access anywhere</span>
                </div>
              </div>
            </Card>

            {/* Benefit 2: Find Anything Instantly */}
            <Card className="p-8 space-y-6 text-center border-primary">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Find Anything in 3 Seconds</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Smart organization by project, date, and location. No more scrolling through 1,000 photos.
                </p>
              </div>
              <div className="pt-4 border-t border-border space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Organized by project</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>GPS + timestamp</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Instant search</span>
                </div>
              </div>
            </Card>

            {/* Benefit 3: Share 20+ Photos with One Link */}
            <Card className="p-8 space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <LinkIcon className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">Share 20+ Photos with One Link</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Stop texting photos one by one. Send a single link—clients view all photos instantly.
                </p>
              </div>
              <div className="pt-4 border-t border-border space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>No app downloads</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>No login required</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Works on any device</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Link Sharing Spotlight */}
      <section className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-block px-3 py-1 bg-primary/10 rounded-full text-sm font-medium text-primary">
                  Game-Changing Feature
                </div>
                <h2 className="text-4xl font-bold leading-tight">
                  Send 20+ Photos Instantly<br />
                  <span className="text-muted-foreground">(No Data Wasted)</span>
                </h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                    <X className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Before</p>
                    <p className="text-muted-foreground">Download 20 photos (60MB) → Text each one individually → Client downloads all → Your data plan cries</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">After</p>
                    <p className="text-muted-foreground">One tap → Copy link → Send to client → They view all 20 photos in their browser → Zero downloads, zero data wasted</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wifi className="w-5 h-5 text-primary" />
                  <span>WiFi-only upload option saves your cellular data</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>Links include timestamp proof (dispute protection)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Share2 className="w-5 h-5 text-primary" />
                  <span>Share with anyone—no app or login required</span>
                </div>
              </div>
            </div>

            <Card className="p-8 bg-muted/50">
              <div className="space-y-6">
                <div className="aspect-video bg-background rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <div className="text-center space-y-2 p-6">
                    <LinkIcon className="w-12 h-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      fieldsnaps.com/share/abc123
                    </p>
                    <p className="text-xs text-muted-foreground">
                      View Demo →
                    </p>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    Client clicks link and sees all 20 photos instantly
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    No app download, no login, works on any device
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    You saved 60MB of cellular data (and 15 minutes)
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">Contractors Love FieldSnaps</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built by contractors, for contractors. Here's what early users are saying.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 space-y-4">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <CheckCircle2 key={i} className="w-5 h-5 text-primary" />
                ))}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                "I used to text clients 30+ photos individually. Now I just send a link. Total game changer for my workflow."
              </p>
              <div>
                <p className="font-semibold">Mike T.</p>
                <p className="text-sm text-muted-foreground">General Contractor</p>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <CheckCircle2 key={i} className="w-5 h-5 text-primary" />
                ))}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                "Finally, my job photos aren't mixed with 1,000 personal pics. Finding what I need takes seconds now instead of minutes."
              </p>
              <div>
                <p className="font-semibold">Sarah K.</p>
                <p className="text-sm text-muted-foreground">Project Manager</p>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <CheckCircle2 key={i} className="w-5 h-5 text-primary" />
                ))}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                "The WiFi-only upload saved my data plan. And the timestamp proof has already helped me settle a dispute with a client."
              </p>
              <div>
                <p className="font-semibold">David R.</p>
                <p className="text-sm text-muted-foreground">Renovation Specialist</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Data Saving + Revenue Protection */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Data Saving */}
            <Card className="p-8 space-y-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wifi className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Save Your Cellular Data</h3>
              <p className="text-muted-foreground leading-relaxed">
                Job sites have spotty service. FieldSnaps uploads photos only when you're on WiFi—saving your data plan from getting crushed.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>WiFi-only upload mode (turn it on in settings)</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>Photos queue automatically, upload when you're back at the office</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>Smart compression reduces file sizes by 70% without losing quality</span>
                </li>
              </ul>
            </Card>

            {/* Revenue Protection */}
            <Card className="p-8 space-y-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Protect Your Revenue</h3>
              <p className="text-muted-foreground leading-relaxed">
                Work not documented is work not billed. FieldSnaps' timestamp and GPS proof protects you from disputes and payment delays.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>Every photo has automatic timestamp + GPS location</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>Shareable links prove you sent photos (and when)</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>Defend against "I never saw that" or "That wasn't done yet" claims</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid - Tightened */}
      <section id="how-it-works" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-bold">Everything You Need, Nothing You Don't</h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              Every feature exists because it solves a real problem we faced on job sites.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6 space-y-3">
              <Camera className="w-8 h-8 text-primary" />
              <h3 className="text-lg font-semibold">Smart Organization</h3>
              <p className="text-sm text-muted-foreground">
                Auto-organize by project. Find any photo in seconds. Never dig through camera roll chaos again.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <Edit3 className="w-8 h-8 text-primary" />
              <h3 className="text-lg font-semibold">Powerful Annotations</h3>
              <p className="text-sm text-muted-foreground">
                Mark issues with arrows, text, shapes, and pen. Show clients exactly what needs fixing.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <Share2 className="w-8 h-8 text-primary" />
              <h3 className="text-lg font-semibold">Instant Link Sharing</h3>
              <p className="text-sm text-muted-foreground">
                Generate shareable links in one click. No app downloads, no logins, works everywhere.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <MapPin className="w-8 h-8 text-primary" />
              <h3 className="text-lg font-semibold">GPS + Timestamps</h3>
              <p className="text-sm text-muted-foreground">
                Automatic location and time data. Proof of when and where photos were taken.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <Cloud className="w-8 h-8 text-primary" />
              <h3 className="text-lg font-semibold">Secure Cloud Backup</h3>
              <p className="text-sm text-muted-foreground">
                Never lose a photo. Automatic backup with unlimited storage. Access from anywhere.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <Smartphone className="w-8 h-8 text-primary" />
              <h3 className="text-lg font-semibold">Works Everywhere</h3>
              <p className="text-sm text-muted-foreground">
                iOS, Android, and web. Take photos on site, organize at the office, share from home.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-background">
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
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Unlimited Projects</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Unlimited Photos & Videos</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Unlimited Users (1 or 100, same price)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Advanced Annotations</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Secure Cloud Storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Client Sharing Links</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Time & GPS Stamps</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Priority Support</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>20% Supports Missionaries Worldwide</span>
                </li>
              </ul>
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => setWaitlistOpen(true)}
                data-testid="button-join-waitlist-pricing"
              >
                Join Waitlist
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
      <section className="py-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-4xl font-bold">Stop Wasting Time. Start Documenting Like a Pro.</h2>
          <p className="text-lg text-muted-foreground">
            Join the waitlist and be the first to know when FieldSnaps launches.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8"
            onClick={() => setWaitlistOpen(true)}
            data-testid="button-join-waitlist-final"
          >
            Join Waitlist
            <ArrowRight className="w-5 h-5 ml-2" />
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
              <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
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

      {/* Waitlist Dialog */}
      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join the Waitlist</DialogTitle>
            <DialogDescription>
              Be the first to know when FieldSnaps launches. We'll send you an email when we're ready!
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleWaitlistSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waitlist-email">Email</Label>
              <Input
                id="waitlist-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-waitlist-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waitlist-name">Name (optional)</Label>
              <Input
                id="waitlist-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-waitlist-name"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={waitlistMutation.isPending}
              data-testid="button-submit-waitlist"
            >
              {waitlistMutation.isPending ? 'Joining...' : 'Join Waitlist'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
