import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, MapPin, Clock, User as UserIcon, Calendar, Download, Shield, Hand, Radio, AlertTriangle } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks, formatDistanceToNow } from 'date-fns';

interface ClockEntry {
  id: string;
  userId: string;
  companyId: string;
  projectId: string | null;
  type: string;
  timestamp: Date;
  location: string | null;
  notes: string | null;
  entryMethod: string;
  clockInLatitude: string | null;
  clockInLongitude: string | null;
  clockInAccuracy: number | null;
  clockOutLatitude: string | null;
  clockOutLongitude: string | null;
  clockOutAccuracy: number | null;
  lastHeartbeat: Date | null;
  autoClosedAt: Date | null;
  autoCloseReason: string | null;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  project?: {
    id: string;
    name: string;
  };
}

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export default function AdminTimesheets() {
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.

  // Calculate date range for current week selection
  const today = new Date();
  const targetDate = subWeeks(today, -weekOffset);
  const startDate = startOfWeek(targetDate, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(targetDate, { weekStartsOn: 0 });

  // Fetch users for filter dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch clock entries with proper query params
  const queryParams = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
  
  if (selectedUserId !== 'all') {
    queryParams.append('userId', selectedUserId);
  }

  const { data: entries = [], isLoading } = useQuery<ClockEntry[]>({
    queryKey: [`/api/clock/entries?${queryParams.toString()}`],
    enabled: !!startDate && !!endDate,
  });

  // Calculate summary stats
  const totalEntries = entries.length;
  const geofenceVerified = entries.filter(e => 
    e.entryMethod === 'geofence_auto' || e.entryMethod === 'geofence_notification'
  ).length;
  const manualEntries = entries.filter(e => e.entryMethod === 'manual').length;
  
  // Calculate total hours worked - GROUP BY USER FIRST to prevent pairing bugs
  const entriesByUser = entries.reduce((acc, entry) => {
    if (!acc[entry.userId]) {
      acc[entry.userId] = [];
    }
    acc[entry.userId].push(entry);
    return acc;
  }, {} as Record<string, ClockEntry[]>);

  // Calculate total hours across all users - properly consume clock pairs
  const totalHours = Object.values(entriesByUser).reduce((totalSum, userEntries) => {
    // Sort by timestamp for proper pairing
    const sortedEntries = [...userEntries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Stack-based pairing: each clock-out consumes most recent unpaired clock-in
    let userHours = 0;
    const openClockIns: ClockEntry[] = [];

    for (const entry of sortedEntries) {
      if (entry.type === 'clock_in') {
        openClockIns.push(entry);
      } else if (entry.type === 'clock_out' && openClockIns.length > 0) {
        // Pair with most recent clock-in (stack behavior)
        const clockIn = openClockIns.pop()!;
        const hours = (new Date(entry.timestamp).getTime() - new Date(clockIn.timestamp).getTime()) / (1000 * 60 * 60);
        userHours += hours;
      }
      // Else: unpaired clock-out (ignore) or break entries (skip)
    }

    return totalSum + userHours;
  }, 0);

  const getEntryMethodBadge = (method: string) => {
    switch (method) {
      case 'geofence_auto':
        return <Badge variant="default" className="text-xs"><Shield className="w-3 h-3 mr-1" />Auto</Badge>;
      case 'geofence_notification':
        return <Badge variant="secondary" className="text-xs"><MapPin className="w-3 h-3 mr-1" />Geo</Badge>;
      case 'manual':
        return <Badge variant="outline" className="text-xs"><Hand className="w-3 h-3 mr-1" />Manual</Badge>;
      case 'admin_override':
        return <Badge variant="destructive" className="text-xs"><UserIcon className="w-3 h-3 mr-1" />Admin</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{method}</Badge>;
    }
  };

  const handleExport = () => {
    // CSV export
    const csvHeaders = ['Date', 'Time', 'Worker', 'Type', 'Method', 'Project', 'Location', 'GPS Accuracy', 'Last Heartbeat', 'Auto Closed', 'Notes'];
    const csvRows = entries.map(entry => [
      format(new Date(entry.timestamp), 'yyyy-MM-dd'),
      format(new Date(entry.timestamp), 'HH:mm:ss'),
      entry.user ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() : 'Unknown',
      entry.type,
      entry.entryMethod || 'manual',
      entry.project?.name || '-',
      entry.location || '-',
      entry.clockInAccuracy !== null ? `±${entry.clockInAccuracy}m` : '-',
      entry.lastHeartbeat ? format(new Date(entry.lastHeartbeat), 'yyyy-MM-dd HH:mm:ss') : '-',
      entry.autoClosedAt ? `${entry.autoCloseReason} (${format(new Date(entry.autoClosedAt), 'HH:mm')})` : '-',
      entry.notes || '-',
    ]);

    const csv = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheets-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Timesheet Reports</h1>
          <p className="text-muted-foreground">
            Weekly reports with geofence verification
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={entries.length === 0}
          data-testid="button-export-timesheets"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Week selector */}
            <div className="space-y-2">
              <Label>Week</Label>
              <Select value={weekOffset.toString()} onValueChange={(v) => setWeekOffset(parseInt(v))}>
                <SelectTrigger data-testid="select-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">This Week</SelectItem>
                  <SelectItem value="-1">Last Week</SelectItem>
                  <SelectItem value="-2">2 Weeks Ago</SelectItem>
                  <SelectItem value="-3">3 Weeks Ago</SelectItem>
                  <SelectItem value="-4">4 Weeks Ago</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
              </p>
            </div>

            {/* User filter */}
            <div className="space-y-2">
              <Label>Worker</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-worker">
                  <SelectValue placeholder="All workers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workers</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Summary stats */}
            <div className="space-y-2">
              <Label>Summary</Label>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Hours:</span>
                  <span className="font-semibold">{totalHours.toFixed(2)}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entries:</span>
                  <span className="font-semibold">{totalEntries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verified:</span>
                  <span className="font-semibold text-green-600">{geofenceVerified}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Time Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No time entries for selected period</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const workerName = entry.user 
                  ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim()
                  : 'Unknown';

                return (
                  <Card key={entry.id} className="hover-elevate" data-testid={`card-entry-${entry.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{workerName}</span>
                            <Badge variant={entry.type === 'clock_in' ? 'default' : 'secondary'} className="text-xs">
                              {entry.type.replace('_', ' ')}
                            </Badge>
                            {getEntryMethodBadge(entry.entryMethod || 'manual')}
                          </div>
                          
                          {entry.project && (
                            <p className="text-sm text-muted-foreground">
                              Project: {entry.project.name}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
                            </span>
                            
                            {entry.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {entry.location}
                              </span>
                            )}
                            
                            {entry.clockInAccuracy !== null && (
                              <span className="flex items-center gap-1">
                                GPS: ±{entry.clockInAccuracy}m
                              </span>
                            )}
                            
                            {entry.type === 'clock_in' && entry.lastHeartbeat && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1 cursor-help">
                                    <Radio className="w-3 h-3 text-green-500" />
                                    Last seen: {formatDistanceToNow(new Date(entry.lastHeartbeat), { addSuffix: true })}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Last heartbeat received from worker's device</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(entry.lastHeartbeat), 'MMM d, h:mm a')}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            
                            {entry.autoClosedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 cursor-help">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Auto-closed
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Session was auto-closed at {format(new Date(entry.autoClosedAt), 'h:mm a')}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Reason: {entry.autoCloseReason === 'max_shift' ? 'Exceeded max shift hours' : 'No heartbeat received'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>

                          {entry.notes && (
                            <p className="text-sm italic text-muted-foreground mt-2">
                              Note: {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
