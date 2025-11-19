import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Clock, 
  Shield, 
  Eye, 
  Download,
  Info,
  CheckCircle2,
  XCircle,
  ChevronLeft
} from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function LocationPrivacy() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user } = useQuery<any>({
    queryKey: ['/api/user'],
  });

  const { data: preferences } = useQuery<any>({
    queryKey: ['/api/settings'],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (autoTrackingEnabled: boolean) => {
      const res = await apiRequest('PUT', '/api/settings', { autoTrackingEnabled });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: 'Settings updated',
        description: 'Your location tracking preferences have been saved.',
      });
    },
  });

  const handleToggleTracking = (enabled: boolean) => {
    updatePreferencesMutation.mutate(enabled);
  };

  const isTrackingEnabled = preferences?.autoTrackingEnabled ?? true;

  return (
    <div className="min-h-screen bg-background pb-safe-6">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b pt-safe">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/profile')}
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Location & Privacy</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isTrackingEnabled ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <MapPin className={`w-5 h-5 ${isTrackingEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <CardTitle className="text-base">Automatic Time Tracking</CardTitle>
                  <CardDescription className="text-sm">
                    {isTrackingEnabled ? 'Currently active' : 'Currently paused'}
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={isTrackingEnabled}
                onCheckedChange={handleToggleTracking}
                disabled={updatePreferencesMutation.isPending}
                data-testid="switch-auto-tracking"
              />
            </div>
          </CardHeader>
          {isTrackingEnabled && (
            <CardContent>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  FieldSnaps will automatically clock you in when you arrive at job sites 
                  and clock you out when you leave. You can pause this anytime.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* What We Track */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              What We Track
            </CardTitle>
            <CardDescription>
              Transparent overview of location data collection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Job Site Arrival & Departure</p>
                  <p className="text-sm text-muted-foreground">
                    We detect when you enter or leave a 500ft radius around job sites
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Location Updates Every 5 Minutes</p>
                  <p className="text-sm text-muted-foreground">
                    While clocked in, we track your location for timesheet accuracy
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Travel Time Between Sites</p>
                  <p className="text-sm text-muted-foreground">
                    We calculate time spent traveling between different job sites
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">We DO NOT track when clocked out</p>
                  <p className="text-sm text-muted-foreground">
                    Your location is only recorded during work hours
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">We DO NOT share your location</p>
                  <p className="text-sm text-muted-foreground">
                    Your data is never sold or shared with third parties
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">We DO NOT track your home</p>
                  <p className="text-sm text-muted-foreground">
                    Only job sites are monitored, not personal locations
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why We Track */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Why This Benefits You
            </CardTitle>
            <CardDescription>
              Automatic tracking protects your pay and saves time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/20">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Accurate Pay, No Forgotten Time</p>
                <p className="text-sm text-muted-foreground">
                  Never lose hours because you forgot to clock in or out
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Proof of Work Location</p>
                <p className="text-sm text-muted-foreground">
                  Location verification protects you from disputes about where you worked
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/20">
                <Download className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Export Your Own Data Anytime</p>
                <p className="text-sm text-muted-foreground">
                  Download timesheets with GPS coordinates for your records
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/20">
                <MapPin className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Mileage Tracking for Reimbursement</p>
                <p className="text-sm text-muted-foreground">
                  Automatic calculation of travel between job sites for expense claims
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Your Rights */}
        <Card>
          <CardHeader>
            <CardTitle>Your Rights & Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Pause tracking anytime</p>
                <p className="text-xs text-muted-foreground">Use the switch above</p>
              </div>
              <Badge variant="secondary">Available</Badge>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">View your location history</p>
                <p className="text-xs text-muted-foreground">See all recorded locations</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/timesheets')}
                data-testid="button-view-history"
              >
                View
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Export your data</p>
                <p className="text-xs text-muted-foreground">Download as PDF or CSV</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/timesheets')}
                data-testid="button-export-data"
              >
                Export
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Request data deletion</p>
                <p className="text-xs text-muted-foreground">Contact your administrator</p>
              </div>
              <Badge variant="outline">On Request</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Battery Impact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Battery Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              FieldSnaps uses motion detection to minimize battery usage. Location tracking 
              only activates when you're moving, and pauses automatically when you're stationary. 
              Typical battery impact is less than 2% per hour.
            </p>
          </CardContent>
        </Card>

        {/* Technical Details */}
        <div className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong>Geofence Radius:</strong> 500 feet (152 meters) around each job site
          </p>
          <p>
            <strong>Update Frequency:</strong> Every 5 minutes when moving, paused when stationary
          </p>
          <p>
            <strong>Accuracy:</strong> High accuracy mode (~10 meters) for reliable clock-in/out
          </p>
          <p>
            <strong>Data Retention:</strong> Location data is retained for payroll compliance as required by law
          </p>
        </div>
      </div>
    </div>
  );
}
