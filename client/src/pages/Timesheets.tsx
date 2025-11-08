import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import type { ClockEntry } from "@shared/schema";
import { processTimesheetData, generateCsvData, formatHours } from "@/lib/timesheetUtils";

export default function Timesheets() {
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate week start/end dates (Sunday to Saturday)
  const getWeekDates = (offset: number) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + offset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { startOfWeek, endOfWeek };
  };

  const { startOfWeek, endOfWeek } = getWeekDates(weekOffset);

  // Fetch raw clock entries from API
  const { data: rawEntries, isLoading, error } = useQuery<ClockEntry[]>({
    queryKey: ['/api/timesheets', startOfWeek.toISOString(), endOfWeek.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
      });
      const res = await fetch(`/api/timesheets?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch timesheet data');
      }
      return res.json();
    },
  });

  // Process raw entries into timesheet data (client-side, timezone-safe)
  const weekData = useMemo(() => {
    if (!rawEntries) return null;
    return processTimesheetData(rawEntries, startOfWeek, endOfWeek);
  }, [rawEntries, startOfWeek, endOfWeek]);

  const formatWeekRange = () => {
    const start = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  };

  const handleExport = () => {
    if (!weekData) return;

    const csvContent = generateCsvData(weekData, startOfWeek);

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet-${startOfWeek.toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Timesheets
            </h1>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!weekData || isLoading}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Week Navigator */}
        <div className="flex items-center justify-between px-4 pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekOffset(weekOffset - 1)}
            data-testid="button-previous-week"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous Week
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium" data-testid="text-week-range">
              {formatWeekRange()}
            </span>
            {weekOffset !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekOffset(0)}
                data-testid="button-current-week"
              >
                Current Week
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekOffset(weekOffset + 1)}
            disabled={weekOffset >= 0}
            data-testid="button-next-week"
          >
            Next Week
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading timesheet...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-destructive">Failed to load timesheet data</div>
          </div>
        ) : weekData ? (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Weekly Summary Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-card">
              <CardHeader>
                <CardTitle className="text-lg">Weekly Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary" data-testid="text-week-total">
                    {formatHours(weekData.weekTotal)}
                  </span>
                  <span className="text-muted-foreground">total hours</span>
                </div>
              </CardContent>
            </Card>

            {/* Daily Breakdown */}
            <div className="space-y-2">
              {weekData.days.map((day, index) => {
                const isToday = day.date === new Date().toLocaleDateString('en-CA');
                const hasHours = day.totalHours > 0;

                return (
                  <Card
                    key={day.date}
                    className={isToday ? 'border-primary/20' : ''}
                    data-testid={`card-day-${index}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-16">
                            <div className={`text-sm font-medium ${hasHours ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {day.dayName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(day.date + 'T00:00:00').getDate()}
                            </div>
                          </div>
                          
                          {hasHours ? (
                            <div className="flex items-center gap-6 flex-1">
                              <div>
                                <div className="text-xs text-muted-foreground">Clock In</div>
                                <div className="text-sm font-medium" data-testid={`text-clock-in-${index}`}>
                                  {day.clockIn}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Clock Out</div>
                                <div className="text-sm font-medium" data-testid={`text-clock-out-${index}`}>
                                  {day.inProgress ? (
                                    <span className="text-primary">In Progress</span>
                                  ) : (
                                    day.clockOut
                                  )}
                                </div>
                              </div>
                              {day.breakMinutes > 0 && (
                                <div>
                                  <div className="text-xs text-muted-foreground">Break</div>
                                  <div className="text-sm font-medium">
                                    {day.breakMinutes}m
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground flex-1">
                              No hours logged
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className={`text-lg font-bold ${hasHours ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`text-day-total-${index}`}>
                            {formatHours(day.totalHours)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
