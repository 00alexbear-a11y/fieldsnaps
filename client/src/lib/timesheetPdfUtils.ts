import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ClockEntry } from "@shared/schema";
import { formatHours, type WeekData, type DayData } from "./timesheetUtils";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

/**
 * Format date as "Mon, Jan 6"
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Format date as "January 6, 2025"
 */
export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

/**
 * Format hours as decimal (e.g., "8.5" instead of "8h 30m")
 */
export function formatHoursDecimal(hours: number): string {
  return hours.toFixed(2);
}

/**
 * Calculate total regular hours (up to 40) and overtime hours (above 40)
 */
export function calculateRegularAndOvertime(totalHours: number): { regular: number; overtime: number } {
  if (totalHours <= 40) {
    return { regular: totalHours, overtime: 0 };
  }
  return { regular: 40, overtime: totalHours - 40 };
}

/**
 * Get GPS icon based on entry method
 */
export function getGpsIcon(entryMethod?: string | null): string {
  if (!entryMethod) return '';
  if (entryMethod === 'geofence_auto' || entryMethod === 'geofence_notification') {
    return '✓'; // GPS verified
  }
  return '';
}

/**
 * Format entry method for display
 */
export function formatEntryMethod(method?: string | null): string {
  if (!method) return 'Manual';
  const methodMap: Record<string, string> = {
    'manual': 'Manual',
    'geofence_notification': 'Geofence (Notification)',
    'geofence_auto': 'Geofence (Auto)',
    'admin_override': 'Admin Override',
  };
  return methodMap[method] || method;
}

/**
 * Format GPS coordinates as text
 */
