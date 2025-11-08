import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, Play, Square, Coffee, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { haptics } from "@/lib/nativeHaptics";

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
    mutationFn: async (data: { type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' }) => {
      return await apiRequest('POST', '/api/clock', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clock/status'] });
      haptics.medium();
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
    toast({
      title: "Clocked In",
      description: "Your day has started. Have a productive day!",
    });
  };

  const handleClockOut = () => {
    clockMutation.mutate({ type: 'clock_out' });
    toast({
      title: "Clocked Out",
      description: `You worked ${formatHours(status?.totalHoursToday || 0)} today. Great job!`,
    });
  };

  const handleBreakStart = () => {
    clockMutation.mutate({ type: 'break_start' });
    toast({
      title: "Break Started",
      description: "Take your time. Your break timer has started.",
    });
  };

  const handleBreakEnd = () => {
    clockMutation.mutate({ type: 'break_end' });
    toast({
      title: "Break Ended",
      description: "Welcome back! Your work timer has resumed.",
    });
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
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground" data-testid="clock-status-title">
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
              className="mt-2 min-w-[200px]"
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
              <div className="flex items-baseline gap-2">
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
