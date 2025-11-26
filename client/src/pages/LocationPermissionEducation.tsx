import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { 
  MapPin, 
  Clock, 
  Shield, 
  ChevronRight, 
  CheckCircle2, 
  XCircle,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { NativeSettings, IOSSettings, AndroidSettings } from "capacitor-native-settings";

export default function LocationPermissionEducation() {
  const [, setLocation] = useLocation();

  const handleOpenSettings = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeSettings.open({
          optionAndroid: AndroidSettings.ApplicationDetails,
          optionIOS: IOSSettings.App,
        });
      } catch (error) {
        console.error("Failed to open settings:", error);
      }
    }
  };

  const handleContinue = () => {
    setLocation("/settings");
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-location-permission-education">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center h-14 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/settings")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold ml-2">Location Access</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold" data-testid="text-title">
            Why "Always Allow" Location?
          </h2>
          <p className="text-muted-foreground text-sm">
            Automatic time tracking needs background location to work properly
          </p>
        </div>

        <div className="space-y-3">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm" data-testid="text-benefit-1">
                    Automatic Clock-In
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Get notified to clock in when you arrive at a job site—even with the app closed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm" data-testid="text-benefit-2">
                    Never Miss a Clock-Out
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Get reminded to clock out when you leave—no more forgotten timecards
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm" data-testid="text-benefit-3">
                    Accurate Pay Records
                  </p>
                  <p className="text-muted-foreground text-xs">
                    GPS-verified time entries protect you from payroll disputes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm" data-testid="text-privacy-title">
                  Your Privacy Matters
                </p>
                <p className="text-muted-foreground text-xs">
                  Location is only tracked near job sites, never at home. You can pause tracking anytime in Settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2 bg-muted/50 rounded-lg p-4">
          <p className="font-medium text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span data-testid="text-battery-title">Battery Usage</span>
          </p>
          <p className="text-muted-foreground text-xs">
            FieldSnaps uses motion detection to minimize battery drain. Expect 5-10% additional usage during an 8-hour shift—much less than maps or navigation apps.
          </p>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-orange-700 dark:text-orange-400" data-testid="text-while-using">
                "While Using" Doesn't Work
              </p>
              <p className="text-xs text-orange-600/80 dark:text-orange-300/80">
                With "While Using", automatic time tracking stops the moment you close the app or lock your phone. You'll miss clock-in/out notifications.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="font-medium text-sm text-center">How to Enable</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">1</span>
              <span>Open Settings</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">2</span>
              <span>Tap "Privacy & Security" → "Location Services"</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">3</span>
              <span>Find FieldSnaps and select "Always"</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4">
          {Capacitor.isNativePlatform() && (
            <Button
              className="w-full"
              onClick={handleOpenSettings}
              data-testid="button-open-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Open Settings
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleContinue}
            data-testid="button-continue"
          >
            Continue
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          You can change location permissions anytime in your device Settings
        </p>
      </div>
    </div>
  );
}
