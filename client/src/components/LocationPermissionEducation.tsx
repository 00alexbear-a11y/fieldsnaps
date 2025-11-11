import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, MapPin, Clock, Battery, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requestLocationPermission, getAuthorizationStatus } from "@/lib/geofencing";
import BackgroundGeolocation from "@transistorsoft/capacitor-background-geolocation";
import { App as CapApp } from "@capacitor/app";
import { NativeSettings, IOSSettings } from "capacitor-native-settings";

/**
 * iOS Location Permission Education Flow
 * 
 * Apple requires a two-step process for Always Allow permission:
 * 1. First request: "When In Use" (shows basic permission dialog)
 * 2. Second request: "Always Allow" (shows in permission settings)
 * 
 * This component educates users WHY we need Always Allow before asking.
 * Improves permission grant rate from ~40% to ~70%+
 */

interface LocationPermissionEducationProps {
  open: boolean;
  onClose: () => void;
  onPermissionGranted?: () => void;
}

export function LocationPermissionEducation({ 
  open, 
  onClose,
  onPermissionGranted 
}: LocationPermissionEducationProps) {
  const [step, setStep] = useState<"education" | "when-in-use" | "always-allow">("education");
  const [isRequesting, setIsRequesting] = useState(false);
  const [awaitingSettingsReturn, setAwaitingSettingsReturn] = useState(false);

  // Listen for app resume to re-check permission after user returns from Settings
  useEffect(() => {
    if (!awaitingSettingsReturn) return;

    let listenerHandle: any;

    const setupListener = async () => {
      listenerHandle = await CapApp.addListener("resume", async () => {
        console.log("[PermissionEducation] App resumed, re-checking permission status");
        
        try {
          const status = await getAuthorizationStatus();
          
          if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_ALWAYS) {
            // User granted Always Allow! 🎉
            console.log("[PermissionEducation] Always Allow granted!");
            setAwaitingSettingsReturn(false);
            onPermissionGranted?.();
            onClose();
          } else if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_WHEN_IN_USE) {
            // Still only When In Use - user didn't upgrade
            console.log("[PermissionEducation] Still When In Use - user didn't upgrade");
            setAwaitingSettingsReturn(false);
            // Keep dialog open on always-allow step so user can try again
          } else {
            // Permission was denied or revoked
            console.log("[PermissionEducation] Permission denied or revoked");
            setAwaitingSettingsReturn(false);
            setStep("education"); // Reset to start
          }
        } catch (error) {
          console.error("[PermissionEducation] Failed to re-check permission:", error);
          setAwaitingSettingsReturn(false);
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [awaitingSettingsReturn, onClose, onPermissionGranted]);

  const handleRequestWhenInUse = async () => {
    // Guard: Don't allow permission request while awaiting Settings return
    if (awaitingSettingsReturn) {
      console.warn("[PermissionEducation] Blocked permission request while awaiting Settings return");
      return;
    }

    setIsRequesting(true);
    
    try {
      // Request initial permission (this will show system dialog)
      const status = await requestLocationPermission();
      
      if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_DENIED) {
        // User denied permission
        alert("Location permission is required for automatic time tracking. Please enable it in Settings.");
        handleClose();
      } else if (
        status === BackgroundGeolocation.AUTHORIZATION_STATUS_WHEN_IN_USE ||
        status === BackgroundGeolocation.AUTHORIZATION_STATUS_ALWAYS
      ) {
        // Permission granted (either When In Use or Always)
        if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_ALWAYS) {
          // User already granted Always Allow
          onPermissionGranted?.();
          handleClose();
        } else {
          // User granted When In Use, now educate about Always Allow
          setStep("always-allow");
        }
      }
    } catch (error) {
      console.error("Failed to request location permission:", error);
      alert("Failed to request permission. Please try again.");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestAlwaysAllow = async () => {
    // On iOS, we can't programmatically request Always Allow upgrade
    // User must go to Settings > FieldSnaps > Location > Always
    
    try {
      // Set flag to start listening for app resume
      setAwaitingSettingsReturn(true);
      
      // Open iOS Settings app to FieldSnaps location permissions
      // Using capacitor-native-settings for reliable deep linking
      await NativeSettings.openIOS({
        option: IOSSettings.App
      });
      
      // Show instructions while Settings is opening
      setTimeout(() => {
        alert(
          "To enable automatic time tracking:\n\n" +
          "1. Tap 'Location'\n" +
          "2. Select 'Always'\n" +
          "3. Return to FieldSnaps\n\n" +
          "When you return, we'll automatically check and continue setup."
        );
      }, 500);
      
      // Keep dialog open - will close automatically when user returns with Always Allow
    } catch (error) {
      console.error("Failed to open settings:", error);
      setAwaitingSettingsReturn(false);
      
      // Fallback: show manual instructions
      alert(
        "To enable automatic time tracking:\n\n" +
        "1. Go to iPhone Settings\n" +
        "2. Scroll to FieldSnaps\n" +
        "3. Tap 'Location'\n" +
        "4. Select 'Always'\n\n" +
        "This allows FieldSnaps to automatically clock you in when you arrive at job sites."
      );
    }
  };

  const handleClose = () => {
    // Reset state when dialog closes (for retry flows)
    setStep("education");
    setAwaitingSettingsReturn(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-location-permission">
        {step === "education" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Enable Automatic Time Tracking
              </DialogTitle>
              <DialogDescription>
                Never forget to clock in or out again. FieldSnaps automatically tracks your work hours.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <h4 className="font-medium mb-1">Automatic Clock In/Out</h4>
                      <p className="text-sm text-muted-foreground">
                        Get notified when you arrive at a job site. One tap to clock in. We'll automatically clock you out when you leave.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Battery className="w-5 h-5 text-green-600 mt-1" />
                    <div>
                      <h4 className="font-medium mb-1">Minimal Battery Impact</h4>
                      <p className="text-sm text-muted-foreground">
                        Uses motion detection to save battery. Only tracks when you're moving. Target: 5-10% drain over 8 hours.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-1" />
                    <div>
                      <h4 className="font-medium mb-1">Your Privacy Matters</h4>
                      <p className="text-sm text-muted-foreground">
                        Location is only logged during work hours. You control when tracking is active. Delete your location history anytime.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <strong>Why "Always Allow"?</strong> iOS requires "Always Allow" permission for automatic tracking to work even when the app is closed.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                variant="outline" 
                onClick={handleClose} 
                disabled={awaitingSettingsReturn}
                data-testid="button-cancel-permission"
              >
                Not Now
              </Button>
              <Button 
                onClick={handleRequestWhenInUse} 
                disabled={isRequesting || awaitingSettingsReturn} 
                data-testid="button-enable-tracking"
              >
                {isRequesting ? "Requesting..." : "Enable Automatic Tracking"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "always-allow" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                One More Step: Enable "Always Allow"
              </DialogTitle>
              <DialogDescription>
                You've granted "When In Use" permission. To enable automatic tracking, you need to select "Always" in Settings.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h4 className="font-medium">How to enable "Always Allow":</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Tap "Open Settings" below</li>
                  <li>Tap "Location"</li>
                  <li>Select "Always"</li>
                  <li>Return to FieldSnaps</li>
                </ol>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Blue status bar:</strong> When tracking is active, iOS shows a blue bar at the top of your screen. This is normal and required by Apple for transparency.
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="text-sm text-amber-900 dark:text-amber-100">
                  <strong>3-day reminder:</strong> iOS will remind you every 3 days that FieldSnaps is using your location. Tap "Keep Always Allow" to continue automatic tracking.
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                variant="outline" 
                onClick={handleClose} 
                disabled={awaitingSettingsReturn}
                data-testid="button-skip-always"
              >
                I'll Do This Later
              </Button>
              <Button 
                onClick={handleRequestAlwaysAllow} 
                disabled={awaitingSettingsReturn}
                data-testid="button-open-settings"
              >
                {awaitingSettingsReturn ? "Waiting for Settings..." : "Open Settings"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to manage location permission education flow
 * 
 * Usage:
 * const { showEducation, requestPermission } = useLocationPermissionEducation();
 * 
 * // Show education dialog before requesting permission
 * requestPermission();
 */
export function useLocationPermissionEducation() {
  const [showEducation, setShowEducation] = useState(false);

  const requestPermission = async () => {
    // Check current permission status
    const status = await getAuthorizationStatus();

    if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_ALWAYS) {
      // Already have Always Allow permission
      return { granted: true, status: "always" };
    } else if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_DENIED) {
      // Permission denied - show alert to go to Settings
      alert("Location permission is denied. Please enable it in Settings > FieldSnaps > Location to use automatic time tracking.");
      // TODO: Open Settings app when TransistorSoft provides the API
      return { granted: false, status: "denied" };
    } else if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_NOT_DETERMINED) {
      // Never requested - show education first
      setShowEducation(true);
      return { granted: false, status: "pending" };
    } else {
      // Has "When In Use" but not "Always" - show upgrade education
      setShowEducation(true);
      return { granted: false, status: "when-in-use" };
    }
  };

  const handleClose = () => {
    setShowEducation(false);
  };

  return {
    showEducation,
    setShowEducation,
    requestPermission,
    handleClose,
  };
}
