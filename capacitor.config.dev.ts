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
    // Connect to local dev server running on Replit
    // Replace with your Replit webview URL (e.g., https://your-repl-name.repl.co)
    url: 'http://localhost:5000',
    cleartext: true, // Allow HTTP for local development
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
