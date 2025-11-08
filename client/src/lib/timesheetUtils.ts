import type { ClockEntry } from "@shared/schema";

export interface Shift {
  clockIn: Date;
  clockOut?: Date; // Optional for in-progress shifts
  hours: number;
  clockInStr: string;
  clockOutStr?: string;
}

export interface Break {
  start: Date;
  end: Date;
  minutes: number;
}

export interface DayData {
  date: string; // ISO date YYYY-MM-DD in local timezone
  dayName: string;
  totalHours: number;
  clockIn?: string; // Localized time string (first shift)
  clockOut?: string; // Localized time string (last shift)
  breakMinutes: number;
  shifts: Shift[];
  inProgress: boolean; // True if currently clocked in
}

export interface WeekData {
  days: DayData[];
  weekTotal: number;
}

/**
 * Processes all entries chronologically to build complete shifts
 * Handles duplicate clock-ins and clamps in-progress shifts to date range
 */
function buildShifts(sortedEntries: ClockEntry[], endDate: Date): Shift[] {
  const shifts: Shift[] = [];
  let currentShiftStart: Date | null = null;
  
  for (const entry of sortedEntries) {
    if (entry.type === 'clock_in') {
      // Handle duplicate clock-ins: keep the latest one
      currentShiftStart = new Date(entry.timestamp);
    } else if (entry.type === 'clock_out' && currentShiftStart) {
      const clockOutTime = new Date(entry.timestamp);
      const hours = (clockOutTime.getTime() - currentShiftStart.getTime()) / (1000 * 60 * 60);
      
      shifts.push({
        clockIn: currentShiftStart,
        clockOut: clockOutTime,
        hours,
        clockInStr: currentShiftStart.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        clockOutStr: clockOutTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      });
      
      currentShiftStart = null;
    }
  }
  
  // Handle in-progress shift (clocked in but not out)
  // Clamp to end of date range to avoid inflating historical weeks
  if (currentShiftStart) {
    const now = new Date();
    const effectiveEnd = now < endDate ? now : endDate;
    const hours = Math.max(0, (effectiveEnd.getTime() - currentShiftStart.getTime()) / (1000 * 60 * 60));
    
    shifts.push({
      clockIn: currentShiftStart,
      hours,
      clockInStr: currentShiftStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
      inProgress: true,
    } as Shift);
  }
  
  return shifts;
}

/**
 * Processes all break entries chronologically to build complete breaks
 * This ensures overnight breaks (start before midnight, end after) are paired correctly
 */
function buildBreaks(sortedEntries: ClockEntry[]): Break[] {
  const breaks: Break[] = [];
  let breakStartTime: Date | null = null;
  
  for (const entry of sortedEntries) {
    if (entry.type === 'break_start') {
      // Handle duplicate break_starts: keep the latest one
      breakStartTime = new Date(entry.timestamp);
    } else if (entry.type === 'break_end' && breakStartTime) {
      const breakEndTime = new Date(entry.timestamp);
      const minutes = (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60);
      
      breaks.push({
        start: breakStartTime,
        end: breakEndTime,
        minutes,
      });
      
      breakStartTime = null;
    }
  }
  
  return breaks;
}

/**
 * Assigns shifts and breaks to days based on start time (local timezone)
 * This ensures overnight shifts/breaks are attributed to the correct day
 */
function assignToDays(
  shifts: Shift[],
  breaks: Break[],
  startDate: Date,
  endDate: Date
): DayData[] {
  const days: DayData[] = [];
  
  // Group shifts by clock-in date (local)
  const shiftsByDay = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const localDateKey = shift.clockIn.toLocaleDateString('en-CA'); // YYYY-MM-DD
    if (!shiftsByDay.has(localDateKey)) {
      shiftsByDay.set(localDateKey, []);
    }
    shiftsByDay.get(localDateKey)!.push(shift);
  }
  
  // Group breaks by start date (local)
  const breaksByDay = new Map<string, number>();
  for (const breakItem of breaks) {
    const localDateKey = breakItem.start.toLocaleDateString('en-CA');
    breaksByDay.set(localDateKey, (breaksByDay.get(localDateKey) || 0) + breakItem.minutes);
  }
  
  // Generate all days in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const localDateKey = currentDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const dayShifts = shiftsByDay.get(localDateKey) || [];
    const breakMinutes = Math.round(breaksByDay.get(localDateKey) || 0);
    
    // Calculate totals
    const totalHours = dayShifts.reduce((sum, shift) => sum + shift.hours, 0);
    const firstShift = dayShifts[0];
    const lastShift = dayShifts[dayShifts.length - 1];
    const inProgress = dayShifts.some(s => !s.clockOut);
    
    days.push({
      date: localDateKey,
      dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
      totalHours,
      clockIn: firstShift?.clockInStr,
      clockOut: lastShift?.clockOutStr,
      breakMinutes,
      shifts: dayShifts,
      inProgress,
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
}

/**
 * Processes raw clock entries into timesheet data with proper timezone handling
 * Handles overnight shifts, overnight breaks, in-progress shifts, and duplicate entries correctly
 */
export function processTimesheetData(
  entries: ClockEntry[],
  startDate: Date,
  endDate: Date
): WeekData {
  // Sort all entries chronologically
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Step 1: Build complete shifts from chronological entries (clamped to date range)
  const shifts = buildShifts(sortedEntries, endDate);
  
  // Step 2: Build complete breaks from chronological entries
  const breaks = buildBreaks(sortedEntries);
  
  // Step 3: Assign shifts and breaks to days based on start time
  const days = assignToDays(shifts, breaks, startDate, endDate);
  
  const weekTotal = days.reduce((sum, day) => sum + day.totalHours, 0);
  
  return { days, weekTotal };
}

/**
 * Formats hours as "Xh Ym" for display
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0 && m === 0) return '-';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Generates CSV content for export with timezone info
 */
export function generateCsvData(weekData: WeekData, startDate: Date): string {
  // Get user's timezone abbreviation
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzShort = new Date().toLocaleTimeString('en-US', { 
    timeZoneName: 'short' 
  }).split(' ').pop() || '';
  
  const headers = [
    'Date',
    'Day',
    `Clock In (${tzShort})`,
    `Clock Out (${tzShort})`,
    'Break (min)',
    'Total Hours',
  ];
  
  const rows = weekData.days.map(day => [
    day.date,
    day.dayName,
    day.clockIn || '-',
    day.clockOut || (day.inProgress ? 'In Progress' : '-'),
    day.breakMinutes.toString(),
    formatHours(day.totalHours),
  ]);
  
  rows.push(['', '', '', 'Week Total', '', formatHours(weekData.weekTotal)]);
  
  const csvContent = [
    `# Timesheet Export - ${timeZone}`,
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
  
  return csvContent;
}
