import { Preferences } from '@capacitor/preferences';

/**
 * GeofenceDebugLog - Persistent error and event logging for geofencing
 * 
 * Stores the last 100 log entries in device storage for debugging.
 * Accessible via Debug Console screen for easy copy/paste during Xcode testing.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogCategory = 
  | 'geofence' 
  | 'clock' 
  | 'location' 
  | 'notification' 
  | 'permission' 
  | 'network' 
  | 'license';

export interface DebugLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  stackTrace?: string;
}

const STORAGE_KEY = 'fieldsnaps_debug_logs';
const MAX_ENTRIES = 100;

let cachedLogs: DebugLogEntry[] | null = null;

/**
 * Load logs from persistent storage
 */
async function loadLogs(): Promise<DebugLogEntry[]> {
  if (cachedLogs !== null) {
    return cachedLogs;
  }

  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (value) {
      cachedLogs = JSON.parse(value);
      return cachedLogs || [];
    }
  } catch (error) {
    console.error('[DebugLog] Failed to load logs:', error);
  }
  
  cachedLogs = [];
  return cachedLogs;
}

/**
 * Save logs to persistent storage
 */
async function saveLogs(logs: DebugLogEntry[]): Promise<void> {
  try {
    cachedLogs = logs;
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(logs),
    });
  } catch (error) {
    console.error('[DebugLog] Failed to save logs:', error);
  }
}

/**
 * Add a log entry
 */
export async function addDebugLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  details?: any,
  error?: Error
): Promise<void> {
  const logs = await loadLogs();
  
  const entry: DebugLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    details: details ? JSON.stringify(details, null, 2) : undefined,
    stackTrace: error?.stack,
  };

  // Add to beginning (newest first)
  logs.unshift(entry);
  
  // Trim to max entries
  if (logs.length > MAX_ENTRIES) {
    logs.splice(MAX_ENTRIES);
  }
  
  await saveLogs(logs);
  
  // Also log to console for immediate visibility
  const consoleMethod = level === 'error' ? console.error : 
                        level === 'warn' ? console.warn : console.log;
  consoleMethod(`[${category.toUpperCase()}] ${message}`, details || '');
}

/**
 * Convenience methods for different log levels
 */
export const debugLog = {
  info: (category: LogCategory, message: string, details?: any) =>
    addDebugLog('info', category, message, details),
    
  warn: (category: LogCategory, message: string, details?: any) =>
    addDebugLog('warn', category, message, details),
    
  error: (category: LogCategory, message: string, details?: any, error?: Error) =>
    addDebugLog('error', category, message, details, error),
    
  debug: (category: LogCategory, message: string, details?: any) =>
    addDebugLog('debug', category, message, details),
    
  getLogs: () => getDebugLogs(),
  
  clear: () => clearDebugLogs(),
};

/**
 * Get all log entries
 */
export async function getDebugLogs(): Promise<DebugLogEntry[]> {
  return loadLogs();
}

/**
 * Get logs filtered by level
 */
export async function getLogsByLevel(level: LogLevel): Promise<DebugLogEntry[]> {
  const logs = await loadLogs();
  return logs.filter(log => log.level === level);
}

/**
 * Get logs filtered by category
 */
export async function getLogsByCategory(category: LogCategory): Promise<DebugLogEntry[]> {
  const logs = await loadLogs();
  return logs.filter(log => log.category === category);
}

/**
 * Get error logs only
 */
export async function getErrorLogs(): Promise<DebugLogEntry[]> {
  return getLogsByLevel('error');
}

/**
 * Clear all logs
 */
export async function clearDebugLogs(): Promise<void> {
  cachedLogs = [];
  await Preferences.remove({ key: STORAGE_KEY });
}

/**
 * Format logs for clipboard copy (human-readable)
 */
export async function formatLogsForClipboard(): Promise<string> {
  const logs = await loadLogs();
  
  if (logs.length === 0) {
    return 'No debug logs recorded.';
  }
  
  const header = `=== FieldSnaps Debug Logs ===
Generated: ${new Date().toISOString()}
Total Entries: ${logs.length}
${'='.repeat(40)}

`;

  const formattedLogs = logs.map(log => {
    let entry = `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}]
${log.message}`;
    
    if (log.details) {
      entry += `\nDetails: ${log.details}`;
    }
    
    if (log.stackTrace) {
      entry += `\nStack: ${log.stackTrace}`;
    }
    
    return entry;
  }).join('\n\n---\n\n');
  
  return header + formattedLogs;
}

/**
 * Get summary statistics
 */
export async function getLogStats(): Promise<{
  total: number;
  errors: number;
  warnings: number;
  info: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}> {
  const logs = await loadLogs();
  
  return {
    total: logs.length,
    errors: logs.filter(l => l.level === 'error').length,
    warnings: logs.filter(l => l.level === 'warn').length,
    info: logs.filter(l => l.level === 'info').length,
    oldestEntry: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
    newestEntry: logs.length > 0 ? logs[0].timestamp : null,
  };
}

/**
 * Export logs as JSON for full debugging
 */
export async function exportLogsAsJSON(): Promise<string> {
  const logs = await loadLogs();
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0', // TODO: Get from package.json
    platform: 'ios', // TODO: Get from Capacitor
    logs,
  }, null, 2);
}
