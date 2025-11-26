import BackgroundGeolocation, {
  State,
  Location,
  GeofenceEvent,
  MotionChangeEvent,
  ProviderChangeEvent,
  AuthorizationEvent,
  Geofence as TSGeofence,
} from "@transistorsoft/capacitor-background-geolocation";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { debugLog } from './geofenceDebugLog';

/**
 * FieldSnaps Geofencing Service
 * 
 * Battery-optimized automatic time tracking using TransistorSoft Background Geolocation
 * 
 * Features:
 * - Automatic clock-in/out notifications when entering/leaving job sites
 * - 5-minute location logging when clocked in
 * - Motion detection (stops GPS when stationary >5 min)
 * - Battery drain target: 5-10% over 8-hour shift
 * - iOS 20-geofence limit with proximity-based management
 * 
 * License Requirements:
 * - iOS Production: $399 TransistorSoft license (see docs/transistorsoft-license-setup.md)
 * - Android Production: $399 TransistorSoft license (separate purchase)
 * - Development: FREE (no license needed)
 * 
 * iOS Geofence Limit:
 * - Maximum 20 simultaneous geofences (Apple system restriction)
 * - Proximity-based rotation: monitors nearest 20 sites within 25 miles
 * - Auto-updates when user moves to new area
 */

export interface GeofencingConfig {
  onGeofenceEnter?: (geofence: GeofenceEvent) => void;
  onGeofenceExit?: (geofence: GeofenceEvent) => void;
  onGeofenceDwell?: (geofence: GeofenceEvent) => void;
  onLocationUpdate?: (location: Location) => void;
  onMotionChange?: (event: MotionChangeEvent) => void;
}

