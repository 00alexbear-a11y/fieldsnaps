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
  Users,
  Clock,
  Timer,
  FileText,
  Navigation,
  Bell,
  CheckSquare
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import mixedPhotosPath from '@assets/camera-roll-mixed-photos.png';
import organizedPhotosPath from '@assets/IMG_3762_1762447489193.png';
import { isDevModeEnabled } from '@/config/devMode';

export default function Landing() {
  const [, setLocation] = useLocation();
  const isDevelopment = isDevModeEnabled();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  
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
      a: "We're launching January 2026. Waitlist members get first access and 30 days free."
    },
    {
      q: "Which devices will it work on?",
      a: "iOS (iPhone), Android, and web. Take photos on your phone, organize from anywhere."
    },
    {
      q: "How does automatic time tracking work?",
      a: "When you add a job site address, FieldSnaps creates a 500ft geofence around it. When your phone enters that zone, you're clocked in. When you leave, you're clocked out. No buttons to press."
    },
    {
      q: "What about privacy with location tracking?",
      a: "You're in control. You can pause automatic tracking anytime, and we only track when you're near job sites—not everywhere you go. Your location data is private and never shared."
    },
    {
      q: "Can I export timecards for payroll?",
      a: "Yes. Export weekly timesheets as PDF or CSV with GPS coordinates, entry method, and travel time breakdown. Perfect for payroll or client billing."
    },
    {
      q: "Does travel time between jobs get tracked?",
      a: "Automatically. FieldSnaps calculates drive time between job sites so you can bill clients accurately for travel."
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
      a: "Yes. It's $19.99 per user per month with no minimum. Add as many team members as you need."
    },
    {
      q: "How is this different from Google Photos?",
      a: "FieldSnaps is built specifically for job documentation—auto-organize by project, timestamp proof, automatic time tracking, and no personal photos mixed in."
    },
    {
      q: "What if I have bad cell service on site?",
      a: "Works offline. Take photos on site, they automatically sync when you're back on WiFi. Time tracking works offline too."
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-50 pt-safe-3 pb-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[44px]">
            <img 
              src={logoPath} 
              alt="FieldSnaps" 
              className="h-8 w-auto object-contain"
            />
            <nav className="flex items-center gap-2 md:gap-6">
              <a href="#features" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline" data-testid="link-features">
                Features
              </a>
              <a href="#how-it-works" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline" data-testid="link-how-it-works">
                How It Works
              </a>
              <a href="#pricing" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline" data-testid="link-pricing">
                Pricing
              </a>
              <a href="#founder-story" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline" data-testid="link-why-price">
                Why $19.99?
              </a>
              {isDevelopment && (
                <Button 
                  size="sm"
                  className="bg-sky-500 text-xs md:text-sm"
                  onClick={() => window.location.href = '/api/dev-login'}
                  data-testid="button-dev-login-header"
                >
                  <LogIn className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Dev Login</span>
                  <span className="sm:hidden">Dev</span>
                </Button>
              )}
              <Button 
                size="sm"
                variant={isDevelopment ? "outline" : "ghost"}
                className="text-xs md:text-sm"
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
            <span className="inline-block px-4 py-1.5 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-full text-sm font-medium tracking-wide uppercase">
              Coming Soon
            </span>
          </div>

          {/* Headline */}
          <div className="text-center space-y-6 mb-12">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]">
              Organize job photos.<br />
              Track time automatically.
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Photo documentation + automatic time tracking in one app. Never forget to clock in again.
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
                className="bg-sky-500 hover-elevate whitespace-nowrap"
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
        </div>

        {/* Before/After Split Screen Comparison - Full Width on Mobile */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
            {/* Before - Camera Roll Chaos */}
            <div className="space-y-4 min-w-0">
              <div className="text-center">
                <span className="inline-block px-3 py-1 bg-destructive/10 text-destructive text-sm font-medium rounded-full mb-3">
                  Before FieldSnaps
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-xl w-full h-[550px] flex items-center justify-center bg-muted/20">
                <img 
                  src={mixedPhotosPath} 
                  alt="Before FieldSnaps - job photos mixed with personal photos in camera roll" 
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Job photos buried with 1,000+ personal pics
              </p>
            </div>

            {/* After - FieldSnaps Organized */}
            <div className="space-y-4 min-w-0">
              <div className="text-center">
                <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full mb-3">
                  With FieldSnaps
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-xl w-full h-[550px] flex items-center justify-center bg-muted/20">
                <img 
                  src={organizedPhotosPath} 
                  alt="With FieldSnaps - all job photos organized by project" 
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Every project organized, instantly accessible
              </p>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Free for the first 30 days</span>
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
                  <span className="text-lg leading-relaxed">• Find photos in seconds</span>
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
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 text-4xl font-bold mb-4">
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
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 text-4xl font-bold mb-4">
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
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 text-4xl font-bold mb-4">
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-center">
              Built for contractors, by contractors
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Folder className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Smart Organization</h3>
              <p className="text-muted-foreground leading-relaxed">
                Auto-organize by project, date, location. Never dig through camera roll chaos again.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Instant Search</h3>
              <p className="text-muted-foreground leading-relaxed">
                Find photos in seconds, not minutes. Every photo organized by project and date.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <LinkIcon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">One-Link Sharing</h3>
              <p className="text-muted-foreground leading-relaxed">
                Stop texting photos individually. Share 20+ photos with one link—no app required.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Cloud className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Cloud Backup</h3>
              <p className="text-muted-foreground leading-relaxed">
                Never lose photos if you lose your phone. Everything backed up automatically to the cloud.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Works Offline</h3>
              <p className="text-muted-foreground leading-relaxed">
                Take photos on site with spotty service. Upload later on WiFi to save your data plan.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Team Access</h3>
              <p className="text-muted-foreground leading-relaxed">
                Share projects with crew or subcontractors. Everyone stays on the same page.
              </p>
            </div>

            {/* Feature 7 - Auto Clock-In */}
            <div className="space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-sky-500" />
              </div>
              <h3 className="text-xl font-bold">Auto Clock-In</h3>
              <p className="text-muted-foreground leading-relaxed">
                Arrive at a job site? You're clocked in. Leave? Clocked out. Zero effort required.
              </p>
            </div>

            {/* Feature 8 - Travel Time */}
            <div className="space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center">
                <Navigation className="w-6 h-6 text-sky-500" />
              </div>
              <h3 className="text-xl font-bold">Travel Time Tracking</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automatically calculates drive time between jobs. Bill clients accurately for travel.
              </p>
            </div>

            {/* Feature 9 - Timecard Export */}
            <div className="space-y-4 text-center sm:text-left flex flex-col items-center sm:items-start">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-sky-500" />
              </div>
              <h3 className="text-xl font-bold">Timecard Export</h3>
              <p className="text-muted-foreground leading-relaxed">
                Weekly PDF or CSV timesheets with GPS proof. Ready for payroll or client billing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Automatic Time Tracking Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <span className="inline-block px-4 py-1.5 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-full text-sm font-medium tracking-wide uppercase">
              New Feature
            </span>
            <h2 className="text-4xl sm:text-5xl font-semibold">
              Never forget to clock in again
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Automatic time tracking that works in the background. Just drive to the job and start working.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            {/* Auto Clock-In Card */}
            <Card className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mx-auto">
                <MapPin className="w-8 h-8 text-sky-500" />
              </div>
              <h3 className="text-xl font-bold">Geofence Each Job</h3>
              <p className="text-muted-foreground">
                Set a 500ft radius around each job site. When you arrive, your phone knows.
              </p>
            </Card>

            {/* Notification Card */}
            <Card className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mx-auto">
                <Bell className="w-8 h-8 text-sky-500" />
              </div>
              <h3 className="text-xl font-bold">Smart Notifications</h3>
              <p className="text-muted-foreground">
                Get a tap to confirm clock-in when you arrive. Or set it to fully automatic.
              </p>
            </Card>

            {/* GPS Proof Card */}
            <Card className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-sky-500" />
              </div>
              <h3 className="text-xl font-bold">GPS-Verified Records</h3>
              <p className="text-muted-foreground">
                Every clock-in/out is timestamped with GPS coordinates. Proof that stands up.
              </p>
            </Card>
          </div>

          {/* How It Works Steps */}
          <div className="bg-muted/30 rounded-2xl p-8 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-8">How automatic time tracking works</h3>
            <div className="grid sm:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center mx-auto mb-3">1</div>
                <p className="text-sm text-muted-foreground">Add your job sites with addresses</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center mx-auto mb-3">2</div>
                <p className="text-sm text-muted-foreground">FieldSnaps creates a 500ft geofence automatically</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center mx-auto mb-3">3</div>
                <p className="text-sm text-muted-foreground">Drive to the job—you're clocked in</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center mx-auto mb-3">4</div>
                <p className="text-sm text-muted-foreground">Leave the job—you're clocked out</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Story Section */}
      <section id="founder-story" className="py-24 bg-muted/30 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-semibold mb-6">
              Why I built FieldSnaps
            </h2>
          </div>
          
          <div className="prose prose-lg mx-auto text-muted-foreground leading-relaxed space-y-6 text-center md:text-left">
            <p className="text-lg sm:text-xl leading-relaxed">
              I'm a general contractor. A few years ago, my camera roll was a disaster—
              hundreds of job photos mixed with family pictures, impossible to find 
              anything when clients asked for updates.
            </p>
            
            <p className="text-lg sm:text-xl leading-relaxed">
              I looked at photo management apps. Every one wanted $1,200+ per year, 
              forced me to buy licenses for 3+ users, and came loaded with features 
              I'd never touch.
            </p>
            
            <p className="text-lg sm:text-xl leading-relaxed">
              I just wanted to organize my job photos and share them with clients. 
              That's it.
            </p>
            
            <p className="text-lg sm:text-xl leading-relaxed">
              So I built FieldSnaps. $19.99 per user. No minimums. No BS.
            </p>
            
            <p className="text-lg sm:text-xl leading-relaxed">
              If you only need one license, you pay for one. If you need 10, you pay 
              for 10. No forced bundles. No enterprise sales calls.
            </p>
            
            <p className="text-lg sm:text-xl leading-relaxed">
              Just a tool that does exactly what contractors need—at a price that 
              actually makes sense.
            </p>
            
            <div className="mt-12 text-center">
              <p className="text-xl font-semibold text-foreground">
                — Founder, FieldSnaps
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-muted/30 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-4">
            <p className="text-sm font-medium uppercase tracking-wide text-primary mb-3">
              NO MINIMUMS. NO BS.
            </p>
            <h2 className="text-4xl sm:text-5xl font-semibold mb-4">
              Pricing that makes sense
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Others charge $1,200/year with 3-user minimums. We don't.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="max-w-4xl mx-auto my-16">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-4 px-6 text-lg font-semibold">Typical Photo Apps</th>
                    <th className="text-left py-4 px-6 text-lg font-semibold text-primary">FieldSnaps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-4 px-6 text-muted-foreground">$30-50 per user/month</td>
                    <td className="py-4 px-6 font-semibold text-primary">$19.99 per user/month</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 text-muted-foreground">3-user minimum required</td>
                    <td className="py-4 px-6 font-semibold text-primary">No user minimum</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 text-muted-foreground">= $1,200+/year minimum</td>
                    <td className="py-4 px-6 font-semibold text-primary">= $240/year for 1 user</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 text-muted-foreground">Bloated features you never use</td>
                    <td className="py-4 px-6 font-semibold text-primary">Just what contractors actually need</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Card */}
          <div className="max-w-lg mx-auto">
            <Card className="p-8 border-2 border-primary">
              <div className="text-center space-y-8">
                {/* Price */}
                <div>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-6xl font-bold">$19.99</span>
                    <span className="text-2xl text-muted-foreground">/user/month</span>
                  </div>
                </div>

                {/* Key Points */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-lg">No user minimum</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-lg">Add or remove users anytime</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-lg">First 30 days free</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-lg">Cancel anytime—keep your photos</span>
                  </div>
                </div>

                {/* What's Included */}
                <div className="border-t border-border pt-6">
                  <h3 className="font-semibold text-lg mb-4">What's Included</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Unlimited photos & projects</li>
                    <li>• Automatic time tracking with geofencing</li>
                    <li>• GPS-verified timecards (PDF/CSV export)</li>
                    <li>• Travel time tracking between jobs</li>
                    <li>• Cloud backup & sync</li>
                    <li>• Task management with photo attachments</li>
                    <li>• Team sharing & priority support</li>
                  </ul>
                </div>

                {/* CTA Button */}
                <Button 
                  size="lg"
                  className="w-full bg-sky-500 hover-elevate text-lg py-6"
                  onClick={() => {
                    const heroForm = document.querySelector('[data-testid="input-email-hero"]') as HTMLInputElement;
                    if (heroForm) {
                      heroForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      setTimeout(() => heroForm.focus(), 500);
                    }
                  }}
                  data-testid="button-join-waitlist-pricing"
                >
                  Join the Waitlist
                </Button>

                {/* App Store Note */}
                <p className="text-sm text-muted-foreground">
                  *$24.99/month when purchased through Apple App Store
                </p>

                {/* Launch Offer Badge */}
                <div className="bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-4 py-3 rounded-lg">
                  <p className="font-semibold">
                    Lock in $19.99 pricing forever—early access only
                  </p>
                </div>
              </div>
            </Card>
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
              <Card key={index} className="p-6" data-testid={`card-faq-${index}`}>
                <h3 className="font-semibold text-lg mb-3">{faq.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
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
              Join the waitlist and get 30 days free when we launch.
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
                className="bg-sky-500 hover-elevate whitespace-nowrap"
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
