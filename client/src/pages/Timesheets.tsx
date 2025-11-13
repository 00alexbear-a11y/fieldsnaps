import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Download, ChevronLeft, ChevronRight, Clock, FileText, FileSpreadsheet } from "lucide-react";
import { useState, useMemo } from "react";
import type { ClockEntry, User, Project } from "@shared/schema";
import { processTimesheetData, generateCsvData, formatHours } from "@/lib/timesheetUtils";
import { generateBasicTimecardPdf, generateDetailedTimecardPdf } from "@/lib/timesheetPdfUtils";

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

  // Fetch current user for employee name
  const { data: user } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // Fetch projects for project names mapping
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch location logs for travel time calculation (if available)
  const { data: locationLogs } = useQuery<Array<{
    timestamp: string;
    isMoving: boolean;
    projectId?: string | null;
  }>>({
    queryKey: ['/api/locations/user', startOfWeek.toISOString(), endOfWeek.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
      });
      const res = await fetch(`/api/locations/user?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        // Location logs are optional - return empty array if not available
        return [];
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

  const handleExportCsv = () => {
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

  const handleExportPdf = (type: 'basic' | 'detailed') => {
    if (!weekData || !rawEntries || !user) return;

    // Build project names map
    const projectNames = new Map<string, string>();
    if (projects) {
      for (const project of projects) {
        projectNames.set(project.id, project.name);
      }
    }

    const employeeName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user.email || 'Employee';

    // Convert location logs timestamps to Date objects
    const formattedLocationLogs = locationLogs?.map(log => ({
      ...log,
      timestamp: new Date(log.timestamp),
    }));

    const options = {
      employeeName,
      companyName: undefined, // TODO: Fetch company name from user.companyId
      supervisorName: undefined, // TODO: Fetch supervisor if needed
      weekData,
      startDate: startOfWeek,
      endDate: endOfWeek,
      rawEntries,
      projectNames,
      locationLogs: formattedLocationLogs,
    };

    const doc = type === 'basic' 
      ? generateBasicTimecardPdf(options)
      : generateDetailedTimecardPdf(options);

    // Download PDF
    const filename = `timecard-${type}-${startOfWeek.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={!weekData || isLoading}
                data-testid="button-export"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={handleExportCsv}
                data-testid="button-export-csv"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                CSV (Spreadsheet)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleExportPdf('basic')}
                data-testid="button-export-pdf-basic"
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF (Basic Timecard)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleExportPdf('detailed')}
                data-testid="button-export-pdf-detailed"
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF (Detailed Report)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Week Navigator */}
        <div className="flex flex-col gap-2 px-4 pb-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(weekOffset - 1)}
              data-testid="button-previous-week"
              className="flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Previous Week</span>
            </Button>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium whitespace-nowrap" data-testid="text-week-range">
                {formatWeekRange()}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(weekOffset + 1)}
              disabled={weekOffset >= 0}
              data-testid="button-next-week"
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline mr-1">Next Week</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {weekOffset !== 0 && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekOffset(0)}
                data-testid="button-current-week"
              >
                Jump to Current Week
              </Button>
            </div>
          )}
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