export interface Project {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

/**
 * iOS enforces a hard limit of 20 geofences per app
 * Cannot be exceeded - system automatically removes oldest geofences
 */
export const MAX_GEOFENCES = 20;

/**
 * Only monitor geofences within this radius (miles)
 * Prevents wasting slots on distant sites
 */
export const PROXIMITY_RADIUS_MILES = 25;

/**
 * Standard geofence radius for all job sites (feet)
 * 500ft = ~152 meters (catches parking lot arrivals)
 */
export const GEOFENCE_RADIUS_FEET = 500;

let isInitialized = false;
let currentConfig: GeofencingConfig | null = null;
let locationLoggingInterval: ReturnType<typeof setInterval> | null = null;
let cachedClockStatus: { isClockedIn: boolean; lastChecked: number } | null = null;
let notificationActionListener: any = null;

/**
 * Retry configuration for failed operations
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
};

/**
 * Queue for failed clock operations (retry when network returns)
 */
interface FailedOperation {
  id: string;
  type: 'clock_in' | 'clock_out';
  geofenceId: string;
  projectId?: string;
  projectName?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  retryCount: number;
}

let failedOperationsQueue: FailedOperation[] = [];

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
          RETRY_CONFIG.maxDelayMs
        );
        await debugLog.info('network', `Retry attempt ${attempt}/${maxRetries} for ${operationName} (delay: ${delay}ms)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return await operation();
    } catch (error: any) {
      lastError = error;
      await debugLog.warn('network', `${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1})`, {
        error: error.message,
        attempt: attempt + 1,
      });
      
      // Don't retry if it's not a network error
      if (!isNetworkError(error)) {
        throw error;
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if an error is a network-related error
 */
function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const message = (error.message || '').toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('offline') ||
    error.name === 'TypeError' // fetch throws TypeError for network issues
  );
}

/**
 * Add a failed operation to the retry queue
 */
async function queueFailedOperation(op: Omit<FailedOperation, 'id' | 'retryCount'>): Promise<void> {
  const operation: FailedOperation = {
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    retryCount: 0,
  };
  
  failedOperationsQueue.push(operation);
  await debugLog.info('network', `Queued failed ${op.type} for retry`, { geofenceId: op.geofenceId });
  
  // Limit queue size
  if (failedOperationsQueue.length > 10) {
    failedOperationsQueue = failedOperationsQueue.slice(-10);
  }
}

/**
 * Process the failed operations queue (call when network returns)
 */
export async function processFailedOperationsQueue(): Promise<void> {
  if (failedOperationsQueue.length === 0) return;
  
  await debugLog.info('network', `Processing ${failedOperationsQueue.length} queued operations`);
  
  const queue = [...failedOperationsQueue];
  failedOperationsQueue = [];
  
  for (const op of queue) {
    try {
      if (op.type === 'clock_in') {
        await performClockInWithData(op.projectId!, op.projectName!, op.latitude, op.longitude, op.accuracy);
      } else {
        await performClockOutWithData(op.latitude, op.longitude, op.accuracy);
      }
      await debugLog.info('network', `Successfully processed queued ${op.type}`);
    } catch (error: any) {
      op.retryCount++;
      if (op.retryCount < 5) {
        failedOperationsQueue.push(op);
        await debugLog.warn('network', `Re-queued ${op.type} after failure (attempt ${op.retryCount})`, { error: error.message });
      } else {
        await debugLog.error('network', `Dropped ${op.type} after 5 failed attempts`, { geofenceId: op.geofenceId }, error);
      }
    }
  }
}

/**
 * Get the current failed operations queue
 */
export function getFailedOperationsQueue(): FailedOperation[] {
  return [...failedOperationsQueue];
}

/**
 * Battery-optimized configuration for construction sites
 * 
 * Key optimizations:
 * - Motion detection (stops GPS when stationary >5 min)
 * - 5-minute location updates (300 second interval)
 * - 200m distance filter (only log every 200 meters when moving)
 * - Geofence proximity radius (activate tracking within 1km of sites)
 * - Target: 5-10% battery drain over 8-hour shift
 */
export const GEOFENCING_CONFIG = {
  // Battery optimization
  desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH, // ~10m accuracy for geofence triggers
  distanceFilter: 200, // Only log location every 200 meters when moving
  stationaryRadius: 100, // Consider stationary after 100m
  locationUpdateInterval: 300000, // 5 minutes (300 seconds) when moving - CRITICAL for battery life
  fastestLocationUpdateInterval: 60000, // Max 1 update per minute (prevents rapid-fire updates)
  
  // Motion detection (CRITICAL FOR BATTERY SAVING)
  stopTimeout: 5, // Stop GPS tracking after 5 min stationary
  stopOnStationary: false, // Keep geofence detection active even when stationary
  disableMotionActivityUpdates: false, // MUST be false for motion detection to work
  activityRecognitionInterval: 10000, // Check for motion every 10 seconds
  minimumActivityRecognitionConfidence: 75, // 75% confidence required
  
  // Geofencing
  geofenceProximityRadius: 1000, // Activate tracking within 1km of geofences
  geofenceInitialTriggerEntry: true, // Trigger immediately if already inside geofence
  
  // Logging (disable in production for privacy)
  debug: false, // Set to true for development debugging
  logLevel: BackgroundGeolocation.LOG_LEVEL_OFF,
  
  // Android specific
  foregroundService: true, // Required for Android 8+
  startOnBoot: true, // Restart tracking after device reboot
  enableHeadless: true, // Allow background operation when app is closed
  
  // Android Foreground Service Notification (required for Android 8+)
  notification: {
    title: "FieldSnaps Auto Time Tracking",
    text: "Monitoring your location for automatic clock-in/out",
    channelName: "Time Tracking Service",
    color: "#4A90E2", // FieldSnaps brand color
    smallIcon: "mipmap/ic_launcher",
    largeIcon: "mipmap/ic_launcher",
    sticky: true, // Always show notification (full transparency to users)
  },
  
  // iOS specific
  preventSuspend: true, // Prevent iOS from suspending the app
  pausesLocationUpdatesAutomatically: false, // Keep tracking even when stationary
  showsBackgroundLocationIndicator: true, // Required by Apple (blue status bar)
  locationAuthorizationRequest: "Always" as const, // Request Always Allow permission
  
  // Disable auto-posting to URL (we handle everything locally)
  url: undefined,
  autoSync: false,
  maxDaysToPersist: 1, // Only keep 1 day of location history locally
} as const;

/**
 * Initialize the geofencing service
 * 
 * License Handling:
 * - Development builds: Works without license (watermark shown periodically)
 * - Production iOS: Requires $399 TransistorSoft license in Info.plist
 * - License validation happens automatically on first `.ready()` call
 */
export async function initializeGeofencing(config: GeofencingConfig = {}): Promise<void> {
  // Only initialize on native platforms
  if (!Capacitor.isNativePlatform()) {
    console.log("[Geofencing] Web platform detected - geofencing disabled");
    return;
  }

  if (isInitialized) {
    await debugLog.debug('geofence', 'Already initialized, skipping');
    return;
  }

  currentConfig = config;
  await debugLog.info('geofence', 'Initializing geofencing service...');

  try {
    // Configure Background Geolocation (license validation happens here)
    const state = await BackgroundGeolocation.ready(GEOFENCING_CONFIG);
    
    await debugLog.info('geofence', 'Initialized successfully', {
      enabled: state.enabled,
      trackingMode: state.trackingMode,
      isMoving: state.isMoving,
      odometer: state.odometer,
    });

    // Set up event listeners
    setupEventListeners(config);

    // Set up notification action handlers (ALWAYS register, even if permissions denied)
    // This ensures handlers work when permissions are granted later
    await setupNotificationActionHandlers();

    // Request notification permissions for clock-in/out prompts
    await requestNotificationPermissions();

    isInitialized = true;
    await debugLog.info('geofence', 'Geofencing service ready');
  } catch (error: any) {
    await debugLog.error('geofence', 'Initialization failed', {
      code: error?.code,
      message: error?.message,
    }, error);
    
    // Check for license-related errors by numeric code, string code, or message
    // TransistorSoft plugin may emit numeric error constants or string codes
    const errorCode = error?.code;
    const errorMsg = (error?.message || '').toLowerCase();
    
    // Check numeric constants (if exposed by plugin)
    const ERROR_LICENSE = 1; // Common numeric constant for license errors
    
    const isLicenseError = 
      errorCode === ERROR_LICENSE ||
      errorCode === 'LICENSE_ERROR' ||
      errorCode === 'LICENSE_INVALID' ||
      errorCode === 'LICENSE_EXPIRED' ||
      errorMsg.includes('license') ||
      errorMsg.includes('expired') ||
      errorMsg.includes('invalid');
    
    if (isLicenseError) {
      await debugLog.error('license', 'TransistorSoft license error', {
        code: error.code,
        message: error.message,
      }, error);
      
      // Re-throw with user-friendly message
      const friendlyError = new Error(
        'Location services are unavailable. Please contact support to activate automatic time tracking features.'
      );
      // Preserve original error for debugging
      (friendlyError as any).originalError = error;
      throw friendlyError;
    }
    
    // Other initialization errors - preserve original
    throw error;
  }
}

/**
 * Request notification permissions (required for local notifications)
 */
async function requestNotificationPermissions(): Promise<void> {
  try {
    const result = await LocalNotifications.requestPermissions();
    if (result.display === 'granted') {
      await debugLog.info('notification', 'Notification permissions granted');
    } else {
      await debugLog.warn('permission', 'Notification permissions denied - user will need to enable in Settings', { status: result.display });
    }
  } catch (error: any) {
    await debugLog.error('notification', 'Failed to request notification permissions', { error: error.message }, error);
  }
}

/**
 * Set up notification action handlers (clock in/out via tap)
 * CRITICAL: Must be called on every init, regardless of permission status
 */
async function setupNotificationActionHandlers(): Promise<void> {
  // Remove existing listener if any
  if (notificationActionListener) {
    try {
      await notificationActionListener.remove();
    } catch (error) {
      console.warn("[Geofencing] Error removing old notification listener:", error);
    } finally {
      notificationActionListener = null;
    }
  }

  // Handle notification taps (works for both tap on body and action buttons)
  notificationActionListener = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    async (notification) => {
      console.log("[Notification] Action performed:", notification.actionId, notification);
      
      const { actionId, notification: notif } = notification;
      const geofenceId = notif.extra?.geofenceId;
      const action = notif.extra?.action;
      
      if (!geofenceId || !action) {
        console.warn("[Notification] Missing geofenceId or action in notification extra data");
        return;
      }
      
      // Handle both "tap" (notification body) and specific action IDs
      // Default actionId is "tap" when user taps the notification itself
      if ((actionId === 'tap' || actionId === 'clock-in') && action === 'clock-in') {
        await performClockIn(geofenceId);
      } else if ((actionId === 'tap' || actionId === 'clock-out') && action === 'clock-out') {
        await performClockOut(geofenceId);
      } else {
        console.warn("[Notification] Unknown action:", action);
      }
    }
  );
  
  console.log("[Geofencing] Notification action handlers registered");
}

/**
 * Set up event listeners for geofencing and location updates
 */
function setupEventListeners(config: GeofencingConfig) {
  // Geofence events
  BackgroundGeolocation.onGeofence(async (event: GeofenceEvent) => {
    console.log("[Geofence] Event:", event.action, event.identifier);
    
    switch (event.action) {
      case "ENTER":
        await handleGeofenceEnter(event);
        config.onGeofenceEnter?.(event);
        break;
      case "EXIT":
        await handleGeofenceExit(event);
        config.onGeofenceExit?.(event);
        break;
      case "DWELL":
        config.onGeofenceDwell?.(event);
        break;
    }
  });

  // Location updates (every 5 minutes when moving)
  BackgroundGeolocation.onLocation(async (location: Location) => {
    console.log("[Location] Update:", {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      battery: location.battery?.level,
      isMoving: location.is_moving,
    });
    
    // Log location to server (only when clocked in)
    await logLocationToServer(location);
    
    config.onLocationUpdate?.(location);
  });

  // Motion change events (moving <-> stationary)
  BackgroundGeolocation.onMotionChange((event: MotionChangeEvent) => {
    console.log("[Motion] Change:", {
      isMoving: event.isMoving,
      location: event.location,
    });
    
    config.onMotionChange?.(event);
  });

  // Permission changes
  BackgroundGeolocation.onProviderChange((event: ProviderChangeEvent) => {
    console.log("[Provider] Change:", event);
    
    if (!event.enabled) {
      console.warn("[Geofencing] Location services disabled by user");
      // TODO: Show notification to re-enable location
    }
  });

  // Authorization changes
  BackgroundGeolocation.onAuthorization((event: AuthorizationEvent) => {
    console.log("[Authorization] Status:", event.status);
    
    if (event.status !== BackgroundGeolocation.AUTHORIZATION_STATUS_ALWAYS) {
      console.warn("[Geofencing] Not using Always Allow permission:", event.status);
      // TODO: Show permission education screen
    }
  });
}

/**
 * Handle geofence ENTER event - prompt user to clock in
 */
async function handleGeofenceEnter(event: GeofenceEvent): Promise<void> {
  try {
    console.log("[Geofence] Entered job site:", event.identifier);
    
    // Check if already clocked in
    const clockStatus = await fetchClockStatus();
    if (clockStatus?.isClockedIn) {
      console.log("[Geofence] Already clocked in - skipping notification");
      return;
    }

    // Get geofence details from server to show project name
    const geofence = await fetchGeofenceDetails(event.identifier);
    const projectName = geofence?.projectName || "Job Site";

    // Show notification prompt
    await showClockInNotification(event.identifier, projectName);
  } catch (error) {
    console.error("[Geofence] Error handling ENTER event:", error);
  }
}

/**
 * Handle geofence EXIT event - prompt user to clock out
 */
async function handleGeofenceExit(event: GeofenceEvent): Promise<void> {
  try {
    console.log("[Geofence] Exited job site:", event.identifier);
    
    // Check if clocked in
    const clockStatus = await fetchClockStatus();
    if (!clockStatus?.isClockedIn) {
      console.log("[Geofence] Not clocked in - skipping notification");
      return;
    }

    // Get geofence details
    const geofence = await fetchGeofenceDetails(event.identifier);
    const projectName = geofence?.projectName || "Job Site";

    // Show notification prompt
    await showClockOutNotification(event.identifier, projectName);
  } catch (error) {
    console.error("[Geofence] Error handling EXIT event:", error);
  }
}

/**
 * Show clock-in notification when entering geofence
 * Uses LocalNotifications to work in background
 */
async function showClockInNotification(geofenceId: string, projectName: string): Promise<void> {
  try {
    // Schedule notification that works in background
    // User taps notification to trigger clock-in
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1000000),
          title: "Arrived at Job Site",
          body: `You've arrived at ${projectName}. Tap to clock in.`,
          extra: {
            geofenceId,
            projectName,
            action: 'clock-in',
          },
          schedule: { at: new Date(Date.now() + 100) }, // Fire immediately
          sound: 'default',
          smallIcon: 'ic_notification',
        }
      ]
    });

    console.log("[Geofence] Scheduled clock-in notification");
  } catch (error) {
    console.error("[Geofence] Error showing clock-in notification:", error);
  }
}

