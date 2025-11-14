import { Link } from "wouter";
import { ClockStatusCard } from "@/components/ClockStatusCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, MapPin, Zap } from "lucide-react";
import { LocationPermissionEducation, useLocationPermissionEducation } from "@/components/LocationPermissionEducation";
import { useState, useEffect } from "react";
import { getAuthorizationStatus } from "@/lib/geofencing";
import BackgroundGeolocation from "@transistorsoft/capacitor-background-geolocation";
import { Capacitor } from "@capacitor/core";

export default function Time() {
  const { showEducation, setShowEducation, handleClose } = useLocationPermissionEducation();
  const [locationStatus, setLocationStatus] = useState<string>("unknown");

  useEffect(() => {
    // Only check on native platforms
    if (!Capacitor.isNativePlatform()) {
      setLocationStatus("web");
      return;
    }

    const checkStatus = async () => {
      try {
        const status = await getAuthorizationStatus();
        if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_ALWAYS) {
          setLocationStatus("enabled");
        } else if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_WHEN_IN_USE) {
          setLocationStatus("partial");
        } else if (status === BackgroundGeolocation.AUTHORIZATION_STATUS_DENIED) {
          setLocationStatus("denied");
        } else {
          setLocationStatus("not_set");
        }
      } catch (error) {
        console.error("Failed to check location status:", error);
        setLocationStatus("error");
      }
    };

    checkStatus();
  }, []);

  const handleEnableAutoTracking = () => {
    setShowEducation(true);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-32 bg-white dark:bg-black">
      {/* Location Permission Education Dialog */}
      <LocationPermissionEducation 
        open={showEducation} 
        onClose={handleClose}
        onPermissionGranted={() => {
          setLocationStatus("enabled");
          handleClose();
        }}
      />
      {/* Header */}
      <div className="p-4 space-y-2">
        <h1 className="text-xl font-semibold" data-testid="text-time-heading">
          Time Tracking
        </h1>
        <p className="text-sm text-muted-foreground">
          Track your work hours and view timesheets
        </p>
      </div>

      {/* Clock In/Out Card */}
      <div className="px-4 pb-4">
        <ClockStatusCard />
      </div>

      {/* Automatic Time Tracking Setup (Native only) */}
      {locationStatus !== "web" && locationStatus !== "enabled" && (
        <div className="px-4 pb-4">
          <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20" data-testid="card-auto-tracking-promo">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Enable Automatic Time Tracking</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Never forget to clock in again. Get notified when you arrive at job sites.
                </p>
                <Button 
                  onClick={handleEnableAutoTracking}
                  size="sm"
                  className="gap-2"
                  data-testid="button-enable-auto-tracking"
                >
                  <MapPin className="w-4 h-4" />
                  Setup Automatic Tracking
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Links */}
      <div className="px-4 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Quick Links
        </h2>
        
        <Link href="/timesheets">
          <Card className="p-4 cursor-pointer hover-elevate active-elevate-2" data-testid="card-link-timesheets">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">View Timesheets</h3>
                  <p className="text-sm text-muted-foreground">
                    See weekly hours and export records
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Info Section */}
      <div className="px-4 pt-6 space-y-2">
        <p className="text-sm text-muted-foreground">
          Track your work hours throughout the day. Clock in when you start work, 
          take breaks as needed, and clock out when you're done.
        </p>
        <p className="text-sm text-muted-foreground">
          Your time entries are automatically saved and can be viewed in the 
          Timesheets section for reporting and payroll purposes.
        </p>
      </div>
    </div>
  );
}
