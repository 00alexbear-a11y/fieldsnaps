import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fieldsnaps.app',
  appName: 'FieldSnaps',
  webDir: 'dist',
  server: {
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
      // Auto-update configuration for Capgo OTA updates
      autoUpdate: true,
      // Set to false in development, true in production
      resetWhenUpdate: false,
      // Check for updates on app start and resume
      appReadyTimeout: 10000,
      // Update in background
      responseDelay: 0,
      // Enable stats for update monitoring
      statsUrl: 'https://api.capgo.app/stats',
      // Enable encrypted channel (requires Capgo account)
      channelUrl: 'https://api.capgo.app',
    },
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