/**
 * Show clock-out notification when exiting geofence
 * Uses LocalNotifications to work in background
 */
async function showClockOutNotification(geofenceId: string, projectName: string): Promise<void> {
  try {
    // Schedule notification that works in background
    // User taps notification to trigger clock-out
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1000000),
          title: "Leaving Job Site",
          body: `You're leaving ${projectName}. Tap to clock out.`,
          extra: {
            geofenceId,
            projectName,
            action: 'clock-out',
          },
          schedule: { at: new Date(Date.now() + 100) }, // Fire immediately
          sound: 'default',
          smallIcon: 'ic_notification',
        }
      ]
    });

    console.log("[Geofence] Scheduled clock-out notification");
  } catch (error) {
    console.error("[Geofence] Error showing clock-out notification:", error);
  }
}

/**
 * Perform clock-in with GPS location (called from notification tap)
 */
async function performClockIn(geofenceId: string): Promise<void> {
  await debugLog.info('clock', `Starting clock-in for geofence: ${geofenceId}`);
  
  try {
    // Get current location
    const location = await getCurrentLocation();
    await debugLog.debug('location', 'Got current location', {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
    });
    
    // Get geofence details to extract projectId
    const geofence = await fetchGeofenceDetails(geofenceId);
    
    if (!geofence || !geofence.projectId) {
      await debugLog.error('clock', 'Missing projectId for clock-in', { geofenceId });
      await showErrorNotification("Clock In Failed", "Unable to determine project. Please clock in manually.");
      return;
    }

    await debugLog.info('clock', `Clock-in for project: ${geofence.projectName}`, { projectId: geofence.projectId });

    // Try to clock in with retry logic
    try {
      await withRetry(
        () => performClockInWithData(
          geofence.projectId,
          geofence.projectName,
          location.coords.latitude,
          location.coords.longitude,
          location.coords.accuracy
        ),
        'clock-in'
      );
      
      await debugLog.info('clock', `Successfully clocked in at ${geofence.projectName}`);
      
      // Update cached clock status
      cachedClockStatus = {
        isClockedIn: true,
        lastChecked: Date.now(),
      };
      
      // Start 5-minute location logging
      startLocationLogging();
      
      // Show success notification
      await showSuccessNotification("Clocked In", `Successfully clocked in at ${geofence.projectName}`);
    } catch (retryError: any) {
      // All retries failed - queue for later
      if (isNetworkError(retryError)) {
        await queueFailedOperation({
          type: 'clock_in',
          geofenceId,
          projectId: geofence.projectId,
          projectName: geofence.projectName,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          timestamp: new Date().toISOString(),
        });
        await showErrorNotification("Clock In Queued", "No network. Will sync when connected.");
      } else {
        throw retryError;
      }
    }
  } catch (error: any) {
    await debugLog.error('clock', 'Clock-in failed', { geofenceId, error: error.message }, error);
    await showErrorNotification("Clock In Failed", "Please try clocking in manually.");
  }
}

