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
    console.log("[Geofencing] Already initialized");
    return;
  }

  currentConfig = config;

  try {
    // Configure Background Geolocation (license validation happens here)
    const state = await BackgroundGeolocation.ready(GEOFENCING_CONFIG);
    
    console.log("[Geofencing] Initialized successfully", {
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
  } catch (error: any) {
    console.error("[Geofencing] Initialization failed:", error);
    
    // Check for license-related errors
    if (error?.message && typeof error.message === 'string') {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('license') || errorMsg.includes('expired') || errorMsg.includes('invalid')) {
        console.error("[Geofencing] LICENSE ERROR:", error.message);
        
        // Re-throw with user-friendly message
        throw new Error(
          'Location services are unavailable. Please contact support to activate automatic time tracking features.'
        );
      }
    }
    
    // Other initialization errors
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
      console.log("[Geofencing] Notification permissions granted");
    } else {
      console.warn("[Geofencing] Notification permissions denied - user will need to enable in Settings");
    }
  } catch (error) {
    console.error("[Geofencing] Failed to request notification permissions:", error);
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
 * Perform clock-in with GPS location
 */
async function performClockIn(geofenceId: string): Promise<void> {
  try {
    // Get current location
    const location = await getCurrentLocation();
    
    // Get geofence details to extract projectId
    const geofence = await fetchGeofenceDetails(geofenceId);
    
    if (!geofence || !geofence.projectId) {
      console.error("[Geofence] Missing projectId for clock-in");
      await showErrorNotification("Clock In Failed", "Unable to determine project. Please clock in manually.");
      return;
    }

    // Clock in via API
    const response = await fetch('/api/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: 'clock_in',
        projectId: geofence.projectId,
        gpsLatitude: location.coords.latitude,
        gpsLongitude: location.coords.longitude,
        gpsAccuracy: location.coords.accuracy,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to clock in');
    }

    console.log("[Geofence] Successfully clocked in via geofence");
    
    // Update cached clock status
    cachedClockStatus = {
      isClockedIn: true,
      lastChecked: Date.now(),
    };
    
    // Start 5-minute location logging
    startLocationLogging();
    
    // Show success notification
    await showSuccessNotification("Clocked In", `Successfully clocked in at ${geofence.projectName}`);
  } catch (error) {
    console.error("[Geofence] Error performing clock-in:", error);
    await showErrorNotification("Clock In Failed", "Please try clocking in manually.");
  }
}

/**
 * Perform clock-out with GPS location
 */
async function performClockOut(geofenceId: string): Promise<void> {
  try {
    // Get current location
    const location = await getCurrentLocation();
    
    // Clock out via API
    const response = await fetch('/api/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: 'clock_out',
        gpsLatitude: location.coords.latitude,
        gpsLongitude: location.coords.longitude,
        gpsAccuracy: location.coords.accuracy,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to clock out');
    }

    console.log("[Geofence] Successfully clocked out via geofence");
    
    // Update cached clock status
    cachedClockStatus = {
      isClockedIn: false,
      lastChecked: Date.now(),
    };
    
    // Stop location logging
    stopLocationLogging();
    
    // Show success notification
    await showSuccessNotification("Clocked Out", "Successfully clocked out");
  } catch (error) {
    console.error("[Geofence] Error performing clock-out:", error);
    await showErrorNotification("Clock Out Failed", "Please try clocking out manually.");
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
 * Get all active geofences
 */
export async function getGeofences(): Promise<TSGeofence[]> {
  return await BackgroundGeolocation.getGeofences();
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
    // Get current location if not provided
    let userLocation = currentLocation;
    if (!userLocation) {
      const location = await getCurrentLocation();
      userLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    }

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

    // Remove all existing geofences
    await removeAllGeofences();

    // Add geofences for nearby projects
    for (const project of nearbyProjects) {
      await addGeofence({
        identifier: project.id,
        latitude: project.latitude,
        longitude: project.longitude,
        radius: GEOFENCE_RADIUS_FEET * 0.3048, // Convert feet to meters
        notifyOnEntry: true,
        notifyOnExit: true,
      });
    }

    console.log(`[Geofencing] Updated ${nearbyProjects.length} geofences`);
    
    // Warn if there are many projects outside the radius
    const distantProjects = projectsWithDistance.length - nearbyProjects.length;
    if (distantProjects > 0) {
      console.log(`[Geofencing] ${distantProjects} projects are >${PROXIMITY_RADIUS_MILES} miles away and not monitored`);
    }

    return nearbyProjects.length;
  } catch (error) {
    console.error("[Geofencing] Error updating geofences by proximity:", error);
    throw error;
  }
}

/**
 * Get count of active geofences
 * 
 * @returns Number of active geofences
 */
export async function getGeofenceCount(): Promise<number> {
  const geofences = await getGeofences();
  return geofences.length;
}

/**
 * Check if geofence limit is reached
 * 
 * @returns True if at or above iOS 20-geofence limit
 */
export async function isGeofenceLimitReached(): Promise<boolean> {
  const count = await getGeofenceCount();
  return count >= MAX_GEOFENCES;
}
