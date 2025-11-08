import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useState } from "react";

interface ClockEntry {
  id: number;
  userId: string;
  companyId: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  timestamp: string;
  createdAt: string;
}

interface DayHours {
  date: string;
  dayName: string;
  totalHours: number;
  clockIn?: string;
  clockOut?: string;
  breakMinutes: number;
}

export default function Timesheets() {
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate week start/end dates
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

  // Fetch clock entries for the week
  const { data: entries = [], isLoading } = useQuery<ClockEntry[]>({
    queryKey: ['/api/clock/entries', startOfWeek.toISOString(), endOfWeek.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
      });
      const res = await fetch(`/api/clock/entries?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch entries');
      return res.json();
    },
  });

  // Calculate daily hours
  const calculateDailyHours = (): DayHours[] => {
    const days: DayHours[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      // Get entries for this day
      const dayEntries = entries.filter(e => {
        const entryDate = new Date(e.timestamp);
        return entryDate >= dayStart && entryDate <= dayEnd;
      });

      // Calculate hours
      let totalHours = 0;
      let breakMinutes = 0;
      let clockIn: string | undefined;
      let clockOut: string | undefined;

      const clockInEntry = dayEntries.find(e => e.type === 'clock_in');
      const clockOutEntry = dayEntries.find(e => e.type === 'clock_out');

      if (clockInEntry) {
        clockIn = new Date(clockInEntry.timestamp).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit'
        });
      }

      if (clockOutEntry) {
        clockOut = new Date(clockOutEntry.timestamp).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit'
        });
      }

      if (clockInEntry && clockOutEntry) {
        const inTime = new Date(clockInEntry.timestamp).getTime();
        const outTime = new Date(clockOutEntry.timestamp).getTime();
        totalHours = (outTime - inTime) / (1000 * 60 * 60);

        // Subtract break time
        const breakStarts = dayEntries.filter(e => e.type === 'break_start');
        const breakEnds = dayEntries.filter(e => e.type === 'break_end');
        
        for (let j = 0; j < Math.min(breakStarts.length, breakEnds.length); j++) {
          const breakStart = new Date(breakStarts[j].timestamp).getTime();
          const breakEnd = new Date(breakEnds[j].timestamp).getTime();
          const breakDuration = (breakEnd - breakStart) / (1000 * 60);
          breakMinutes += breakDuration;
        }

        totalHours -= breakMinutes / 60;
      }

      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        totalHours: Math.max(0, totalHours),
        clockIn,
        clockOut,
        breakMinutes: Math.round(breakMinutes),
      });
    }

    return days;
  };

  const dailyHours = calculateDailyHours();
  const weekTotal = dailyHours.reduce((sum, day) => sum + day.totalHours, 0);

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0 && m === 0) return '-';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatWeekRange = () => {
    const start = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  };

  const handleExport = () => {
    // Prepare CSV data
    const headers = ['Date', 'Day', 'Clock In', 'Clock Out', 'Break (min)', 'Total Hours'];
    const rows = dailyHours.map(day => [
      day.date,
      day.dayName,
      day.clockIn || '-',
      day.clockOut || '-',
      day.breakMinutes.toString(),
      formatHours(day.totalHours),
    ]);
    rows.push(['', '', '', 'Week Total', '', formatHours(weekTotal)]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

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
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Weekly Summary Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-card">
              <CardHeader>
                <CardTitle className="text-lg">Weekly Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary" data-testid="text-week-total">
                    {formatHours(weekTotal)}
                  </span>
                  <span className="text-muted-foreground">total hours</span>
                </div>
              </CardContent>
            </Card>

            {/* Daily Breakdown */}
            <div className="space-y-2">
              {dailyHours.map((day, index) => {
                const isToday = day.date === new Date().toISOString().split('T')[0];
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
                              {new Date(day.date).getDate()}
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
                                  {day.clockOut}
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
        )}
      </div>
    </div>
  );
}