/**
 * Perform clock-in API call with data (used by both direct call and queue processor)
 */
async function performClockInWithData(
  projectId: string,
  projectName: string,
  latitude: number,
  longitude: number,
  accuracy: number
): Promise<void> {
  const response = await fetch('/api/clock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      type: 'clock_in',
      projectId,
      gpsLatitude: latitude,
      gpsLongitude: longitude,
      gpsAccuracy: accuracy,
      entryMethod: 'geofence',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to clock in: ${response.status} ${errorText}`);
  }
}

/**
 * Perform clock-out with GPS location (called from notification tap)
 */
async function performClockOut(geofenceId: string): Promise<void> {
  await debugLog.info('clock', `Starting clock-out for geofence: ${geofenceId}`);
  
  try {
    // Get current location
    const location = await getCurrentLocation();
    await debugLog.debug('location', 'Got current location for clock-out', {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
    });

    // Try to clock out with retry logic
    try {
      await withRetry(
        () => performClockOutWithData(
          location.coords.latitude,
          location.coords.longitude,
          location.coords.accuracy
        ),
        'clock-out'
      );
      
      await debugLog.info('clock', 'Successfully clocked out');
      
      // Update cached clock status
      cachedClockStatus = {
        isClockedIn: false,
        lastChecked: Date.now(),
      };
      
      // Stop location logging
      stopLocationLogging();
      
      // Show success notification
      await showSuccessNotification("Clocked Out", "Successfully clocked out");
    } catch (retryError: any) {
      // All retries failed - queue for later
      if (isNetworkError(retryError)) {
        await queueFailedOperation({
          type: 'clock_out',
          geofenceId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          timestamp: new Date().toISOString(),
        });
        await showErrorNotification("Clock Out Queued", "No network. Will sync when connected.");
      } else {
        throw retryError;
      }
    }
  } catch (error: any) {
    await debugLog.error('clock', 'Clock-out failed', { geofenceId, error: error.message }, error);
    await showErrorNotification("Clock Out Failed", "Please try clocking out manually.");
  }
}

/**
 * Perform clock-out API call with data (used by both direct call and queue processor)
 */
async function performClockOutWithData(
  latitude: number,
  longitude: number,
  accuracy: number
): Promise<void> {
  const response = await fetch('/api/clock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      type: 'clock_out',
      gpsLatitude: latitude,
      gpsLongitude: longitude,
      gpsAccuracy: accuracy,
      entryMethod: 'geofence',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to clock out: ${response.status} ${errorText}`);
  }
}

