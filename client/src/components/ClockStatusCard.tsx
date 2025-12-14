import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, Play, Square, Coffee, CheckCircle2, ArrowRightLeft, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TimeReviewDialog } from "@/components/TimeReviewDialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { haptics } from "@/lib/nativeHaptics";
import { format } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import type { Project } from "@shared/schema";

interface ClockStatus {
  isClockedIn: boolean;
  onBreak: boolean;
  clockInTime?: string;
  totalHoursToday: number;
  currentProjectId?: string | null;
  lastProjectId?: string | null;
  lastProjectName?: string | null;
}

export function ClockStatusCard() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [newProjectId, setNewProjectId] = useState<string>("");
  const [showTimeReview, setShowTimeReview] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);

  const { data: status, isLoading } = useQuery<ClockStatus>({
    queryKey: ['/api/clock/status'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch projects for selection
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Live timer effect - updates every second when clocked in
  useEffect(() => {
    if (!status?.isClockedIn || !status.clockInTime) {
      setLiveSeconds(0);
      return;
    }

    const clockInTime = new Date(status.clockInTime).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - clockInTime) / 1000);
      setLiveSeconds(elapsed);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [status?.isClockedIn, status?.clockInTime]);

  // Get current project name
  const currentProject = useMemo(() => {
    if (!status?.currentProjectId) return null;
    return projects.find(p => p.id === status.currentProjectId);
  }, [status?.currentProjectId, projects]);

  // Format live timer as HH:MM:SS
  const formatLiveTimer = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const clockMutation = useMutation({
    mutationFn: async (data: { type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'; totalHoursToday?: number; projectId?: string }) => {
      return await apiRequest('POST', '/api/clock', data);
    },
    onSuccess: (_data, variables) => {
      // Close time review dialog immediately if this was a clock out
      if (variables.type === 'clock_out') {
        setShowTimeReview(false);
      }
      
      // Invalidate cache (don't await - let it run in background)
      queryClient.invalidateQueries({ queryKey: ['/api/clock/status'] });
      
      haptics.medium();
      
      // Show success toast
      const toastMessages = {
        clock_in: {
          title: "Clocked In",
          description: "Your day has started. Have a productive day!",
        },
        clock_out: {
          title: "Clocked Out",
          description: `You worked ${formatHours(variables.totalHoursToday || 0)} today. Great job!`,
        },
        break_start: {
          title: "Break Started",
          description: "Take your time. Your break timer has started.",
        },
        break_end: {
          title: "Break Ended",
          description: "Welcome back! Your work timer has resumed.",
        },
      };
      
      toast(toastMessages[variables.type]);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update clock status",
      });
    },
  });

  const switchProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await apiRequest('POST', '/api/clock/switch-project', { projectId });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clock/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clock/entries'] });
      haptics.medium();
      setShowSwitchDialog(false);
      setNewProjectId("");
      
      toast({
        title: "Project Switched",
        description: `Now working on: ${data.project.name}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to switch project",
      });
    },
  });

  const handleClockIn = () => {
    if (!selectedProjectId) {
      toast({
        variant: "destructive",
        title: "Project Required",
        description: "Please select a project before clocking in",
      });
      return;
    }
    clockMutation.mutate({ type: 'clock_in', projectId: selectedProjectId });
  };

  const handleClockOut = () => {
    // Open time review dialog instead of immediately clocking out
    setShowTimeReview(true);
  };

  const handleConfirmClockOut = () => {
    // Actually clock out after review confirmation
    // Dialog will close automatically in mutation's onSuccess callback
    clockMutation.mutate({ type: 'clock_out', totalHoursToday: status?.totalHoursToday });
  };

  const handleBreakStart = () => {
    clockMutation.mutate({ type: 'break_start' });
  };

  const handleBreakEnd = () => {
    clockMutation.mutate({ type: 'break_end' });
  };

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  // Not clocked in state
  if (!status.isClockedIn) {
    return (
      <Card className="mb-6 bg-gradient-to-br from-card to-card/80" data-testid="clock-status-card">
        <CardContent className="p-5">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground" data-testid="clock-status-title">
                Ready to start your day?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a project and clock in to track your time
              </p>
            </div>
            
            {/* Last Project Shortcut */}
            {status.lastProjectId && status.lastProjectName && !selectedProjectId && (
              <Button
                variant="outline"
                onClick={() => setSelectedProjectId(status.lastProjectId!)}
                className="rounded-full"
                data-testid="button-last-project"
              >
                <History className="mr-2 h-4 w-4" />
                Continue with {status.lastProjectName}
              </Button>
            )}
            
            {/* Project Selector */}
            <div className="w-full max-w-xs space-y-2">
              <Label htmlFor="project-select" className="text-sm font-medium">
                {selectedProjectId ? "Selected Project" : "Or select a project"}
              </Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="project-select" data-testid="select-project">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No projects available
                    </div>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              size="lg"
              onClick={handleClockIn}
              disabled={clockMutation.isPending || !selectedProjectId}
              className="min-w-[200px]"
              data-testid="button-clock-in"
            >
              <Play className="mr-2 h-5 w-5" />
              Start Your Day
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Clocked in state
  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-card" data-testid="clock-status-card">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.onBreak ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`} />
            <span className="text-sm font-medium text-muted-foreground" data-testid="clock-status-title">
              {status.onBreak ? "On Break" : "Working"}
            </span>
          </div>
          
          {/* Large Timer Display */}
          <div className="py-2">
            <p className="text-5xl font-bold tabular-nums tracking-tight text-foreground" data-testid="text-live-timer">
              {formatLiveTimer(liveSeconds)}
            </p>
            {status.clockInTime && (
              <p className="text-sm text-muted-foreground mt-2" data-testid="text-clock-in-time">
                Started at {format(new Date(status.clockInTime), 'h:mm a')}
              </p>
            )}
          </div>
          
          {/* Current Project Display */}
          {currentProject && (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full" data-testid="badge-current-project">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm font-medium">{currentProject.name}</span>
            </div>
          )}
          
          {/* Today's Total */}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground" data-testid="text-hours-today">{formatHours(status.totalHoursToday)}</span> worked today
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {!status.onBreak && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSwitchDialog(true)}
                disabled={clockMutation.isPending || switchProjectMutation.isPending}
                data-testid="button-switch-project"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Switch
              </Button>
            )}
            {status.onBreak ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBreakEnd}
                disabled={clockMutation.isPending}
                data-testid="button-end-break"
              >
                <Play className="mr-2 h-4 w-4" />
                End Break
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBreakStart}
                disabled={clockMutation.isPending}
                data-testid="button-start-break"
              >
                <Coffee className="mr-2 h-4 w-4" />
                Break
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={handleClockOut}
              disabled={clockMutation.isPending}
              data-testid="button-clock-out"
            >
              <Square className="mr-2 h-4 w-4" />
              Clock Out
            </Button>
          </div>
        </div>

        {/* Switch Project Dialog */}
        <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
          <DialogContent data-testid="dialog-switch-project">
            <DialogHeader>
              <DialogTitle>Switch Project</DialogTitle>
              <DialogDescription>
                Select a new project to switch to. Your current time will be clocked out and you'll be clocked into the new project seamlessly.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-project-select">Select New Project</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger id="new-project-select" data-testid="select-new-project">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.filter(p => p.id !== status?.currentProjectId).length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No other projects available
                      </div>
                    ) : (
                      projects
                        .filter(p => p.id !== status?.currentProjectId)
                        .map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowSwitchDialog(false);
                  setNewProjectId("");
                }}
                disabled={switchProjectMutation.isPending}
                data-testid="button-cancel-switch"
              >
                Cancel
              </Button>
              <Button
                onClick={() => switchProjectMutation.mutate(newProjectId)}
                disabled={switchProjectMutation.isPending || !newProjectId}
                data-testid="button-confirm-switch"
              >
                {switchProjectMutation.isPending ? "Switching..." : "Switch Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Time Review Dialog */}
        <TimeReviewDialog
          open={showTimeReview}
          onOpenChange={setShowTimeReview}
          onConfirmClockOut={handleConfirmClockOut}
          isClockingOut={clockMutation.isPending}
          totalHoursToday={status?.totalHoursToday || 0}
        />
      </CardContent>
    </Card>
  );
}
