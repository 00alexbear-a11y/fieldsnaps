import { createRoot } from "react-dom/client";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";

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

// Initialize and render app
initializeApp().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
}).catch((error) => {
  console.error('[App] Initialization failed:', error);
  createRoot(document.getElementById("root")!).render(<App />);
});