/**
 * Fetch current clock status from server (with caching)
 */
async function fetchClockStatus(): Promise<{ isClockedIn: boolean } | null> {
  try {
    // Use cached status if less than 30 seconds old
    if (cachedClockStatus && (Date.now() - cachedClockStatus.lastChecked) < 30000) {
      console.log("[Clock] Using cached status:", cachedClockStatus.isClockedIn);
      return { isClockedIn: cachedClockStatus.isClockedIn };
    }

    const response = await fetch('/api/clock/status', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      // If network fails, use cached status if available
      if (cachedClockStatus) {
        console.warn("[Clock] API failed, using cached status");
        return { isClockedIn: cachedClockStatus.isClockedIn };
      }
      return null;
    }

    const data = await response.json();
    const isClockedIn = !!data.clockInTime;
    
    // Update cache
    cachedClockStatus = {
      isClockedIn,
      lastChecked: Date.now(),
    };
    
    return { isClockedIn };
  } catch (error) {
    console.error("[Geofence] Error fetching clock status:", error);
    
    // Fallback to cached status if available
    if (cachedClockStatus) {
      console.warn("[Clock] Error fetching status, using cached value");
      return { isClockedIn: cachedClockStatus.isClockedIn };
    }
    
    return null;
  }
}

/**
 * Fetch geofence details from server
 */