export function formatGpsCoordinates(lat?: string | null, lon?: string | null, accuracy?: number | null): string {
  if (!lat || !lon) return 'N/A';
  const acc = accuracy ? ` (±${accuracy}m)` : '';
  return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}${acc}`;
}

/**
 * Travel time calculation interface
 */
export interface TravelSegment {
  startTime: Date;
  endTime: Date;
  durationHours: number;
  fromProject?: string;
  toProject?: string;
}

/**
 * Calculate travel time between projects using location logs
 * Detects when employee is moving between geofences
 * 
 * Algorithm:
 * 1. Find clock-out times (leaving a project)
 * 2. Find next clock-in time (arriving at new project)
 * 3. Use location logs with isMoving=true to calculate actual travel duration
 * 4. If no location logs available, use time difference between clock-out and next clock-in
 */
export function calculateTravelTime(
  clockEntries: ClockEntry[],
  locationLogs?: Array<{
    timestamp: Date;
    isMoving: boolean;
    projectId?: string | null;
  }>
): TravelSegment[] {
  const segments: TravelSegment[] = [];
  
  // Sort entries chronologically
  const sorted = [...clockEntries].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Find pairs of clock-out followed by clock-in at different project
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    // Look for clock-out followed by clock-in
    if (current.type === 'clock_out' && next.type === 'clock_in') {
      const clockOutTime = new Date(current.timestamp);
      const clockInTime = new Date(next.timestamp);
      
      // Check if it's a different project (indicating travel)
      const isDifferentProject = current.projectId !== next.projectId;
      
      // Calculate time gap
      const gapMinutes = (clockInTime.getTime() - clockOutTime.getTime()) / (1000 * 60);
      
      // Only count as travel if BOTH conditions are met:
      // 1. Different projects (not same project - prevents lunch breaks from being travel)
      // 2. Either: has confirmed movement logs OR gap is significant (>30 min between different projects)
      if (!isDifferentProject) {
        // Same project - not travel even if there's a gap (e.g., lunch break)
        continue;
      }
      
      // Different projects - require confirmed movement logs
      // Conservative approach: only count travel when we have actual movement evidence
      // This prevents false positives from lunch breaks, off-clock time, etc.
      
      if (!locationLogs || locationLogs.length === 0) {
        // No location logs available - cannot confirm travel, skip
        continue;
      }
      
      // Find location logs during this time period that show movement
      const movingLogs = locationLogs.filter(log => {
        const logTime = new Date(log.timestamp);
        return log.isMoving && 
               logTime >= clockOutTime && 
               logTime <= clockInTime;
      });
      
      // Only count travel if we have confirmed movement
      if (movingLogs.length === 0) {
        // No movement detected - cannot confirm travel, skip
        continue;
      }
      
      // Calculate actual travel time from movement logs
      const firstMoving = new Date(movingLogs[0].timestamp);
      const lastMoving = new Date(movingLogs[movingLogs.length - 1].timestamp);
      const travelDuration = (lastMoving.getTime() - firstMoving.getTime()) / (1000 * 60 * 60);
      
      // Only add if duration is reasonable (> 1 minute, < 4 hours)
      if (travelDuration > 0.017 && travelDuration < 4) {
        segments.push({
          startTime: clockOutTime,
          endTime: clockInTime,
          durationHours: travelDuration,
          fromProject: current.projectId || undefined,
          toProject: next.projectId || undefined,
        });
      }
    }
  }
  
  return segments;
}

/**
 * Group clock entries by day for detailed breakdown
 */
export interface DayDetail {
  date: string;
  entries: ClockEntry[];
  travelSegments: TravelSegment[];
}

export function groupEntriesByDay(
  clockEntries: ClockEntry[],
  travelSegments: TravelSegment[]
): DayDetail[] {
  const dayMap = new Map<string, DayDetail>();
  
  // Group entries by date
  for (const entry of clockEntries) {
    const date = new Date(entry.timestamp).toLocaleDateString('en-CA');
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        date,
        entries: [],
        travelSegments: [],
      });
    }
    dayMap.get(date)!.entries.push(entry);
  }
  
  // Assign travel segments to days (based on start time)
  for (const segment of travelSegments) {
    const date = segment.startTime.toLocaleDateString('en-CA');
    const dayDetail = dayMap.get(date);
    if (dayDetail) {
      dayDetail.travelSegments.push(segment);
    }
  }
  
  // Sort by date
  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generate Basic Timecard PDF - Clean, sign-ready weekly timecard
 * 
 * Features:
 * - Company header with logo (if available)
 * - Employee name and week range
 * - Daily grid with clock in/out, breaks, and hours
 * - Weekly totals with regular/overtime breakdown
 * - Signature lines for employee and supervisor
 * - Apple-style design: Helvetica, 11pt min, high contrast
 */
export interface BasicTimecardOptions {
  employeeName: string;
  employeeId?: string;
  companyName?: string;
  supervisorName?: string;
  weekData: WeekData;
  startDate: Date;
  endDate: Date;
  rawEntries: ClockEntry[];
  projectNames?: Map<string, string>; // projectId -> projectName
  locationLogs?: Array<{
    timestamp: Date;
    isMoving: boolean;
    projectId?: string | null;
  }>;
}

export function generateBasicTimecardPdf(options: BasicTimecardOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter', // 8.5" × 11"
  });
  
  const { employeeName, companyName, supervisorName, weekData, startDate, endDate, rawEntries, projectNames, locationLogs } = options;
  
  // Apple-style fonts and sizes (11pt minimum per Apple HIG)
  const titleSize = 18;
  const headerSize = 14;
  const bodySize = 11;
  const captionSize = 11; // Raised from 10pt to meet 11pt minimum
  
  // Page margins
  const margin = 40; // 0.5" margins
  const pageWidth = doc.internal.pageSize.width;
  
  // Current Y position
  let y = margin;
  
  // === HEADER ===
  
  // Company name (if provided)
  if (companyName) {
    doc.setFontSize(captionSize);
    doc.setTextColor(107, 114, 128); // Gray-600
    doc.text(companyName, margin, y);
    y += 20;
  }
  
  // Title
  doc.setFontSize(titleSize);
  doc.setTextColor(0, 0, 0); // Pure black
  doc.setFont('helvetica', 'bold');
  doc.text('WEEKLY TIMECARD', margin, y);
  y += 30;
  
  // Employee info and week range
  doc.setFontSize(bodySize);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  const weekRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  
  doc.text(`Employee: ${employeeName}`, margin, y);
  doc.text(`Week: ${weekRange}`, pageWidth - margin - 150, y);
  y += 20;
  
  if (supervisorName) {
    doc.text(`Supervisor: ${supervisorName}`, margin, y);
    y += 25;
  } else {
    y += 25;
  }
  
  // === TIMECARD TABLE ===
  
  // Build table data with project names and travel time
  const travelSegments = calculateTravelTime(rawEntries, locationLogs);
  const tableData: any[][] = [];
  
  // Map to track which days have travel
  const travelByDay = new Map<string, TravelSegment[]>();
  for (const segment of travelSegments) {
    const date = segment.startTime.toLocaleDateString('en-CA');
    if (!travelByDay.has(date)) {
      travelByDay.set(date, []);
    }
    travelByDay.get(date)!.push(segment);
  }
  
  for (const day of weekData.days) {
    const dateDisplay = formatDateShort(day.date);
    const clockIn = day.clockIn || '-';
    const clockOut = day.inProgress ? 'In Progress' : (day.clockOut || '-');
    const breakMin = day.breakMinutes > 0 ? day.breakMinutes.toString() : '-';
    const hours = formatHoursDecimal(day.totalHours);
    
    // Get project name(s) for this day
    let projectDisplay = '';
    const dayEntries = rawEntries.filter(e => 
      new Date(e.timestamp).toLocaleDateString('en-CA') === day.date
    );
    const projectIds = Array.from(new Set(dayEntries.map(e => e.projectId).filter(Boolean)));
    if (projectIds.length > 0 && projectNames) {
      projectDisplay = projectIds.map(id => projectNames.get(id!) || 'Unknown').join(', ');
    }
    
    // Add main work row
    tableData.push([
      dateDisplay,
      projectDisplay || '-',
      clockIn,
      clockOut,
      breakMin,
      hours,
    ]);
    
    // Add travel row if applicable
    const dayTravel = travelByDay.get(day.date);
    if (dayTravel && dayTravel.length > 0) {
      const totalTravelHours = dayTravel.reduce((sum, seg) => sum + seg.durationHours, 0);
      tableData.push([
        '',
        '🚗 Travel',
        '',
        '',
        '',
        formatHoursDecimal(totalTravelHours),
      ]);
    }
  }
  
  // Total row
  const { regular, overtime } = calculateRegularAndOvertime(weekData.weekTotal);
  const totalTravelHours = travelSegments.reduce((sum, seg) => sum + seg.durationHours, 0);
  
  tableData.push([
    { content: 'TOTALS', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
    { content: '', colSpan: 1 },
    { content: formatHoursDecimal(weekData.weekTotal + totalTravelHours), styles: { fontStyle: 'bold' } },
  ]);
  
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Project', 'Clock In', 'Clock Out', 'Break (min)', 'Hours']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: bodySize,
      cellPadding: 6,
      textColor: [0, 0, 0],
      lineColor: [229, 231, 235], // Gray-200
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [249, 250, 251], // Gray-50
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: bodySize,
    },
    columnStyles: {
      0: { cellWidth: 70 },   // Date
      1: { cellWidth: 140 },  // Project
      2: { cellWidth: 70 },   // Clock In
      3: { cellWidth: 70 },   // Clock Out
      4: { cellWidth: 55 },   // Break
      5: { cellWidth: 60, halign: 'right' },  // Hours
    },
  });
  
  y = doc.lastAutoTable.finalY + 20;
  
  // === SUMMARY ===
  doc.setFontSize(bodySize);
  doc.setFont('helvetica', 'normal');
  
  const summaryX = margin;
  doc.text(`Regular Hours: ${formatHoursDecimal(regular)}`, summaryX, y);
  doc.text(`Overtime: ${formatHoursDecimal(overtime)}`, summaryX + 150, y);
  if (totalTravelHours > 0) {
    doc.text(`Travel: ${formatHoursDecimal(totalTravelHours)}`, summaryX + 280, y);
  }
  y += 40;
  
  // === SIGNATURE LINES ===
  doc.setFontSize(bodySize);
  
  // Employee signature
  doc.line(margin, y, margin + 200, y);
  y += 15;
  doc.setFontSize(captionSize);
  doc.setTextColor(107, 114, 128);
  doc.text('Employee Signature', margin, y);
  
  // Date
  doc.line(margin + 240, y - 15, margin + 360, y - 15);
  doc.text('Date', margin + 240, y);
  
  y += 30;
  doc.setTextColor(0, 0, 0);
  
  // Supervisor signature
  doc.line(margin, y, margin + 200, y);
  y += 15;
  doc.setFontSize(captionSize);
  doc.setTextColor(107, 114, 128);
  doc.text('Supervisor Signature', margin, y);
  
  // Date
  doc.line(margin + 240, y - 15, margin + 360, y - 15);
  doc.text('Date', margin + 240, y);
  
  return doc;
}

/**
 * Generate Detailed Timecard PDF - Forensic breakdown with GPS, travel, and edits
 * 
 * Includes everything from Basic PDF plus:
 * - GPS coordinates at clock in/out
 * - Entry method (manual, geofence, etc.)
 * - Detailed travel time breakdown
 * - Edit audit trail (who changed what and why)
 */
export interface DetailedTimecardOptions extends BasicTimecardOptions {
  locationLogs?: Array<{
    timestamp: Date;
    isMoving: boolean;
    projectId?: string | null;
  }>;
}

export function generateDetailedTimecardPdf(options: DetailedTimecardOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });
  
  const { employeeName, companyName, weekData, startDate, endDate, rawEntries, projectNames, locationLogs } = options;
  
  const titleSize = 18;
  const headerSize = 14;
  const bodySize = 11;
  const captionSize = 11; // Raised from 10pt to meet 11pt minimum
  const detailSize = 11; // Raised from 9pt to meet 11pt minimum
  
  const margin = 40;
  const pageWidth = doc.internal.pageSize.width;
  let y = margin;
  
  // === HEADER ===
  if (companyName) {
    doc.setFontSize(captionSize);
    doc.setTextColor(107, 114, 128);
    doc.text(companyName, margin, y);
    y += 20;
  }
  
  doc.setFontSize(titleSize);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILED TIME REPORT', margin, y);
  y += 30;
  
  doc.setFontSize(bodySize);
  doc.setFont('helvetica', 'normal');
  
  const weekRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  
  doc.text(`Employee: ${employeeName}`, margin, y);
  doc.text(`Week: ${weekRange}`, pageWidth - margin - 150, y);
  y += 25;
  
  // === DAILY BREAKDOWN ===
  const travelSegments = calculateTravelTime(rawEntries, locationLogs);
  const dayDetails = groupEntriesByDay(rawEntries, travelSegments);
  
  for (const dayDetail of dayDetails) {
    const dayData = weekData.days.find(d => d.date === dayDetail.date);
    if (!dayData || dayData.totalHours === 0) continue;
    
    // Check if we need a new page
    if (y > doc.internal.pageSize.height - 100) {
      doc.addPage();
      y = margin;
    }
    
    // Day header
    doc.setFontSize(headerSize);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDateLong(dayDetail.date), margin, y);
    y += 20;
    
    doc.setFontSize(bodySize);
    doc.setFont('helvetica', 'normal');
    
    // Sort entries chronologically
    const sortedEntries = [...dayDetail.entries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Display each clock entry with details
    for (const entry of sortedEntries) {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
      const projectName = entry.projectId && projectNames ? projectNames.get(entry.projectId) : null;
      const gpsIcon = getGpsIcon(entry.entryMethod);
      
      // Entry type and time
      let entryText = '';
      if (entry.type === 'clock_in') {
        entryText = `${time} Clock In${gpsIcon ? ' ✓' : ''}`;
        if (projectName) entryText += ` - ${projectName}`;
      } else if (entry.type === 'clock_out') {
        entryText = `${time} Clock Out${gpsIcon ? ' ✓' : ''}`;
      } else if (entry.type === 'break_start') {
        entryText = `${time} Break Start`;
      } else if (entry.type === 'break_end') {
        entryText = `${time} Break End`;
      }
      
      doc.text(entryText, margin + 10, y);
      y += 14;
      
      // GPS coordinates (for clock in/out only)
      if ((entry.type === 'clock_in' || entry.type === 'clock_out')) {
        const lat = entry.type === 'clock_in' ? entry.clockInLatitude : entry.clockOutLatitude;
        const lon = entry.type === 'clock_in' ? entry.clockInLongitude : entry.clockOutLongitude;
        const acc = entry.type === 'clock_in' ? entry.clockInAccuracy : entry.clockOutAccuracy;
        
        if (lat && lon) {
          doc.setFontSize(detailSize);
          doc.setTextColor(107, 114, 128);
          doc.text(`📍 ${formatGpsCoordinates(lat, lon, acc)}`, margin + 20, y);
          y += 12;
          
          // Entry method
          if (entry.entryMethod) {
            doc.text(`Method: ${formatEntryMethod(entry.entryMethod)}`, margin + 20, y);
            y += 12;
          }
          
          doc.setTextColor(0, 0, 0);
        }
      }
      
      // Edit trail (if edited)
      if (entry.editedBy || entry.editReason) {
        doc.setFontSize(detailSize);
        doc.setTextColor(220, 38, 38); // Red-600
        doc.text(`✏️ Edited`, margin + 20, y);
        if (entry.editReason) {
          doc.text(`Reason: ${entry.editReason}`, margin + 30, y + 12);
          y += 12;
        }
        y += 12;
        doc.setTextColor(0, 0, 0);
      }
      
      doc.setFontSize(bodySize);
    }
    
    // Travel segments for this day
    if (dayDetail.travelSegments.length > 0) {
      y += 5;
      for (const segment of dayDetail.travelSegments) {
        const startTime = segment.startTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        });
        const duration = formatHours(segment.durationHours);
        
        doc.setTextColor(59, 130, 246); // Blue-500
        doc.text(`🚗 Travel: ${duration}`, margin + 10, y);
        doc.setTextColor(0, 0, 0);
        y += 14;
        
        doc.setFontSize(detailSize);
        doc.setTextColor(107, 114, 128);
        doc.text(`Departed ${startTime}`, margin + 20, y);
        y += 14;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(bodySize);
      }
    }
    
    // Day summary
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${formatHours(dayData.totalHours)}`, margin + 10, y);
    doc.setFont('helvetica', 'normal');
    y += 25;
  }
  
  // === WEEKLY SUMMARY ===
  if (y > doc.internal.pageSize.height - 150) {
    doc.addPage();
    y = margin;
  }
  
  y += 10;
  doc.setFontSize(headerSize);
  doc.setFont('helvetica', 'bold');
  doc.text('Weekly Summary', margin, y);
  y += 25;
  
  doc.setFontSize(bodySize);
  doc.setFont('helvetica', 'normal');
  
  const { regular, overtime } = calculateRegularAndOvertime(weekData.weekTotal);
  const totalTravelHours = travelSegments.reduce((sum, seg) => sum + seg.durationHours, 0);
  
  doc.text(`Total Hours: ${formatHours(weekData.weekTotal)}`, margin, y);
  y += 18;
  doc.text(`Regular Hours: ${formatHoursDecimal(regular)}`, margin, y);
  y += 18;
  doc.text(`Overtime Hours: ${formatHoursDecimal(overtime)}`, margin, y);
  y += 18;
  if (totalTravelHours > 0) {
    doc.text(`Travel Time: ${formatHours(totalTravelHours)}`, margin, y);
    y += 18;
  }
  
  return doc;
}
