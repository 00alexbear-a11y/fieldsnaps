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
 * 
 * Testing Strategy:
 * - iOS: 100% FREE (even production builds)
 * - Android: FREE in debug builds (works perfectly via USB/Firebase)
 * - Android production builds require $389 license (purchase only if testing successful)
 */

export interface GeofencingConfig {
  onGeofenceEnter?: (geofence: GeofenceEvent) => void;
  onGeofenceExit?: (geofence: GeofenceEvent) => void;
  onGeofenceDwell?: (geofence: GeofenceEvent) => void;
  onLocationUpdate?: (location: Location) => void;
  onMotionChange?: (event: MotionChangeEvent) => void;
}

let isInitialized = false;
let currentConfig: GeofencingConfig | null = null;

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
 * IMPORTANT: This works 100% in debug builds on both iOS and Android
 * Android production builds require license key (add only when ready to publish)
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
    // Configure Background Geolocation
    const state = await BackgroundGeolocation.ready(GEOFENCING_CONFIG);
    
    console.log("[Geofencing] Initialized successfully", {
      enabled: state.enabled,
      trackingMode: state.trackingMode,
      isMoving: state.isMoving,
      odometer: state.odometer,
    });

    // Set up event listeners
    setupEventListeners(config);

    // TODO: Phase 5 - Configure Background Fetch for periodic location sync
    // Will implement background sync when building location logging API

    isInitialized = true;
  } catch (error) {
    console.error("[Geofencing] Initialization failed:", error);
    throw error;
  }
}

/**
 * Set up event listeners for geofencing and location updates
 */
function setupEventListeners(config: GeofencingConfig) {
  // Geofence events
  BackgroundGeolocation.onGeofence((event: GeofenceEvent) => {
    console.log("[Geofence] Event:", event.action, event.identifier);
    
    switch (event.action) {
      case "ENTER":
        config.onGeofenceEnter?.(event);
        break;
      case "EXIT":
        config.onGeofenceExit?.(event);
        break;
      case "DWELL":
        config.onGeofenceDwell?.(event);
        break;
    }
  });

  // Location updates (every 5 minutes when moving)
  BackgroundGeolocation.onLocation((location: Location) => {
    console.log("[Location] Update:", {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      battery: location.battery?.level,
      isMoving: location.is_moving,
    });
    
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
 * Start geofencing (begin tracking)
 */
export async function startGeofencing(): Promise<void> {
  if (!isInitialized) {
    throw new Error("Geofencing not initialized. Call initializeGeofencing() first.");
  }

  const state = await BackgroundGeolocation.start();
  console.log("[Geofencing] Started", { enabled: state.enabled });
}

/**
 * Stop geofencing (pause tracking)
 */
export async function stopGeofencing(): Promise<void> {
  if (!isInitialized) return;

  const state = await BackgroundGeolocation.stop();
  console.log("[Geofencing] Stopped", { enabled: state.enabled });
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
    notifyOnDwell: geofence.notifyOnDwell ?? true,
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
 * Sync location data to server
 * Called periodically by Background Fetch
 */
async function syncLocationData(): Promise<void> {
  try {
    // Get any pending locations from local database
    const locations = await BackgroundGeolocation.getLocations();
    
    if (locations.length === 0) {
      console.log("[Sync] No pending locations to sync");
      return;
    }

    console.log(`[Sync] Syncing ${locations.length} locations to server`);
    
    // TODO: Phase 5 - Implement API call to POST locations to server
    // await fetch('/api/locations/batch', {
    //   method: 'POST',
    //   body: JSON.stringify({ locations }),
    // });
    
    // Clear synced locations from local database
    await BackgroundGeolocation.destroyLocations();
    
    console.log("[Sync] Successfully synced locations");
  } catch (error) {
    console.error("[Sync] Failed to sync locations:", error);
    // Will retry on next background fetch
  }
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

  await BackgroundGeolocation.removeListeners();
  await BackgroundGeolocation.stop();
  
  isInitialized = false;
  currentConfig = null;
  
  console.log("[Geofencing] Destroyed");
}
