import { initSentry, Sentry } from "./sentry";
initSentry();

import { createRoot } from "react-dom/client";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { nativeSplashScreen } from './lib/nativeSplashScreen';
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import { syncManager } from "./lib/syncManager";
import { indexedDB } from "./lib/indexeddb";

// Initialize Capacitor app
const initializeApp = async () => {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  
  console.log('[App] Platform:', platform);
  console.log('[App] Is Native:', isNative);
  
  // Register Service Worker for offline functionality (web only)
  if (!isNative) {
    registerServiceWorker().catch((error) => {
      console.error('[PWA] Failed to register Service Worker:', error);
    });
  }
  
  // Set up Capgo OTA updates (native only)
  if (isNative) {
    try {
      // Notify Capgo that app is ready
      await CapacitorUpdater.notifyAppReady();
      console.log('[Capgo] App ready notification sent');
      
      // Listen for update events
      CapacitorUpdater.addListener('updateAvailable', (info) => {
        console.log('[Capgo] Update available:', info);
        // Update will download automatically in background
      });
      
      CapacitorUpdater.addListener('downloadComplete', (info) => {
        console.log('[Capgo] Download complete:', info);
        // Update will be installed on next app restart
      });
      
      CapacitorUpdater.addListener('updateFailed', (info) => {
        console.error('[Capgo] Update failed:', info);
      });
      
      // Check for updates manually
      const { bundle } = await CapacitorUpdater.current();
      console.log('[Capgo] Current bundle:', bundle);
      
    } catch (error) {
      console.error('[Capgo] Updater initialization failed:', error);
    }
  }
  
  // Set up native app lifecycle handlers
  if (isNative) {
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      console.log('[App] State changed. Active:', isActive);
      if (isActive) {
        // Trigger sync when app comes to foreground
        window.dispatchEvent(new CustomEvent('app-resumed'));
      }
    });
    
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      console.log('[App] Back button pressed. Can go back:', canGoBack);
      if (canGoBack) {
        window.history.back();
      }
    });
  }
};

// Error fallback component for Sentry
const ErrorFallback = ({ error, resetError }: { error: unknown; resetError: () => void }) => (
  <div className="flex items-center justify-center min-h-screen p-4">
    <div className="text-center max-w-md">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="text-muted-foreground mb-4">
        The error has been reported and we'll fix it soon.
      </p>
      <details className="mb-4 text-left">
        <summary className="cursor-pointer text-sm text-muted-foreground">
          Error details
        </summary>
        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
          {error instanceof Error ? error.message : String(error)}
        </pre>
      </details>
      <button
        onClick={resetError}
        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        data-testid="button-error-retry"
      >
        Try again
      </button>
    </div>
  </div>
);

// Initialize and render app
initializeApp().then(() => {
  createRoot(document.getElementById("root")!).render(
    <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  );
  
  // Expose syncManager and idb globally for testing
  if (import.meta.env.DEV) {
    (window as any).syncManager = syncManager;
    (window as any).idb = indexedDB;
    console.log('[App] Test globals exposed: window.syncManager, window.idb');
  }
  
  // Hide splash screen after app renders
  if (Capacitor.isNativePlatform()) {
    setTimeout(() => {
      nativeSplashScreen.hide();
    }, 300); // Small delay to ensure UI is ready
  }
}).catch((error) => {
  console.error('[App] Initialization failed:', error);
  createRoot(document.getElementById("root")!).render(
    <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  );
  
  // Expose globals even on error (for testing)
  if (import.meta.env.DEV) {
    (window as any).syncManager = syncManager;
    (window as any).idb = indexedDB;
    console.log('[App] Test globals exposed: window.syncManager, window.idb');
  }
  
  // Hide splash screen even on initialization error
  if (Capacitor.isNativePlatform()) {
    setTimeout(() => {
      nativeSplashScreen.hide();
    }, 300);
  }
});