async function fetchGeofenceDetails(geofenceId: string): Promise<{ projectId: string; projectName: string } | null> {
  try {
    const response = await fetch(`/api/geofences/${geofenceId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      projectId: data.projectId,
      projectName: data.projectName || data.name,
    };
  } catch (error) {
    console.error("[Geofence] Error fetching geofence details:", error);
    return null;
  }
}

/**
 * Log location to server (called every 5 minutes when clocked in)
 * Uses cached clock status to reduce API calls
 */
async function logLocationToServer(location: Location): Promise<void> {
  try {
    // Check cached clock status first (only fetches if cache is stale)
    const clockStatus = await fetchClockStatus();
    if (!clockStatus?.isClockedIn) {
      console.log("[Location] Not clocked in - skipping location log");
      return;
    }

    // Send location to server
    const response = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
        batteryLevel: location.battery?.level,
        batteryCharging: location.battery?.is_charging,
        activityType: location.activity?.type,
        activityConfidence: location.activity?.confidence,
      }),
    });

    if (!response.ok) {
      console.error("[Location] Failed to log location:", response.statusText);
    } else {
      console.log("[Location] Successfully logged location to server");
    }
  } catch (error) {
    console.error("[Location] Error logging location:", error);
  }
}

/**
 * Show success notification
 */
async function showSuccessNotification(title: string, body: string): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1000000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 100) },
          sound: 'default',
          smallIcon: 'ic_notification',
        }
      ]
    });
  } catch (error) {
    console.error("[Notification] Error showing success notification:", error);
  }
}

/**
 * Show error notification
 */
async function showErrorNotification(title: string, body: string): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1000000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 100) },
          sound: 'default',
          smallIcon: 'ic_notification',
        }
      ]
    });
  } catch (error) {
    console.error("[Notification] Error showing error notification:", error);
  }
}

/**
 * Start 5-minute location logging interval
 */
function startLocationLogging(): void {
  // Clear existing interval if any
  stopLocationLogging();

  console.log("[Location] Starting 5-minute location logging");
  
  // Log immediately
  getCurrentLocation().then(logLocationToServer).catch(console.error);

  // Then log every 5 minutes
  locationLoggingInterval = setInterval(async () => {
    try {
      const location = await getCurrentLocation();
      await logLocationToServer(location);
    } catch (error) {
      console.error("[Location] Error in logging interval:", error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Stop location logging interval
 */
function stopLocationLogging(): void {
  if (locationLoggingInterval) {
    clearInterval(locationLoggingInterval);
    locationLoggingInterval = null;
    console.log("[Location] Stopped 5-minute location logging");
  }
}

/**
 * Start geofencing (begin tracking)
 */
export async function startGeofencing(): Promise<void> {
  if (!isInitialized) {
    throw new Error("Geofencing not initialized. Call initializeGeofencing() first.");
  }

  const state = await BackgroundGeolocation.start();
  console.log("[Geofencing] Started", { enabled: state.enabled });
  
  // Start location logging if already clocked in
  const clockStatus = await fetchClockStatus();
  if (clockStatus?.isClockedIn) {
    startLocationLogging();
  }
}

/**
 * Stop geofencing (pause tracking)
 */
export async function stopGeofencing(): Promise<void> {
  if (!isInitialized) return;

  const state = await BackgroundGeolocation.stop();
  console.log("[Geofencing] Stopped", { enabled: state.enabled });
  
  // Stop location logging
  stopLocationLogging();
}

/**
 * Add a geofence for a job site
 */
export async function addGeofence(geofence: {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEntry?: boolean;
  notifyOnExit?: boolean;
  notifyOnDwell?: boolean;
  loiteringDelay?: number; // Dwell time in milliseconds (default 2 min)
}): Promise<void> {
  const tsGeofence: TSGeofence = {
    identifier: geofence.identifier,
    latitude: geofence.latitude,
    longitude: geofence.longitude,
    radius: geofence.radius,
    notifyOnEntry: geofence.notifyOnEntry ?? true,
    notifyOnExit: geofence.notifyOnExit ?? true,
    notifyOnDwell: geofence.notifyOnDwell ?? false, // Disabled by default (not using DWELL events)
    loiteringDelay: geofence.loiteringDelay ?? 120000, // 2 minutes default (prevents false triggers)
  };

  await BackgroundGeolocation.addGeofence(tsGeofence);
  console.log("[Geofencing] Added geofence:", geofence.identifier);
}

/**
 * Remove a geofence
 */
export async function removeGeofence(identifier: string): Promise<void> {
  await BackgroundGeolocation.removeGeofence(identifier);
  console.log("[Geofencing] Removed geofence:", identifier);
}

/**
 * Remove all geofences
 */
export async function removeAllGeofences(): Promise<void> {
  await BackgroundGeolocation.removeGeofences();
  console.log("[Geofencing] Removed all geofences");
}

/**
 * Get all active geofences (safe wrapper with fallback)
 * 
 * Handles edge cases where native layer returns undefined/null
 * Always returns a valid array to prevent runtime crashes
 * 
 * @returns Array of active geofences (empty array if query fails)
 */
export async function getGeofences(): Promise<TSGeofence[]> {
  try {
    const result = await BackgroundGeolocation.getGeofences();
    
    // Handle undefined/null/malformed responses from native layer
    if (!result || !Array.isArray(result)) {
      console.warn("[Geofencing] BackgroundGeolocation.getGeofences returned non-array:", result);
      return [];
    }
    
    return result;
  } catch (error) {
    console.error("[Geofencing] Failed to get geofences:", error);
    return []; // Safe fallback
  }
}

/**
 * Get current location
 */
export async function getCurrentLocation(): Promise<Location> {
  return await BackgroundGeolocation.getCurrentPosition({
    timeout: 30, // 30 second timeout
    maximumAge: 5000, // Accept cached location up to 5 seconds old
    desiredAccuracy: 10, // 10 meter accuracy
    samples: 3, // Take 3 samples and average
  });
}

/**
 * Check current authorization status
 */
export async function getAuthorizationStatus(): Promise<number> {
  const state = await BackgroundGeolocation.getProviderState();
  return state.status;
}

/**
 * Request location permission
 * 
 * iOS: Shows system permission dialog
 * Android: Shows system permission dialog
 */
export async function requestLocationPermission(): Promise<number> {
  // Request permission
  await BackgroundGeolocation.requestPermission();
  
  // Return current status
  return await getAuthorizationStatus();
}

/**
 * Get current tracking state
 */
export async function getState(): Promise<State> {
  return await BackgroundGeolocation.getState();
}

/**
 * Change tracking pace (for manual clock-in/out)
 * 
 * changePace(true) = Start tracking actively
 * changePace(false) = Only monitor geofences (low power mode)
 */
export async function changePace(isMoving: boolean): Promise<void> {
  await BackgroundGeolocation.changePace(isMoving);
  console.log("[Geofencing] Pace changed:", isMoving ? "ACTIVE" : "STATIONARY");
}

/**
 * Clean up and destroy geofencing service
 */
export async function destroyGeofencing(): Promise<void> {
  if (!isInitialized) return;

  // Stop location logging
  stopLocationLogging();

  // Remove our specific notification listener (not all app listeners)
  if (notificationActionListener) {
    try {
      await notificationActionListener.remove();
    } catch (error) {
      console.warn("[Geofencing] Error removing notification listener:", error);
    } finally {
      notificationActionListener = null;
    }
  }

  // Remove geolocation listeners
  await BackgroundGeolocation.removeListeners();
  await BackgroundGeolocation.stop();
  
  isInitialized = false;
  currentConfig = null;
  cachedClockStatus = null; // Clear cached status
  
  console.log("[Geofencing] Destroyed");
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * 
 * @param lat1 Latitude of point 1 (degrees)
 * @param lon1 Longitude of point 1 (degrees)
 * @param lat2 Latitude of point 2 (degrees)
 * @param lon2 Longitude of point 2 (degrees)
 * @returns Distance in miles
 */
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Update geofences based on user's current location (proximity-based)
 * 
 * iOS Limit Strategy:
 * - Only monitors the nearest 20 projects within 25 miles
 * - Automatically rotates geofences when user moves to new area
 * - Prevents wasting slots on distant sites
 * 
 * @param projects All available projects
 * @param currentLocation User's current location (optional, will fetch if not provided)
 * @returns Number of geofences updated
 */
export async function updateGeofencesByProximity(
  projects: Project[],
  currentLocation?: { latitude: number; longitude: number }
): Promise<number> {
  try {
    // Validate input
    if (!projects || projects.length === 0) {
      console.log("[Geofencing] No projects provided - clearing all geofences");
      await removeAllGeofences();
      return 0;
    }

    // Get current location if not provided
    let userLocation = currentLocation;
    if (!userLocation) {
      const location = await getCurrentLocation();
      userLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    }

    // Get existing geofences to compare (getGeofences is now safe and always returns array)
    const existingGeofences = await getGeofences();
    const existingIds = new Set(existingGeofences.map(g => g.identifier));

    // Calculate distance to each project
    const projectsWithDistance = projects.map((project) => ({
      ...project,
      distance: calculateDistanceMiles(
        userLocation.latitude,
        userLocation.longitude,
        project.latitude,
        project.longitude
      ),
    }));

    // Filter to projects within proximity radius
    const nearbyProjects = projectsWithDistance
      .filter((p) => p.distance <= PROXIMITY_RADIUS_MILES)
      .sort((a, b) => a.distance - b.distance) // Sort by distance (nearest first)
      .slice(0, MAX_GEOFENCES); // Limit to 20

    console.log(`[Geofencing] Found ${nearbyProjects.length} projects within ${PROXIMITY_RADIUS_MILES} miles`);

    // Determine which geofences to add/remove
    const targetIds = new Set(nearbyProjects.map(p => p.id));
    const toRemove = existingGeofences.filter(g => !targetIds.has(g.identifier));
    const toAdd = nearbyProjects.filter(p => !existingIds.has(p.id));

    console.log(`[Geofencing] Changes: remove ${toRemove.length}, add ${toAdd.length}, keep ${existingGeofences.length - toRemove.length}`);

    // Remove old geofences first (frees up slots)
    for (const geofence of toRemove) {
      try {
        await removeGeofence(geofence.identifier);
      } catch (error) {
        console.warn(`[Geofencing] Failed to remove geofence ${geofence.identifier}:`, error);
        // Continue removing others
      }
    }

    // Add new geofences
    let addedCount = 0;
    for (const project of toAdd) {
      try {
        // Check if we're at limit before adding
        const currentCount = await getGeofenceCount();
        if (currentCount >= MAX_GEOFENCES) {
          console.warn(`[Geofencing] Reached MAX_GEOFENCES limit (${MAX_GEOFENCES}) - cannot add ${project.name}`);
          break; // Stop adding more
        }

        await addGeofence({
          identifier: project.id,
          latitude: project.latitude,
          longitude: project.longitude,
          radius: GEOFENCE_RADIUS_FEET * 0.3048, // Convert feet to meters
          notifyOnEntry: true,
          notifyOnExit: true,
        });
        addedCount++;
      } catch (error) {
        console.error(`[Geofencing] Failed to add geofence for ${project.name}:`, error);
        // Continue adding others
      }
    }

    const finalCount = await getGeofenceCount();
    console.log(`[Geofencing] Updated geofences: ${finalCount} active (added ${addedCount}, removed ${toRemove.length})`);
    
    // Warn if there are many projects outside the radius
    const distantProjects = projectsWithDistance.length - nearbyProjects.length;
    if (distantProjects > 0) {
      console.log(`[Geofencing] ${distantProjects} projects are >${PROXIMITY_RADIUS_MILES} miles away and not monitored`);
    }

    return finalCount;
  } catch (error) {
    console.error("[Geofencing] Error updating geofences by proximity:", error);
    throw error;
  }
}

/**
 * Get count of active geofences (safe - getGeofences always returns array)
 * 
 * @returns Number of active geofences
 */
export async function getGeofenceCount(): Promise<number> {
  const geofences = await getGeofences(); // Safe wrapper - always returns array
  return geofences.length;
}

/**
 * Check if geofence limit is reached (safe)
 * 
 * @returns True if at or above iOS 20-geofence limit
 */
export async function isGeofenceLimitReached(): Promise<boolean> {
  const count = await getGeofenceCount();
  return count >= MAX_GEOFENCES;
}
