import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ClockStatusCard } from "@/components/ClockStatusCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, MapPin, Zap, Briefcase, Clock } from "lucide-react";
import { LocationPermissionEducation, useLocationPermissionEducation } from "@/components/LocationPermissionEducation";
import { useState, useEffect, useMemo } from "react";
import { getAuthorizationStatus } from "@/lib/geofencing";
import BackgroundGeolocation from "@transistorsoft/capacitor-background-geolocation";
import { Capacitor } from "@capacitor/core";
import type { ClockEntry, Project } from "@shared/schema";

export default function Time() {
  const { showEducation, setShowEducation, handleClose } = useLocationPermissionEducation();
  const [locationStatus, setLocationStatus] = useState<string>("unknown");

  // Calculate date range for recent activity (past 7 days)
  const recentDateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0); // Normalize to start of day
    endDate.setHours(23, 59, 59, 999); // Normalize to end of day
    return {
      startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD format for stable key
      endDate: endDate.toISOString().split('T')[0],
      startISO: startDate.toISOString(),
      endISO: endDate.toISOString(),
    };
  }, []);

  // Fetch recent clock entries to show active projects
  const { data: recentEntries = [] } = useQuery<ClockEntry[]>({
    queryKey: ['/api/timesheets', recentDateRange.startDate, recentDateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: recentDateRange.startISO,
        endDate: recentDateRange.endISO,
      });
      const res = await fetch(`/api/timesheets?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch projects for names
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Calculate active projects with hours from recent entries by pairing clock_in/clock_out
  const activeProjects = useMemo(() => {
    if (!recentEntries.length || !projects.length) return [];
    
    const projectHours = new Map<string, { hours: number; lastWorked: Date }>();
    
    // Group entries by project and calculate hours from clock_in/clock_out pairs
    const entriesByProject = new Map<string, ClockEntry[]>();
    for (const entry of recentEntries) {
      if (entry.projectId && (entry.type === 'clock_in' || entry.type === 'clock_out')) {
        const existing = entriesByProject.get(entry.projectId) || [];
        existing.push(entry);
        entriesByProject.set(entry.projectId, existing);
      }
    }
    
    // Calculate hours for each project
    for (const [projectId, entries] of entriesByProject) {
      // Sort entries by timestamp
      const sorted = entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      let totalHours = 0;
      let lastWorked = new Date(0);
      let clockInTime: Date | null = null;
      
      for (const entry of sorted) {
        const entryDate = new Date(entry.timestamp);
        if (entryDate > lastWorked) lastWorked = entryDate;
        
        if (entry.type === 'clock_in') {
          clockInTime = entryDate;
        } else if (entry.type === 'clock_out' && clockInTime) {
          // Calculate hours between clock_in and clock_out
          const diffMs = entryDate.getTime() - clockInTime.getTime();
          totalHours += diffMs / (1000 * 60 * 60);
          clockInTime = null;
        }
      }
      
      projectHours.set(projectId, { hours: totalHours, lastWorked });
    }
    
    return Array.from(projectHours.entries())
      .map(([projectId, data]) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return null;
        return {
          id: projectId,
          name: project.name,
          hours: data.hours,
          lastWorked: data.lastWorked,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.lastWorked.getTime() - a!.lastWorked.getTime())
      .slice(0, 3); // Show top 3 recent projects
  }, [recentEntries, projects]);

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

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

      {/* Active Projects Section */}
      {activeProjects.length > 0 && (
        <div className="px-4 pt-4 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recent Activity
          </h2>
          
          <div className="space-y-2">
            {activeProjects.map((project) => (
              <Card 
                key={project!.id} 
                className="p-3"
                data-testid={`card-active-project-${project!.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{project!.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeDate(project!.lastWorked)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-medium">{formatHours(project!.hours)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

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
