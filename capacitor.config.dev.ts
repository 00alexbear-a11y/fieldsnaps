import { CapacitorConfig } from '@capacitor/cli';

/**
 * Development Capacitor Configuration
 * 
 * This config connects the iOS/Android app to your local development server.
 * 
 * USAGE:
 * 1. Start the dev server: npm run dev (must be running on port 5000)
 * 2. Use this config when syncing: npx cap sync --config capacitor.config.dev.ts
 * 3. Open and run in Xcode: npx cap open ios
 * 
 * The app will connect to your Replit webview URL for API calls.
 */

const config: CapacitorConfig = {
  appId: 'com.fieldsnaps.app',
  appName: 'FieldSnaps Dev',
  webDir: 'dist/public',
  server: {
    // Connect to Replit dev server
    url: 'https://b031dd5d-5c92-4902-b04b-e2a8255614a2-00-1nc5d7i5pn8nb.picard.replit.dev',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen',
    },
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#FFFFFF',
    },
    CapacitorUpdater: {
      autoUpdate: false, // Disable in dev mode
    },
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
