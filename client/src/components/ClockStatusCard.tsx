import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, Play, Square, Coffee, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { haptics } from "@/lib/nativeHaptics";
import { format } from "date-fns";

interface ClockStatus {
  isClockedIn: boolean;
  onBreak: boolean;
  clockInTime?: string;
  totalHoursToday: number;
}

export function ClockStatusCard() {
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<ClockStatus>({
    queryKey: ['/api/clock/status'],
    refetchInterval: 60000, // Refresh every minute
  });

  const clockMutation = useMutation({
    mutationFn: async (data: { type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'; totalHoursToday?: number }) => {
      return await apiRequest('POST', '/api/clock', data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clock/status'] });
      haptics.medium();
      
      // Show success toast only after server confirms
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

  const handleClockIn = () => {
    clockMutation.mutate({ type: 'clock_in' });
  };

  const handleClockOut = () => {
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
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground" data-testid="clock-status-title">
                Ready to start your day?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Clock in to track your time today
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleClockIn}
              disabled={clockMutation.isPending}
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Status Info */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              {status.onBreak ? (
                <Coffee className="h-7 w-7 text-primary" />
              ) : (
                <CheckCircle2 className="h-7 w-7 text-primary" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground" data-testid="clock-status-title">
                {status.onBreak ? "On Break" : "Clocked In"}
              </h3>
              {status.clockInTime && (
                <p className="text-xs text-muted-foreground" data-testid="text-clock-in-time">
                  Started: {format(new Date(status.clockInTime), 'h:mm a')}
                </p>
              )}
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold text-primary" data-testid="text-hours-today">
                  {formatHours(status.totalHoursToday)}
                </p>
                <p className="text-sm text-muted-foreground">today</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {status.onBreak ? (
              <Button
                variant="default"
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
                onClick={handleBreakStart}
                disabled={clockMutation.isPending}
                data-testid="button-start-break"
              >
                <Coffee className="mr-2 h-4 w-4" />
                Start Break
              </Button>
            )}
            <Button
              variant={status.onBreak ? "outline" : "default"}
              onClick={handleClockOut}
              disabled={clockMutation.isPending}
              data-testid="button-clock-out"
            >
              <Square className="mr-2 h-4 w-4" />
              End Your Day
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
