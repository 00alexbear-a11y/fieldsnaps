import { Capacitor } from '@capacitor/core';
import { Network, ConnectionStatus } from '@capacitor/network';

export interface NetworkStatus {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
}

// In-memory cache for network status to prevent repeated native calls
let cachedStatus: NetworkStatus | null = null;
let statusFetchPromise: Promise<NetworkStatus> | null = null;

// Singleton listener management - only one native listener, multiple JS callbacks
const listeners = new Set<(status: NetworkStatus) => void>();
let nativeListenerHandle: { remove: () => void } | null = null;
let isListenerSetup = false;

function convertStatus(status: ConnectionStatus): NetworkStatus {
  let connectionType: 'wifi' | 'cellular' | 'none' | 'unknown' = 'unknown';
  if (!status.connected) {
    connectionType = 'none';
  } else if (status.connectionType === 'wifi') {
    connectionType = 'wifi';
  } else if (status.connectionType === 'cellular') {
    connectionType = 'cellular';
  }
  return { connected: status.connected, connectionType };
}

function setupNativeListener() {
  if (isListenerSetup || !Capacitor.isNativePlatform()) return;
  isListenerSetup = true;

  Network.addListener('networkStatusChange', (status) => {
    const networkStatus = convertStatus(status);
    cachedStatus = networkStatus;
    listeners.forEach(cb => cb(networkStatus));
  }).then(handle => {
    nativeListenerHandle = handle;
  });
}

export const nativeNetwork = {
  async getStatus(): Promise<NetworkStatus> {
    // Return cached status if available (prevents repeated native calls)
    if (cachedStatus !== null) {
      return cachedStatus;
    }

    // Deduplicate concurrent requests
    if (statusFetchPromise) {
      return statusFetchPromise;
    }

    if (!Capacitor.isNativePlatform()) {
      cachedStatus = {
        connected: navigator.onLine,
        connectionType: navigator.onLine ? 'unknown' : 'none',
      };
      return cachedStatus;
    }

    statusFetchPromise = (async () => {
      try {
        const status = await Network.getStatus();
        cachedStatus = convertStatus(status);
        return cachedStatus;
      } catch (error) {
        console.warn('Network status check failed:', error);
        cachedStatus = {
          connected: navigator.onLine,
          connectionType: navigator.onLine ? 'unknown' : 'none',
        };
        return cachedStatus;
      } finally {
        statusFetchPromise = null;
      }
    })();

    return statusFetchPromise;
  },

  addListener(callback: (status: NetworkStatus) => void): () => void {
    if (!Capacitor.isNativePlatform()) {
      const handler = () => {
        const status = {
          connected: navigator.onLine,
          connectionType: navigator.onLine ? 'unknown' : 'none',
        } as NetworkStatus;
        cachedStatus = status;
        callback(status);
      };
      
      window.addEventListener('online', handler);
      window.addEventListener('offline', handler);
      
      return () => {
        window.removeEventListener('online', handler);
        window.removeEventListener('offline', handler);
      };
    }

    // Use singleton pattern - add to listener set, only one native listener
    listeners.add(callback);
    setupNativeListener();

    return () => {
      listeners.delete(callback);
      // Don't remove native listener - keep it active for other subscribers
    };
  },
};
