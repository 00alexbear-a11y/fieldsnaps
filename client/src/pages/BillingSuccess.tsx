import { useEffect } from "react";
import { useLocation } from "wouter";
import { Check, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BillingSuccess() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <Card className="max-w-2xl w-full p-8 md:p-12 text-center space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-600 dark:text-green-400" data-testid="icon-success" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-title">
            Welcome to FieldSnaps!
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-subtitle">
            Your subscription is now active
          </p>
        </div>

        {/* Mission Message */}
        <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-6 space-y-3">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Heart className="w-5 h-5" data-testid="icon-heart" />
            <h2 className="text-xl font-semibold">Making an Impact Together</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-mission">
            Thank you for joining FieldSnaps! 20% of your subscription supports missionaries 
            bringing hope and practical help to communities around the world. Your work documenting 
            construction projects is now helping build a better future in more ways than one.
          </p>
        </div>

        {/* What's Next */}
        <div className="space-y-4 text-left">
          <h3 className="text-lg font-semibold text-center">What's Next?</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3" data-testid="item-feature-1">
              <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <span>Create unlimited projects and capture photos without restrictions</span>
            </li>
            <li className="flex items-start gap-3" data-testid="item-feature-2">
              <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <span>Access all your photos offline with automatic sync when connected</span>
            </li>
            <li className="flex items-start gap-3" data-testid="item-feature-3">
              <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <span>Share project photos with clients and team members instantly</span>
            </li>
            <li className="flex items-start gap-3" data-testid="item-feature-4">
              <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <span>Manage your subscription anytime from Settings</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            onClick={() => setLocation("/projects")}
            className="flex-1"
            data-testid="button-go-projects"
          >
            Go to Projects
          </Button>
          <Button
            onClick={() => setLocation("/settings")}
            variant="outline"
            className="flex-1"
            data-testid="button-view-settings"
          >
            View Settings
          </Button>
        </div>

        {/* Support Link */}
        <p className="text-xs text-muted-foreground pt-4">
          Questions or need help? Visit{" "}
          <a href="/settings" className="text-primary hover:underline">
            Settings
          </a>{" "}
          to manage your subscription or contact support.
        </p>
      </Card>
    </div>
  );
}
